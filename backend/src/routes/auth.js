// Authentication routes for K33P Identity System
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyToken, verifyZkProof, authenticate } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { K33PError, ErrorCodes, SuccessCodes, asyncHandler, ResponseUtils } from '../middleware/error-handler.js';
import { hashPhone, hashBiometric, hashPasskey } from '../utils/hash.js';
import { generateZkCommitment, generateZkProof, verifyZkProof as verifyZkProofUtil } from '../utils/zk.js';
import { signupTxBuilder } from '../utils/lucid.js';
import * as iagon from '../utils/iagon.js';
import { storageService } from '../services/storage-abstraction.js';
import { dbService } from '../database/service.js';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { sendOtp, verifyOtp } from '../utils/twilio.js';
import { UserModel } from '../database/models.js';

const router = express.Router();

// Rate limiters for auth routes
const signupLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 signup attempts per 15 minutes
  message: 'Too many signup attempts, please try again later'
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later'
});



/**
 * @route POST /api/auth/signup/phone
 * @desc Register a new user with phone verification
 * @access Public
 */
router.post('/signup/phone', async (req, res) => {
  return handleSignup(req, res, 'phone');
});

/**
 * @route POST /api/auth/signup/pin
 * @desc Register a new user with PIN verification
 * @access Public
 */
router.post('/signup/pin', async (req, res) => {
  return handleSignup(req, res, 'pin');
});

/**
 * @route POST /api/auth/signup/fingerprint
 * @desc Register a new user with fingerprint verification
 * @access Public
 */
router.post('/signup/fingerprint', async (req, res) => {
  return handleSignup(req, res, 'biometric', 'fingerprint');
});

/**
 * @route POST /api/auth/signup/faceid
 * @desc Register a new user with Face ID verification
 * @access Public
 */
router.post('/signup/faceid', async (req, res) => {
  return handleSignup(req, res, 'biometric', 'faceid');
});

/**
 * @route POST /api/auth/signup/voice
 * @desc Register a new user with voice verification
 * @access Public
 */
router.post('/signup/voice', async (req, res) => {
  return handleSignup(req, res, 'biometric', 'voice');
});

/**
 * @route POST /api/auth/signup/iris
 * @desc Register a new user with iris verification
 * @access Public
 */
router.post('/signup/iris', async (req, res) => {
  return handleSignup(req, res, 'biometric', 'iris');
});

/**
 * @route POST /api/auth/signup/passkey
 * @desc Register a new user with passkey verification
 * @access Public
 */
router.post('/signup/passkey', async (req, res) => {
  return handleSignup(req, res, 'passkey');
});

/**
 * @route POST /api/auth/signup
 * @desc Register a new user with verification (legacy endpoint)
 * @access Public
 */
router.post('/signup', async (req, res) => {
  return handleSignup(req, res);
});

router.delete('/user', verifyToken, createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 delete attempts per 15 minutes
  message: 'Too many delete account attempts, please try again later'
}), asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId;  
    
    console.log('=== DELETE USER DEBUG START ===');
    console.log('Authenticated user ID from token:', userId);

    if (!userId) {
      console.log('Validation failed: User ID not found in token');
      return ResponseUtils.error(res, ErrorCodes.UNAUTHORIZED, null, 'Invalid token');
    }

    // Check if user exists
    console.log('Finding user by ID:', userId);
    const user = await UserModel.findByUserId(userId);
    
    if (!user) {
      console.log('User not found with ID:', userId);
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND, null, 'User not found');
    }

    console.log('User found, proceeding with deletion...');
    
    // Start the deletion process
    const deletionResult = await UserModel.deleteUser(userId);
    
    if (!deletionResult) {
      console.log('User deletion failed');
      return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, null, 'Failed to delete user account');
    }

    console.log('User deletion completed successfully');
    
    // Also clear any active sessions for this user
    try {
      await iagon.deleteSessions({ userId: user.id });
      console.log('User sessions cleared from Iagon');
    } catch (sessionError) {
      console.warn('Could not clear user sessions:', sessionError.message);
      // Don't fail the deletion if session cleanup fails
    }

    console.log('=== DELETE USER DEBUG END ===');
    
    return ResponseUtils.success(res, SuccessCodes.USER_DELETED, {
      message: 'User account and all associated data have been successfully deleted',
      userId: userId,
      timestamp: new Date().toISOString()
    }, 'Your account has been permanently deleted. All your data has been removed from our systems.');

  } catch (error) {
    console.error('=== DELETE USER ERROR ===');
    console.error('Error:', error);
    
    // Handle specific error cases
    if (error.message.includes('foreign key constraint')) {
      return ResponseUtils.error(res, ErrorCodes.DATABASE_ERROR, error, 'Failed to delete account due to database constraints. Please contact support.');
    }
    
    if (error.message.includes('transaction')) {
      return ResponseUtils.error(res, ErrorCodes.DATABASE_ERROR, error, 'Database transaction failed. Please try again.');
    }
    
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to delete user account: ' + error.message);
  }
}));

/**
 * @route POST /api/auth/send-otp
 * @desc Send OTP to phone number during signup
 * @access Public
 */
router.post('/send-otp', createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 OTP requests per 5 minutes
  message: 'Too many OTP requests, please try again later'
}), asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    throw new K33PError(ErrorCodes.VALIDATION_ERROR, 'Phone number is required');
  }
  
  console.log(`Sending OTP to ${phoneNumber}`);
  const result = await sendOtp(phoneNumber);
  
  if (result.success) {
    ResponseUtils.success(res, SuccessCodes.OTP_SENT, {
      requestId: result.requestId,
      expiresIn: 300 // 5 minutes
    });
  } else {
    throw new K33PError(ErrorCodes.OTP_SEND_FAILED, result.error || 'Failed to send OTP');
  }
}));

// Session storage for signup flow (in production, use Redis)
const signupSessions = new NodeCache({ stdTTL: 1800 }); // 30 minutes

/**
 * @route POST /api/auth/setup-pin
 * @desc Step 4: Setup 4-digit PIN after OTP verification
 * @access Public
 */
