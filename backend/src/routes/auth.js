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
 * @desc Step 8: Setup username after DID creation
 * @access Public
 */
router.post('/setup-username', createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many username setup attempts, please try again later'
}), async (req, res) => {
  try {
    const { sessionId, username, userId } = req.body;
    
    // Validate required fields
    if (!sessionId || !username) {
      return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'Session ID and username are required');
    }
    
    // Validate username format
    if (username.length < 3 || username.length > 30) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_INPUT, null, 'Username must be between 3 and 30 characters');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_INPUT, null, 'Username can only contain letters, numbers, and underscores');
    }
    
    // Get session data
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return ResponseUtils.error(res, ErrorCodes.INVALID_SESSION, null, 'Invalid or expired session');
    }
    
    // Verify signup was completed
    if (sessionData.step !== 'signup_completed') {
      return ResponseUtils.error(res, ErrorCodes.INVALID_FLOW, null, 'Signup must be completed before setting up username');
    }
    
    // Check if username is already taken
    try {
      const existingUserResult = await storageService.findUser({ username });
      if (existingUserResult.success && existingUserResult.data) {
        return ResponseUtils.error(res, ErrorCodes.USERNAME_ALREADY_EXISTS, null, 'Username is already taken. Please choose a different username.');
      }
    } catch (error) {
      console.log('Error checking username availability:', error);
    }
    
    // Update user with username
    const userIdToUpdate = userId || sessionData.userId;
    if (userIdToUpdate) {
      try {
        const updateResult = await storageService.updateUser(userIdToUpdate, { username });
        if (!updateResult.success) {
          console.log('Failed to update user with username:', updateResult.error);
          return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, updateResult.error, 'Failed to save username');
        }
      } catch (error) {
        console.log('Error updating user with username:', error);
        return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to save username');
      }
    }
    
    // Update session
    sessionData.username = username;
    sessionData.step = 'username_setup';
    sessionData.completed = true;
    sessionData.timestamp = new Date();
    
    signupSessions.set(sessionId, sessionData);
    
    console.log(`Username setup completed for session: ${sessionId}`);
    
    // Generate JWT token for completed signup
    const token = jwt.sign(
      { 
        id: userIdToUpdate || crypto.randomUUID(),
        phoneNumber: sessionData.phoneNumber,
        username,
        walletAddress: sessionData.walletAddress
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    
    return ResponseUtils.success(res, SuccessCodes.USERNAME_SET, {
      sessionId,
      step: 'username_setup',
      username,
      userId: userIdToUpdate,
      walletAddress: sessionData.walletAddress,
      completed: true,
      token
    }, 'Username setup completed successfully. Welcome to K33P!');
    
    // Clean up session after successful completion
    setTimeout(() => {
      signupSessions.del(sessionId);
    }, 5000);
    
  } catch (error) {
    console.error('Error setting up username:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to setup username');
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
      // Legacy fields for backward compatibility
      walletAddress, 
      phone, 
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

    // Support both new and legacy request formats
    const finalUserAddress = userAddress || walletAddress;
    const finalPhoneHash = phoneHash || (phone ? crypto.createHash('sha256').update(phone).digest('hex') : null);
    const finalBiometricData = biometricData || biometric;

    console.log('Final processed fields:', {
      finalUserAddress,
      hasFinalPhoneHash: !!finalPhoneHash,
      hasFinalBiometricData: !!finalBiometricData,
      authMethods: authMethods?.map(m => m.type) || []
    });

    // ============================================================================
    // VALIDATION
    // ============================================================================

    // Validate required fields
    if (!finalPhoneHash) {
      console.log('Validation failed: Phone hash is required');
      return ResponseUtils.error(res, ErrorCodes.PHONE_REQUIRED, null, 'Phone hash is required');
    }

    if (!userId) {
      console.log('Validation failed: User ID is required');
      return ResponseUtils.error(res, ErrorCodes.IDENTIFIER_REQUIRED);
    }

    // Validate ZK commitment and proof (required from frontend)
    if (!zkCommitment) {
      console.log('Validation failed: ZK commitment is required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'ZK commitment is required');
    }

    if (!zkProof) {
      console.log('Validation failed: ZK proof is required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'ZK proof is required');
    }

    // Validate auth methods
    if (!authMethods || !Array.isArray(authMethods) || authMethods.length < 3) {
      console.log('Validation failed: At least 3 authentication methods are required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'At least 3 authentication methods are required');
    }

    // Validate each auth method
    for (const method of authMethods) {
      if (!method.type) {
        console.log('Validation failed: Auth method missing type');
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'All authentication methods must have a type');
      }

      if (!method.createdAt) {
        console.log('Validation failed: Auth method missing createdAt');
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'All authentication methods must have a createdAt timestamp');
      }

      // Validate specific auth method requirements
      if (method.type === 'pin' && !method.data) {
        console.log('Validation failed: PIN auth method must have data field with hashed PIN');
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'PIN authentication method must include hashed PIN data');
      }

      if (method.type === 'face' && !method.data) {
        console.log('Validation failed: Face auth method must have data field with biometric hash');
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Face authentication method must include biometric data hash');
      }

      if (method.type === 'voice' && !method.data) {
        console.log('Validation failed: Voice auth method must have data field with voice hash');
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Voice authentication method must include voice data hash');
      }

      // Validate allowed auth method types
      const allowedTypes = ['phone', 'pin', 'fingerprint', 'face', 'voice', 'iris'];
      if (!allowedTypes.includes(method.type)) {
        console.log('Validation failed: Invalid auth method type:', method.type);
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, `Invalid authentication method type: ${method.type}. Allowed types: ${allowedTypes.join(', ')}`);
      }
    }

    // User ID validation
    if (userId.length < 3 || userId.length > 50) {
      console.log('Validation failed: User ID must be 3-50 characters');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'User ID must be between 3 and 50 characters');
    }

    // Wallet address validation (if provided)
    if (finalUserAddress && finalUserAddress.length < 10) {
      console.log('Validation failed: Invalid wallet address format');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Invalid wallet address format');
    }

    // Phone hash validation (should be 64 chars for SHA-256)
    if (finalPhoneHash && finalPhoneHash.length !== 64) {
      console.log('Validation failed: Phone hash must be 64 characters (SHA-256)');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Invalid phone hash format');
    }

    if (zkCommitment) {
      const commitmentRegex = /^[a-f0-9]+-[a-f0-9]+$/;
      if (!commitmentRegex.test(zkCommitment)) {
        console.log('Validation failed: ZK commitment format invalid');
        console.log('Received commitment:', zkCommitment);
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Invalid ZK commitment format');
      }
      
      if (zkCommitment.length < 40) {
        console.log('Validation failed: ZK commitment too short');
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Invalid ZK commitment format');
      }
    }

    // ============================================================================
    // EXISTING USER CHECK
    // ============================================================================

    console.log('Step 1: Checking for existing user...');
    
    let existingUser = null;
    
    // First check by user ID
    if (userId) {
      existingUser = await dbService.getUserById(userId);
      if (existingUser) {
        console.log('Existing user found by user ID:', userId);
      }
    }
    
    // If no user found by ID, check by wallet address
    if (!existingUser && finalUserAddress) {
      existingUser = await dbService.getUserByWalletAddress(finalUserAddress);
      if (existingUser) {
        console.log('Existing user found by wallet address:', finalUserAddress);
      }
    }

    if (existingUser) {
      console.log('Existing user found - updating with new data');
      
      // ============================================================================
      // UPDATE EXISTING USER
      // ============================================================================

      // Prepare updates for existing user
      const updates = {
        phone_hash: finalPhoneHash,
        zk_commitment: zkCommitment,  // ✅ Use frontend-provided commitment
        verification_method: verificationMethod,
        biometric_type: biometricType || null,
        sender_wallet_address: senderWalletAddress || null,
        auth_methods: authMethods, // ✅ Use provided auth methods
        updated_at: new Date()
      };
      
      // Update PIN hash if provided separately
      if (pinHash) {
        updates.pin_hash = pinHash;
      }

      // Update wallet address if provided and different
      if (finalUserAddress && finalUserAddress !== existingUser.wallet_address) {
        updates.wallet_address = finalUserAddress;
      }

      console.log('Updating existing user with data:', {
        ...updates,
        auth_methods: authMethods.map(m => ({ type: m.type, hasData: !!m.data }))
      });
      
      const updatedUser = await dbService.updateUser(existingUser.user_id, updates);
      
      if (!updatedUser) {
        console.log('Failed to update existing user');
        return ResponseUtils.error(res, ErrorCodes.USER_CREATION_FAILED, null, 'Failed to update existing user');
      }

      console.log('Existing user updated successfully');

      // ============================================================================
      // STORE ZK PROOF FOR EXISTING USER
      // ============================================================================

      console.log('Storing ZK proof for user update...');
      try {
        // Store the frontend-provided ZK proof
        await dbService.createZKProof({
          user_id: existingUser.user_id,
          commitment: zkCommitment,
          proof: zkProof,
          public_inputs: {
            phoneHash: finalPhoneHash,
            userAddress: finalUserAddress,
            verificationMethod,
            isUpdate: true,
            timestamp: new Date().toISOString()
          },
          is_valid: true // Assuming frontend validates the proof
        });
        
        console.log('ZK proof stored for user update successfully');
      } catch (zkError) {
        console.error('Failed to store ZK proof for user update:', zkError);
      }

      // ============================================================================
      // PROCESS REFUND FOR EXISTING USER
      // ============================================================================

      console.log('Processing 2 ADA refund for existing user...');
      try {
        const k33pManager = new EnhancedK33PManagerDB();
        await k33pManager.initialize();
        
        // Determine refund address (priority: senderWalletAddress > finalUserAddress > existing wallet_address)
        const refundAddress = senderWalletAddress || finalUserAddress || existingUser.wallet_address;
        
        if (refundAddress) {
          const refundResult = await k33pManager.processRefund(refundAddress, {
            userId: existingUser.user_id,
            reason: 'Existing user signup update',
            zkCommitment: zkCommitment,
            zkProof: zkProof
          });
          
          if (refundResult.success) {
            console.log('2 ADA refund processed successfully for existing user:', refundResult.txHash);
          } else {
            console.log('Refund processing failed but continuing:', refundResult.error);
          }
        } else {
          console.log('No refund address available for existing user');
        }
      } catch (refundError) {
        console.error('Error processing refund for existing user:', refundError);
        // Continue with signup even if refund fails
      }

      // ============================================================================
      // GENERATE JWT TOKEN FOR UPDATED USER
      // ============================================================================

      console.log('Generating JWT token for updated user...');
      const token = jwt.sign(
        { 
          id: existingUser.id, 
          userId: existingUser.user_id,
          walletAddress: finalUserAddress || existingUser.wallet_address,
          authMethods: authMethods.map(m => m.type) // ✅ Include auth methods in token
        },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );

      console.log('JWT token generated successfully');

      // ============================================================================
      // BUILD SUCCESS RESPONSE FOR EXISTING USER
      // ============================================================================

      const response = {
        success: true,
        data: {
          verified: existingUser.verified || false,
          userId: existingUser.user_id,
          verificationMethod,
          authMethods: authMethods, // ✅ Return full auth methods array
          message: 'User account updated successfully. Your refund has been processed.',
          depositAddress: finalUserAddress || existingUser.wallet_address,
          isUpdate: true,
          zkCommitment: zkCommitment, // ✅ Return the commitment
          requiresDeposit: verificationMethod === 'phone'
        },
        message: 'User account updated successfully. Your refund has been processed.',
        token
      };

      console.log('=== SIGNUP DEBUG END (Existing User) ===');
      return ResponseUtils.success(res, SuccessCodes.USER_UPDATED, response.data, response.message);
    }

    // ============================================================================
    // CREATE NEW USER
    // ============================================================================

    console.log('Step 2: Creating new user with DatabaseService...');

    // Create new user with frontend-provided ZK commitment
    const newUser = await dbService.createUser({
      userId: userId,
      walletAddress: finalUserAddress,
      phoneNumber: null,
      phoneHash: finalPhoneHash,
      pinHash: pinHash,
      zkCommitment: zkCommitment, 
      authMethods: authMethods, 
      folders: [],
      verificationMethod: verificationMethod,
      biometricType: biometricType,
      senderWalletAddress: senderWalletAddress
    });

    console.log('User created successfully with ID:', newUser.user_id);
    console.log('Auth methods saved:', authMethods.map(m => m.type));

    // ============================================================================
    // STORE ZK PROOF FOR NEW USER
    // ============================================================================

    console.log('Storing ZK proof for new user...');
    try {
      // Store the frontend-provided ZK proof
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
        is_valid: true // Assuming frontend validates the proof
      });
      
      console.log('ZK proof stored for new user successfully');
    } catch (zkError) {
      console.error('Failed to store ZK proof for new user:', zkError);
      
    }

    // ============================================================================
    // GENERATE JWT TOKEN FOR NEW USER
    // ============================================================================

    console.log('Generating JWT token for new user...');
    const token = jwt.sign(
      { 
        id: newUser.id, 
        userId: newUser.user_id,
        walletAddress: newUser.wallet_address,
        authMethods: authMethods.map(m => m.type) 
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    console.log('JWT token generated successfully');

    // ============================================================================
    // BUILD SUCCESS RESPONSE FOR NEW USER
    // ============================================================================

    const response = {
      success: true,
      data: {
        verified: verificationMethod === 'phone' ? false : true, 
        userId: newUser.user_id,
        verificationMethod,
        authMethods: authMethods, 
        message: 'DID created successfully. Welcome to K33P!',
        depositAddress: finalUserAddress,
        requiresDeposit: verificationMethod === 'phone',
        zkCommitment: zkCommitment
      },
      message: 'DID created successfully. Welcome to K33P!',
      token
    };

    console.log('Response built successfully');
    console.log('=== SIGNUP DEBUG END (New User) ===');
    return ResponseUtils.success(res, SuccessCodes.USER_CREATED, response.data, response.message);

  } catch (error) {
    console.error('=== SIGNUP ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END SIGNUP ERROR ===');
    
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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