router.post('/setup-pin', createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 attempts per minute
  message: 'Too many PIN setup attempts, please try again later'
}), async (req, res) => {
  try {
    const { phoneNumber, pin, sessionId } = req.body;
    
    // Validate required fields
    if (!phoneNumber || !pin) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Phone number and PIN are required');
    }
    
    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_INPUT, null, 'PIN must be exactly 4 digits');
    }
    
    // Create or update session
    const sessionKey = sessionId || `signup_${crypto.randomUUID()}`;
    const sessionData = signupSessions.get(sessionKey) || {};
    
    // Store PIN setup data
    sessionData.phoneNumber = phoneNumber;
    sessionData.pin = pin;
    sessionData.step = 'pin_setup';
    sessionData.timestamp = new Date();
    
    signupSessions.set(sessionKey, sessionData);
    
    console.log(`PIN setup completed for session: ${sessionKey}`);
    
    return ResponseUtils.success(res, SuccessCodes.PIN_SETUP_SUCCESS, {
      sessionId: sessionKey,
      step: 'pin_setup',
      nextStep: 'pin_confirmation'
    });
    
  } catch (error) {
    console.error('Error setting up PIN:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to setup PIN');
  }
});

/**
 * @route POST /api/auth/confirm-pin
 * @desc Step 5: Confirm 4-digit PIN during signup
 * @access Public
 */
router.post('/confirm-pin', createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many PIN confirmation attempts, please try again later'
}), async (req, res) => {
  try {
    const { sessionId, pin } = req.body;
    
    // Validate required fields
    if (!sessionId || !pin) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Session ID and PIN are required');
    }
    
    // Get session data
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_SESSION, null, 'Invalid or expired session');
    }
    
    // Verify PIN matches
    if (sessionData.pin !== pin) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_PIN, null, 'PIN confirmation does not match. Please try again.');
    }
    
    // Update session
    sessionData.pinConfirmed = true;
    sessionData.step = 'pin_confirmed';
    sessionData.timestamp = new Date();
    
    signupSessions.set(sessionId, sessionData);
    
    console.log(`PIN confirmed for session: ${sessionId}`);
    
    return ResponseUtils.success(res, SuccessCodes.PIN_VERIFIED, {
      sessionId,
      step: 'pin_confirmed',
      nextStep: 'biometric_setup'
    });
    
  } catch (error) {
    console.error('Error confirming PIN:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to confirm PIN');
  }
});

/**
 * @route POST /api/auth/setup-biometric
 * @desc Step 6: Setup biometric authentication (Face ID, Fingerprint, Voice ID, Iris Scan)
 * @access Public
 */
router.post('/setup-biometric', createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 attempts per minute (increased for testing)
  message: 'Too many biometric setup attempts, please try again later'
}), async (req, res) => {
  try {
    const { sessionId, biometricType, biometricData } = req.body;
    
    // Validate required fields
    if (!sessionId) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Session ID is required');
    }
    
    // Get session data
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_SESSION, null, 'Invalid or expired session');
    }
    
    // Verify PIN was confirmed
    if (!sessionData.pinConfirmed) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_FLOW, null, 'PIN must be confirmed before setting up biometric authentication');
    }
    
    // Validate biometric data if provided
    if (biometricType && biometricData) {
      if (!['fingerprint', 'faceid', 'voice', 'iris'].includes(biometricType)) {
        return res.status(400).json({ 
          success: false,
          error: 'Biometric type must be one of: fingerprint, faceid, voice, iris' 
        });
      }
    }
    
    // Update session with biometric data
    sessionData.biometricType = biometricType || null;
    sessionData.biometricData = biometricData || null;
    sessionData.step = 'biometric_setup';
    sessionData.timestamp = new Date();
    
    signupSessions.set(sessionId, sessionData);
    
    console.log(`Biometric setup completed for session: ${sessionId}`);
    
    return ResponseUtils.success(res, SuccessCodes.BIOMETRIC_SETUP_SUCCESS, {
      sessionId,
      step: 'biometric_setup',
      biometricType: biometricType || null,
      nextStep: 'did_creation'
    }, biometricType ? `${biometricType} setup completed successfully` : 'Biometric setup skipped');
    
  } catch (error) {
    console.error('Error setting up biometric:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to setup biometric authentication');
  }
});

/**
 * @route POST /api/auth/complete-signup
 * @desc Step 7: Complete signup with DID creation and ZK proof generation
 * @access Public
 */
router.post('/complete-signup', createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 attempts per minute for testing
  message: 'Too many signup completion attempts, please try again later'
}), async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Validate required fields
    if (!sessionId) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Session ID is required');
    }
    
    // Get session data
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_SESSION, null, 'Invalid or expired session');
    }
    
    // Verify biometric setup was completed
    if (sessionData.step !== 'biometric_setup') {
      return ResponseUtils.error(res, ErrorCodes.INVALID_FLOW, null, 'Biometric setup must be completed before finalizing signup');
    }
    
    // Prepare user data for signup
    const userData = {
      phoneNumber: sessionData.phoneNumber,
      pin: sessionData.pin,
      biometricType: sessionData.biometricType,
      biometricData: sessionData.biometricData,
      verificationMethod: 'pin', // Default verification method
      userId: crypto.randomUUID() // Generate a unique user ID
    };
    
    // Use existing handleSignup function to complete the process
    const mockReq = {
      body: userData,
      ip: req.ip,
      headers: req.headers
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 200 || code === 201) {
            // Success - update session and return response
            sessionData.step = 'signup_completed';
            sessionData.userId = data.data?.userId;
            sessionData.walletAddress = data.data?.walletAddress;
            sessionData.timestamp = new Date();
            signupSessions.set(sessionId, sessionData);
            
            res.status(code).json({
              ...data,
              sessionId,
              nextStep: 'username_setup'
            });
          } else {
            // Error - forward the error response
            res.status(code).json(data);
          }
        }
      }),
      json: (data) => {
        // Success case (status 200 by default)
        sessionData.step = 'signup_completed';
        sessionData.userId = data.data?.userId;
        sessionData.walletAddress = data.data?.walletAddress;
        sessionData.timestamp = new Date();
        signupSessions.set(sessionId, sessionData);
        
        return ResponseUtils.success(res, SuccessCodes.USER_CREATED, {
          ...data,
          sessionId,
          nextStep: 'username_setup'
        });
      }
    };
    
    // Call the existing handleSignup function
    await handleSignup(mockReq, mockRes, 'pin', sessionData.biometricType);
    
  } catch (error) {
    console.error('Error completing signup:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to complete signup');
  }
});

/**
 * @route POST /api/auth/setup-username
 * @desc Setup username for authenticated user using JWT token
 * @access Private (requires JWT)
 */
router.post('/setup-username', verifyToken, createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many username setup attempts, please try again later'
}), async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user.userId; // From JWT token
    
    console.log('=== SETUP USERNAME DEBUG START ===');
    console.log('Authenticated user ID from token:', userId);
    console.log('Requested username:', username);

    // Validate required fields - ONLY username is required now
    if (!username) {
      console.log('Validation failed: Username is required');
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Username is required');
    }
    
    // Validate username format
    if (username.length < 3 || username.length > 30) {
      console.log('Validation failed: Username must be between 3 and 30 characters');
      return ResponseUtils.error(res, ErrorCodes.INVALID_INPUT, null, 'Username must be between 3 and 30 characters');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      console.log('Validation failed: Username contains invalid characters');
      return ResponseUtils.error(res, ErrorCodes.INVALID_INPUT, null, 'Username can only contain letters, numbers, and underscores');
    }
    
    console.log('Finding user by ID:', userId);
    const user = await dbService.getUserById(userId);
    
    if (!user) {
      console.log('User not found with ID:', userId);
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND, null, 'User not found');
    }

    // Check if user already has a username
    if (user.username) {
      console.log('User already has username:', user.username);
      return ResponseUtils.error(res, ErrorCodes.USERNAME_ALREADY_SET, null, 'Username is already set for this account');
    }
    
    // Check if username is already taken
    console.log('Checking if username is available...');
    const existingUser = await dbService.getUserByUsername(username);
    if (existingUser) {
      console.log('Username already taken by user:', existingUser.user_id);
      return ResponseUtils.error(res, ErrorCodes.USERNAME_ALREADY_EXISTS, null, 'Username is already taken. Please choose a different username.');
    }

    console.log('Updating user with username...');
    const updatedUser = await dbService.updateUser(userId, { username });
    
    if (!updatedUser) {
      console.log('Failed to update user with username');
      return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, null, 'Failed to save username');
    }

    console.log('Username setup completed for user:', userId);
    
    // Generate new JWT token with username included
    const token = jwt.sign(
      { 
        id: updatedUser.id,
        userId: updatedUser.user_id,
        phoneNumber: updatedUser.phone_number,
        username: updatedUser.username,
        walletAddress: updatedUser.wallet_address,
        authMethods: updatedUser.auth_methods?.map(m => m.type) || [],
        verificationMethod: updatedUser.verification_method,
        zkCommitment: updatedUser.zk_commitment
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    
    const responseData = {
      username: updatedUser.username,
      userId: updatedUser.user_id,
      walletAddress: updatedUser.wallet_address,
      completed: true,
      token
    };

    console.log('Username setup completed successfully');
    console.log('=== SETUP USERNAME DEBUG END ===');
    
    return ResponseUtils.success(res, SuccessCodes.USERNAME_SET, responseData, 'Username setup completed successfully. Welcome to K33P!');
    
  } catch (error) {
    console.error('=== SETUP USERNAME ERROR ===');
    console.error('Error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to setup username');
  }
});

/**
 * @route GET /api/auth/username
 * @desc Get username for authenticated user
 * @access Private (requires JWT)
 */
router.get('/username', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token
    
    console.log('=== GET USERNAME DEBUG START ===');
    console.log('Authenticated user ID from token:', userId);

    if (!userId) {
      console.log('Validation failed: User ID not found in token');
      return ResponseUtils.error(res, ErrorCodes.UNAUTHORIZED, null, 'Invalid token');
    }

    console.log('Finding user by ID:', userId);
    const user = await dbService.getUserById(userId);
    
    if (!user) {
      console.log('User not found with ID:', userId);
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND, null, 'User not found');
    }

    console.log('User found:', {
      userId: user.user_id,
      hasUsername: !!user.username,
      username: user.username || 'Not set'
    });

    const responseData = {
      userId: user.user_id,
      username: user.username || null,
      walletAddress: user.wallet_address,
      exists: true,
      hasUsername: !!user.username
    };

    console.log('=== GET USERNAME DEBUG END ===');
    return ResponseUtils.success(res, SuccessCodes.USER_RETRIEVED, responseData, 
      user.username ? 'Username retrieved successfully' : 'User found but no username set');

  } catch (error) {
    console.error('=== GET USERNAME ERROR ===');
    console.error('Error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

/**
 * @route PUT /api/auth/username
 * @desc Update username for authenticated user
 * @access Private (requires JWT)
 */
router.put('/username', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token
    const { username } = req.body;
    
    console.log('=== UPDATE USERNAME DEBUG START ===');
    console.log('Authenticated user ID from token:', userId);
    console.log('New username:', username);

    if (!username) {
      console.log('Validation failed: Username is required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Username is required');
    }

    // Validate username format
    if (username.length < 3 || username.length > 30) {
      console.log('Validation failed: Username must be 3-30 characters');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Username must be between 3 and 30 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      console.log('Validation failed: Username contains invalid characters');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Username can only contain letters, numbers, and underscores');
    }

    console.log('Checking if user exists...');
    const user = await dbService.getUserById(userId);
    
    if (!user) {
      console.log('User not found with ID:', userId);
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND, null, 'User not found');
    }

    console.log('Checking if username is already taken...');
    const existingUser = await dbService.getUserByUsername(username);
    if (existingUser && existingUser.user_id !== userId) {
      console.log('Username already taken by user:', existingUser.user_id);
      return ResponseUtils.error(res, ErrorCodes.USERNAME_ALREADY_EXISTS, null, 'Username is already taken');
    }

    console.log('Updating username...');
    const updatedUser = await dbService.updateUser(userId, { username });
    
    if (!updatedUser) {
      console.log('Failed to update username');
      return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, null, 'Failed to update username');
    }

    console.log('Username updated successfully');
    
    const responseData = {
      userId: updatedUser.user_id,
      username: updatedUser.username,
      walletAddress: updatedUser.wallet_address,
      updatedAt: updatedUser.updated_at
    };

    console.log('=== UPDATE USERNAME DEBUG END ===');
    return ResponseUtils.success(res, SuccessCodes.USER_UPDATED, responseData, 'Username updated successfully');

  } catch (error) {
    console.error('=== UPDATE USERNAME ERROR ===');
    console.error('Error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

/**
 * @route GET /api/auth/username/check/:username
 * @desc Check if username is available
 * @access Public (can be protected if you want)
 */
router.get('/username/check/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    console.log('=== CHECK USERNAME DEBUG START ===');
    console.log('Checking username:', username);
    console.log('Has token:', !!token);

    if (!username) {
      console.log('Validation failed: Username is required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Username is required');
    }

    // Validate username format
    if (username.length < 3 || username.length > 30) {
      console.log('Validation failed: Username must be 3-30 characters');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Username must be between 3 and 30 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      console.log('Validation failed: Username contains invalid characters');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Username can only contain letters, numbers, and underscores');
    }

    console.log('Checking if username exists...');
    const existingUser = await dbService.getUserByUsername(username);
    
    const isAvailable = !existingUser;
    
    console.log('Username availability:', isAvailable ? 'Available' : 'Taken');
    
    const responseData = {
      username,
      available: isAvailable,
      exists: !!existingUser,
      message: isAvailable ? 'Username is available' : 'Username is already taken'
    };

    // If token is provided, verify it and include user info
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
        responseData.currentUser = {
          userId: decoded.userId,
          canClaim: isAvailable
        };
        console.log('Token verified for user:', decoded.userId);
      } catch (tokenError) {
        console.log('Token invalid or expired:', tokenError.message);
        responseData.tokenValid = false;
      }
    }

    console.log('=== CHECK USERNAME DEBUG END ===');
    return ResponseUtils.success(res, SuccessCodes.USERNAME_CHECKED, responseData, 
      isAvailable ? 'Username is available' : 'Username is already taken');

  } catch (error) {
    console.error('=== CHECK USERNAME ERROR ===');
    console.error('Error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});
/**
 * @route GET /api/auth/session-status/:sessionId
 * @desc Get current status of signup session
 * @access Public
 */
router.get('/session-status/:sessionId', createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes
  message: 'Too many session status requests, please try again later'
}), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Session ID is required');
    }
    
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return ResponseUtils.error(res, ErrorCodes.SESSION_NOT_FOUND, null, 'Session not found or expired');
    }
    
    // Return session status without sensitive data
    return ResponseUtils.success(res, SuccessCodes.SESSION_RETRIEVED, {
      sessionId,
      step: sessionData.step,
      phoneNumber: sessionData.phoneNumber ? sessionData.phoneNumber.replace(/.(?=.{4})/g, '*') : null,
      pinConfirmed: sessionData.pinConfirmed || false,
      biometricType: sessionData.biometricType || null,
      username: sessionData.username || null,
      completed: sessionData.completed || false,
      timestamp: sessionData.timestamp
    });
    
  } catch (error) {
    console.error('Error getting session status:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to get session status');
  }
});

/**
 * @route POST /api/auth/verify-otp
 * @desc Verify OTP code during signup
 * @access Public
 */
router.post('/verify-otp', createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 verification attempts per 5 minutes
  message: 'Too many verification attempts, please try again later'
}), async (req, res) => {
  try {
    const { requestId, code } = req.body;
    
    if (!requestId || !code) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Request ID and verification code are required');
    }
    
    console.log(`Verifying OTP for request ${requestId}`);
    const result = await verifyOtp(requestId, code);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Phone number verified successfully',
        data: { verified: true }
      });
    } else {
      return ResponseUtils.error(res, ErrorCodes.OTP_VERIFICATION_FAILED, result.error, result.error || 'Invalid or expired OTP');
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to verify OTP');
  }
});

async function handleSignup(req, res, defaultVerificationMethod = null, defaultBiometricType = null) {
  try {
    console.log('=== SIGNUP DEBUG START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      userAddress, 
      userId, 
      phoneHash,
      pinHash,  
      authMethods, 
      zkCommitment, 
      zkProof,      
      username,
      senderWalletAddress, 
      biometricData, 
      verificationMethod = defaultVerificationMethod || 'phone', 
      biometricType = defaultBiometricType,
      walletAddress, 
      biometric, 
      passkey 
    } = req.body;

    console.log('Extracted fields:', { 
      userAddress, 
      userId, 
      hasPhoneHash: !!phoneHash,
      hasPinHash: !!pinHash,
      authMethodsCount: authMethods?.length || 0,
      hasZkCommitment: !!zkCommitment,
      hasZkProof: !!zkProof,
      senderWalletAddress, 
      verificationMethod,
      biometricType
    });

    const finalUserAddress = userAddress || walletAddress;
    const finalPhoneHash = phoneHash;
    const finalPinHash = pinHash;
    const finalBiometricData = biometricData || biometric;

    console.log('Final processed fields:', {
      finalUserAddress,
      hasFinalPhoneHash: !!finalPhoneHash,
      hasFinalPinHash: !!finalPinHash,
      authMethods: authMethods?.map(m => m.type) || []
    });

    // Validation
    if (!finalPhoneHash) {
      console.log('Validation failed: Phone encrypted data is required');
      return ResponseUtils.error(res, ErrorCodes.PHONE_REQUIRED, null, 'Phone encrypted data is required');
    }

    if (!userId) {
      console.log('Validation failed: User ID is required');
      return ResponseUtils.error(res, ErrorCodes.IDENTIFIER_REQUIRED);
    }

    if (!zkCommitment) {
      console.log('Validation failed: ZK commitment is required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'ZK commitment is required');
    }

    if (!zkProof) {
      console.log('Validation failed: ZK proof is required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'ZK proof is required');
    }

    if (!authMethods || !Array.isArray(authMethods) || authMethods.length < 3) {
      console.log('Validation failed: At least 3 authentication methods are required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'At least 3 authentication methods are required');
    }

    // Validate auth methods
    for (const method of authMethods) {
      if (!method.type) {
        console.log('Validation failed: Auth method missing type');
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'All authentication methods must have a type');
      }

      if (!method.createdAt) {
        console.log('Validation failed: Auth method missing createdAt for type:', method.type);
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'All authentication methods must have a createdAt timestamp');
      }

      const allowedTypes = ['phone', 'pin', 'fingerprint', 'face', 'voice', 'iris'];
      if (!allowedTypes.includes(method.type)) {
        console.log('Validation failed: Invalid auth method type:', method.type);
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, `Invalid authentication method type: ${method.type}. Allowed types: ${allowedTypes.join(', ')}`);
      }
    }

    if (userId.length < 3 || userId.length > 50) {
      console.log('Validation failed: User ID must be 3-50 characters');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'User ID must be between 3 and 50 characters');
    }

    console.log('✅ All validation passed');

    console.log('🔍 Starting duplicate detection...');

    let duplicateDetails = null;

    // Check for duplicate user ID
    if (userId) {
      console.log('Checking for existing user by ID:', userId);
      try {
        const userById = await dbService.getUserById(userId);
        if (userById) {
          duplicateDetails = {
            type: 'USER_ID_EXISTS',
            field: 'userId',
            value: userId,
            existingUser: {
              userId: userById.user_id,
              walletAddress: userById.wallet_address,
              createdAt: userById.created_at
            }
          };
          console.log('❌ User ID already exists:', userId);
        } else {
          console.log('✅ User ID is available');
        }
      } catch (userIdError) {
        console.error('Error checking user ID:', userIdError);
        // Continue with signup even if user ID check fails
        console.log('⚠️ Continuing signup despite user ID check error');
      }
    }

    // Check for duplicate phone - SIMPLIFIED VERSION
    if (!duplicateDetails && finalPhoneHash) {
      console.log('🔍 Checking for existing user by phone hash...');
      console.log('Phone hash to check:', finalPhoneHash);
      console.log('Phone hash length:', finalPhoneHash.length);
      console.log('Phone hash first 50 chars:', finalPhoneHash.substring(0, 50));
      
      try {
        console.log('📊 Querying database for phone hash...');
        
        // Direct lookup - no format validation
        const userByPhone = await dbService.getUserByPhoneHash(finalPhoneHash);
        
        console.log('Database query result:', userByPhone ? 'FOUND USER' : 'NO USER FOUND');
        
        if (userByPhone) {
          console.log('📞 Found existing user with this phone:');
          console.log('   User ID:', userByPhone.user_id);
          console.log('   Wallet:', userByPhone.wallet_address);
          
          duplicateDetails = {
            type: 'PHONE_EXISTS',
            field: 'phoneHash',
            existingUser: {
              userId: userByPhone.user_id,
              walletAddress: userByPhone.wallet_address,
              createdAt: userByPhone.created_at
            }
          };
          console.log('❌ Phone number already registered to user:', userByPhone.user_id);
        } else {
          console.log('✅ Phone number is available - no existing user found with this phone hash');
        }
      } catch (phoneHashCheckError) {
        console.error('❌ ERROR in phone hash check:', phoneHashCheckError);
        console.error('Full error stack:', phoneHashCheckError.stack);
        return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, null, 'Error checking phone registration: ' + phoneHashCheckError.message);
      }
    }

    if (duplicateDetails) {
      console.log('🚫 Registration rejected - duplicate detected:', duplicateDetails);
      
      const errorMessages = {
        'USER_ID_EXISTS': `User ID "${userId}" is already registered. Please use a different ID.`,
        'PHONE_EXISTS': 'This phone number is already registered. Please use a different number.'
      };

      return ResponseUtils.error(res, ErrorCodes.USER_ALREADY_EXISTS, duplicateDetails, 
        errorMessages[duplicateDetails.type] || 'User already exists with provided credentials');
    }

    console.log('✅ No duplicates found - proceeding with new user creation');

    console.log('Step 2: Creating new user with DatabaseService...');

    console.log('User creation data:', {
      userId: userId,
      walletAddress: finalUserAddress,
      phoneHash: finalPhoneHash ? `${finalPhoneHash.substring(0, 20)}...` : null,
      pinHash: finalPinHash ? `${finalPinHash.substring(0, 20)}...` : null,
      zkCommitment: zkCommitment,
      authMethods: authMethods.map(m => ({ type: m.type, hasData: !!m.data, hasCreatedAt: !!m.createdAt })),
      verificationMethod: verificationMethod
    });

    try {
      const newUser = await dbService.createUser({
        userId: userId,
        walletAddress: finalUserAddress,
        phoneHash: finalPhoneHash,
        pinHash: finalPinHash,
        zkCommitment: zkCommitment, 
        authMethods: authMethods, 
        folders: [],
        verificationMethod: verificationMethod,
        biometricType: biometricType,
        senderWalletAddress: senderWalletAddress
      });

      console.log('✅ User created successfully with ID:', newUser.user_id);
      console.log('Phone encrypted data stored:', finalPhoneHash ? `${finalPhoneHash.substring(0, 20)}...` : null);
      console.log('PIN encrypted data stored:', finalPinHash ? `${finalPinHash.substring(0, 20)}...` : null);
      console.log('Auth methods saved:', authMethods.map(m => m.type));

      console.log('Storing ZK proof for new user...');
      try {
        await dbService.createZKProof({
          user_id: newUser.user_id,
          commitment: zkCommitment,
          proof: zkProof,
          public_inputs: {
            phoneHash: finalPhoneHash,
            userAddress: finalUserAddress,
            verificationMethod,
            isNewUser: true,
            timestamp: new Date().toISOString()
          },
          is_valid: true
        });
        
        console.log('ZK proof stored for new user successfully');
      } catch (zkError) {
        console.error('Failed to store ZK proof for new user:', zkError);
        // Don't fail signup if ZK proof storage fails
      }

      console.log('Generating JWT token for new user...');
      const token = jwt.sign(
        { 
          id: newUser.id, 
          userId: newUser.user_id,
          walletAddress: newUser.wallet_address,
          authMethods: authMethods.map(m => m.type),
          verificationMethod: verificationMethod,
          zkCommitment: zkCommitment,
          authDetails: {
            method: 'signup',
            verified: verificationMethod === 'phone' ? false : true,
            isNewUser: true
          }
        },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );

      console.log('JWT token generated successfully');

      const responseData = {
        verified: verificationMethod === 'phone' ? false : true, 
        userId: newUser.user_id,
        walletAddress: newUser.wallet_address,
        verificationMethod,
        authMethods: authMethods, 
        zkCommitment: zkCommitment,
        requiresDeposit: verificationMethod === 'phone',
        depositAddress: finalUserAddress,
        authDetails: {
          method: 'signup',
          verified: verificationMethod === 'phone' ? false : true,
          isNewUser: true
        },
        message: 'DID created successfully. Welcome to K33P!',
        token: token
      };

      console.log('Response built successfully');
      console.log('=== SIGNUP DEBUG END (New User) ===');
      
      return ResponseUtils.success(res, SuccessCodes.USER_CREATED, responseData, 'DID created successfully. Welcome to K33P!');

    } catch (dbError) {
      console.error('❌ Database error during user creation:', dbError);
      console.error('Database error details:', {
        name: dbError.name,
        message: dbError.message,
        code: dbError.code,
        constraint: dbError.constraint
      });
      
      if (dbError.code === '23505') {
        const constraint = dbError.constraint;
        if (constraint && constraint.includes('user_id')) {
          return ResponseUtils.error(res, ErrorCodes.USER_ALREADY_EXISTS, null, 'User ID already exists');
        } else if (constraint && constraint.includes('phone_hash')) {
          return ResponseUtils.error(res, ErrorCodes.PHONE_ALREADY_REGISTERED, null, 'Phone number already registered');
        } else if (constraint && constraint.includes('wallet_address')) {
          return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Wallet address already registered');
        }
      }
      
      return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, null, 'Database error during user creation');
    }

  } catch (error) {
    console.error('=== SIGNUP ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.code) {
      console.error('Database error code:', error.code);
    }
    if (error.constraint) {
      console.error('Database constraint:', error.constraint);
    }
    if (error.detail) {
      console.error('Database error detail:', error.detail);
    }
    
    console.error('=== END SIGNUP ERROR ===');
    
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Add this helper function to validate AES format
function isValidAESFormat(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return false;
  }
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    return false;
  }
  
  const [iv, authTag, encrypted] = parts;
  
  // Check if all parts are valid hex strings
  const hexRegex = /^[0-9a-f]+$/;
  if (!hexRegex.test(iv) || !hexRegex.test(authTag) || !hexRegex.test(encrypted)) {
    return false;
  }
  
  // IV should be 16 bytes (32 hex chars)
  if (iv.length !== 32) {
    return false;
  }
  
  // Auth tag should be 16 bytes (32 hex chars)  
  if (authTag.length !== 32) {
    return false;
  }
  
  // Encrypted data should not be empty
  if (encrypted.length === 0) {
    return false;
  }
  
  return true;
}

export { handleSignup };

/**
 * @route POST /api/auth/login
 * @desc Login a user with ZK proof
 * @access Public
 */
router.post('/login', verifyZkProof, async (req, res) => {
  try {
    const { walletAddress, phone, username, proof, commitment } = req.body;
    
    // At least one identifier is required
    if (!phone && !username && !walletAddress) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'At least one identifier is required: phone, username, or walletAddress');
    }
    
    if (!proof || !commitment) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Missing required fields: proof and commitment are required');
    }
    
    // Find user by multiple identifiers (priority: phone > username > wallet address)
    let userResult = null;
    let user = null;
    
    // Try phone first (if provided)
    if (phone) {
      userResult = await storageService.findUser({ phoneHash: hashPhone(phone) });
      user = userResult.success ? userResult.data : null;
    }
    
    // Try username if phone lookup failed or wasn't provided
    if (!user && username) {
      userResult = await storageService.findUser({ username });
      user = userResult.success ? userResult.data : null;
    }
    
    // Try wallet address if both phone and username lookup failed
    if (!user && walletAddress) {
      userResult = await storageService.findUser({ walletAddress });
      user = userResult.success ? userResult.data : null;
    }
    
    if (!user) {
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND);
    }
    // Verify ZK proof (simulated)
    if (user.zkCommitment !== commitment) {
      return ResponseUtils.error(res, ErrorCodes.ZK_PROOF_INVALID);
    }
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    // Create session in Iagon
    await iagon.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) });
    return ResponseUtils.success(res, SuccessCodes.AUTH_LOGIN_SUCCESS, { token, hasWallet: !!user.walletAddress });
  } catch (error) {
    console.error('Login error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

/**
 * @route POST /api/auth/signin
 * @desc Sign in with phone number, OTP, and PIN
 * @access Public
 */
router.post('/signin', async (req, res) => {
  try {
    const { phoneNumber, otpRequestId, otpCode, pin } = req.body;
    
    console.log('=== SIGNIN DEBUG START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    if (!phoneNumber) {
      console.log('Validation failed: Phone number is required');
      return ResponseUtils.error(res, ErrorCodes.PHONE_REQUIRED);
    }
    
    if (!otpRequestId) {
      console.log('Validation failed: OTP request ID is required');
      return ResponseUtils.error(res, ErrorCodes.OTP_REQUEST_ID_REQUIRED);
    }
    
    if (!otpCode) {
      console.log('Validation failed: OTP code is required');
      return ResponseUtils.error(res, ErrorCodes.OTP_CODE_REQUIRED);
    }
    
    if (!pin) {
      console.log('Validation failed: PIN is required');
      return ResponseUtils.error(res, ErrorCodes.PIN_REQUIRED);
    }
    
    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      console.log('Validation failed: PIN must be 4 digits');
      return ResponseUtils.error(res, ErrorCodes.PIN_INVALID_FORMAT);
    }
    
    // Validate OTP code format (5 digits)
    if (!/^\d{5}$/.test(otpCode)) {
      console.log('Validation failed: OTP code must be 5 digits');
      return ResponseUtils.error(res, ErrorCodes.OTP_CODE_INVALID_FORMAT);
    }
    
    console.log('Step 1: Verifying OTP...');
    const otpVerification = await verifyOtp(otpRequestId, otpCode);
    
    if (!otpVerification.success) {
      console.log('OTP verification failed:', otpVerification.error);
      return ResponseUtils.error(res, ErrorCodes.OTP_INVALID, {
        message: otpVerification.error || 'Invalid or expired OTP'
      });
    }
    
    console.log('OTP verified successfully');
    
    console.log('Step 2: Hashing phone number...');
    const phoneHash = hashPhone(phoneNumber);
    console.log('Phone hash created successfully');
    
    console.log('Step 3: Finding user by phone hash...');
    const userResult = await storageService.findUser({ phoneHash });
    
    if (!userResult.success || !userResult.data) {
      console.log('User not found with this phone number');
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND);
    }
    
    const user = userResult.data;
    console.log('User found:', user.id);
    
    // Check if user has a PIN stored
    if (!user.pin) {
      console.log('User does not have a PIN set');
      return ResponseUtils.error(res, ErrorCodes.PIN_NOT_FOUND);
    }
    
    console.log('Step 4: Verifying PIN...');
    // Verify PIN (direct comparison since it's stored as plain text during signup)
    if (user.pin !== pin) {
      console.log('PIN verification failed');
      return ResponseUtils.error(res, ErrorCodes.PIN_INVALID);
    }
    
    console.log('PIN verified successfully');
    
    console.log('Step 5: Generating JWT token...');
    const token = jwt.sign(
      { 
        id: user.id, 
        walletAddress: user.walletAddress,
        phoneNumber: user.phoneNumber,
        userId: user.userId 
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    console.log('JWT token generated successfully');
    
    console.log('Step 6: Creating session...');
    await iagon.createSession({ 
      userId: user.id, 
      token, 
      expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) 
    });
    console.log('Session created successfully');
    
    console.log('=== SIGNIN DEBUG END ===');
    
    return ResponseUtils.success(res, SuccessCodes.AUTH_LOGIN_SUCCESS, {
      userId: user.userId || user.id,
      phoneNumber: user.phoneNumber,
      username: user.username,
      walletAddress: user.walletAddress,
      verificationMethod: user.verificationMethod,
      token
    });
    
  } catch (error) {
    console.error('=== SIGNIN ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END SIGNIN ERROR ===');
    
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout a user
 * @access Private
 */
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Delete session in Iagon
    await iagon.deleteSessions({ userId: req.user.id });
    return ResponseUtils.success(res, SuccessCodes.AUTH_LOGOUT_SUCCESS);
  } catch (error) {
    console.error('Logout error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    // Find user by ID using storage abstraction
    const userResult = await storageService.findUser({ userId: req.user.id });
    if (!userResult.success || !userResult.data) {
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND);
    }
    
    const user = userResult.data;
    return ResponseUtils.success(res, SuccessCodes.USER_RETRIEVED, {
      id: user.id, 
      walletAddress: user.walletAddress, 
      createdAt: user.createdAt, 
      updatedAt: user.updatedAt,
      storageUsed: userResult.storageUsed 
    });
  } catch (error) {
    console.error('Get user error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

// Initialize Blockfrost API
if (!process.env.BLOCKFROST_API_KEY) {
  throw new Error('BLOCKFROST_API_KEY environment variable is required');
}

const blockfrost = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_API_KEY,
  network: 'preprod'
});

// Initialize cache with 5 minute TTL
const walletCache = new NodeCache({ stdTTL: 300 });

// Rate limiter for wallet verification (10 requests per 5 minutes)
const walletVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: {
    success: false,
    error: 'Rate limit exceeded. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ResponseUtils.error(res, ErrorCodes.RATE_LIMIT_EXCEEDED, {
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * @route POST /api/auth/verify-wallet
 * @desc Verify wallet address and 2ADA transaction
 * @access Private
 */
router.post('/verify-wallet', authenticate, walletVerifyLimiter, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const userId = req.user.id;

    if (!walletAddress) {
      return ResponseUtils.error(res, ErrorCodes.WALLET_ADDRESS_REQUIRED);
    }

    // Check if wallet address is already in use by another user
    const existingUserResult = await storageService.findUser({ walletAddress });
    if (existingUserResult.success && existingUserResult.data && existingUserResult.data.userId !== userId) {
      return ResponseUtils.error(res, ErrorCodes.WALLET_IN_USE);
    }

    // Query blockchain for recent transactions
    const isValidTx = await verify2AdaTransaction(walletAddress);
    if (!isValidTx) {
      return ResponseUtils.error(res, ErrorCodes.TRANSACTION_NOT_FOUND, {
        message: 'No valid 2 ADA transaction found'
      });
    }

    // Update user with wallet address using storage abstraction
    const updateResult = await storageService.updateUser(userId, { walletAddress });
    if (!updateResult.success) {
      return ResponseUtils.error(res, ErrorCodes.USER_UPDATE_FAILED, {
        message: updateResult.error
      });
    }

    return ResponseUtils.success(res, SuccessCodes.WALLET_VERIFIED, {
      message: 'Wallet verified successfully'
    });
  } catch (error) {
    console.error('Wallet verification error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

/**
 * @route GET /api/auth/wallet-connect
 * @desc Get user's connected wallet address
 * @access Private
 */
router.get('/wallet-connect', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await storageService.findUser({ userId });
    
    if (!userResult.success || !userResult.data) {
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND);
    }
    
    const user = userResult.data;
    if (!user.walletAddress) {
      return ResponseUtils.error(res, ErrorCodes.WALLET_ADDRESS_NOT_FOUND);
    }
    
    return ResponseUtils.success(res, SuccessCodes.WALLET_RETRIEVED, {
      walletAddress: user.walletAddress,
      storageUsed: userResult.storageUsed
    });
  } catch (error) {
    console.error('Wallet connect error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

async function verify2AdaTransaction(walletAddress) {
  // Check cache first
  const cachedResult = walletCache.get(walletAddress);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  try {
    // Query recent transactions for this address
    const transactions = await blockfrost.addressesTransactions(walletAddress, {
      count: 10, // Check last 10 transactions
      order: 'desc'
    });

    // Check each transaction for 2 ADA pattern
    for (const tx of transactions) {
      const txDetails = await blockfrost.txs(tx.tx_hash);
      
      // Verify inputs contain at least 2 ADA from this wallet
      const hasSufficientInput = txDetails.inputs.some(
        input => input.address === walletAddress && 
                BigInt(input.amount[0].quantity) >= 2000000n // 2 ADA in lovelace
      );
      
      // Verify outputs contain exactly 2 ADA back to this wallet
      const hasExactOutput = txDetails.outputs.some(
        output => output.address === walletAddress && 
                 BigInt(output.amount[0].quantity) === 2000000n
      );

      if (hasSufficientInput && hasExactOutput) {
        // Cache positive result
        walletCache.set(walletAddress, true);
        return true;
      }
    }
    
    // Cache negative result
    walletCache.set(walletAddress, false);
    return false;
  } catch (error) {
    console.error('Blockchain query error:', error);
    return false;
  }
}

async function verify2AdaDeposit(senderWalletAddress) {
  // Check cache first
  const cacheKey = `deposit_${senderWalletAddress}`;
  const cachedResult = walletCache.get(cacheKey);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  try {
    const scriptAddress = process.env.SCRIPT_ADDRESS;
    if (!scriptAddress) {
      console.error('SCRIPT_ADDRESS not configured');
      return false;
    }

    console.log('Checking transactions from:', senderWalletAddress);
    console.log('To script address:', scriptAddress);

    // Query recent transactions from the sender wallet
    const transactions = await blockfrost.addressesTransactions(senderWalletAddress, {
      count: 20, // Check last 20 transactions
      order: 'desc'
    });

    console.log(`Found ${transactions.length} transactions to check`);

    // Check each transaction for 2 ADA deposit to script address
    for (const tx of transactions) {
      const txDetails = await blockfrost.txs(tx.tx_hash);
      
      // Check if this transaction has an input from sender wallet
      const hasInputFromSender = txDetails.inputs.some(
        input => input.address === senderWalletAddress
      );
      
      // Check if this transaction has exactly 2 ADA output to script address
      const hasOutputToScript = txDetails.outputs.some(
        output => output.address === scriptAddress && 
                 output.amount.some(asset => 
                   asset.unit === 'lovelace' && 
                   BigInt(asset.quantity) === 2000000n // 2 ADA in lovelace
                 )
      );

      if (hasInputFromSender && hasOutputToScript) {
        console.log('Valid 2 ADA deposit found, tx hash:', tx.tx_hash);
        // Cache positive result for 10 minutes
        walletCache.set(cacheKey, true, 600);
        return true;
      }
    }
    
    console.log('No valid 2 ADA deposit found');
    // Cache negative result for 2 minutes (shorter cache for negative results)
    walletCache.set(cacheKey, false, 120);
    return false;
  } catch (error) {
    console.error('Blockchain query error for deposit verification:', error);
    return false;
  }
}

/**
 * @route POST /api/auth/verify-deposit
 * @desc Verify 2 ADA deposit and initiate refund
 * @access Private
 */
router.post('/verify-deposit', verifyToken, async (req, res) => {
  try {
    const { senderWalletAddress } = req.body;
    const userId = req.user.id;

    console.log('=== DEPOSIT VERIFICATION START ===');
    console.log('User ID:', userId);
    console.log('Sender wallet address:', senderWalletAddress);

    if (!senderWalletAddress) {
      return ResponseUtils.error(res, ErrorCodes.WALLET_ADDRESS_REQUIRED);
    }

    // Get user data
    const userResult = await storageService.findUser({ userId });
    if (!userResult.success || !userResult.data) {
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND);
    }
    
    const user = userResult.data;

    console.log('Step 1: Verifying 2 ADA transaction from sender wallet...');
    // Verify 2 ADA transaction from the sender wallet to the script address
    const hasValidDeposit = await verify2AdaDeposit(senderWalletAddress);
    
    if (!hasValidDeposit) {
      console.log('No valid 2 ADA deposit found');
      return ResponseUtils.error(res, ErrorCodes.DEPOSIT_NOT_FOUND, {
        message: 'No valid 2 ADA deposit found from this wallet address'
      });
    }

    console.log('Step 2: Creating signup transaction with user data...');
    // Create the signup transaction with user's commitment data
    const commitmentData = {
      phoneHash: user.phoneHash,
      biometricHash: user.biometricHash || null,
      passkeyHash: user.passkeyHash || null
    };
    
    const txHash = await signupTxBuilder(senderWalletAddress, commitmentData);
    console.log('Signup transaction created, txHash:', txHash);

    console.log('Step 3: Updating user with transaction details...');
    // Update user with sender wallet and transaction hash
    const updateResult = await storageService.updateUser(userId, { 
      senderWalletAddress,
      txHash,
      verified: true
    });
    
    if (!updateResult.success) {
      console.log('Failed to update user:', updateResult.error);
      return ResponseUtils.error(res, ErrorCodes.USER_UPDATE_FAILED, {
        message: updateResult.error
      });
    }
    
    console.log('User updated successfully, storage used:', updateResult.storageUsed);

    console.log('Step 4: Initiating refund process...');
    // Note: The actual refund will be handled by the auto-refund monitor
    // which detects the UTXO and processes the refund automatically

    console.log('=== DEPOSIT VERIFICATION SUCCESS ===');
    return ResponseUtils.success(res, SuccessCodes.DEPOSIT_VERIFIED, {
      message: 'Deposit verified successfully. Refund will be processed automatically.',
      txHash,
      senderWalletAddress
    });
  } catch (error) {
    console.error('=== DEPOSIT VERIFICATION ERROR ===');
    console.error('Error:', error);
    console.error('=== END DEPOSIT VERIFICATION ERROR ===');
    
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

/**
 * @route POST /api/auth/verify
 * @desc Verify JWT token
 * @access Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return ResponseUtils.error(res, ErrorCodes.TOKEN_REQUIRED);
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user exists
      const userResult = await storageService.findUser({ userId: decoded.id });
      if (!userResult.success || !userResult.data) {
        return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND);
      }
      
      const user = userResult.data;

      // Check if session exists in Iagon
      const session = await iagon.findSession({ userId: decoded.id, token });
      if (!session) {
        return ResponseUtils.error(res, ErrorCodes.SESSION_INVALID);
      }

      return ResponseUtils.success(res, SuccessCodes.TOKEN_VERIFIED, {
        message: 'Token is valid',
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt
        }
      });
    } catch (jwtError) {
      return ResponseUtils.error(res, ErrorCodes.TOKEN_INVALID);
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR);
  }
});

export default router;