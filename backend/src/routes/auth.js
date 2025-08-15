// Authentication routes for K33P Identity System
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyToken, verifyZkProof, authenticate } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { K33PError, ErrorCodes, asyncHandler } from '../middleware/error-handler.js';
import { ResponseUtils } from '../utils/response-helpers.js';
import { hashPhone, hashBiometric, hashPasskey } from '../utils/hash.js';
import { generateZkCommitment, generateZkProof, verifyZkProof as verifyZkProofUtil } from '../utils/zk.js';
import { signupTxBuilder } from '../utils/lucid.js';
import * as iagon from '../utils/iagon.js';
import { storageService } from '../services/storage-abstraction.js';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { sendOtp, verifyOtp } from '../utils/firebase.js';

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
    ResponseUtils.success(res, {
      requestId: result.requestId,
      expiresIn: 300 // 5 minutes
    }, 'OTP sent successfully');
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many PIN setup attempts, please try again later'
}), async (req, res) => {
  try {
    const { phoneNumber, pin, sessionId } = req.body;
    
    // Validate required fields
    if (!phoneNumber || !pin) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone number and PIN are required' 
      });
    }
    
    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ 
        success: false,
        error: 'PIN must be exactly 4 digits' 
      });
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
    
    res.json({
      success: true,
      message: 'PIN setup completed successfully',
      data: {
        sessionId: sessionKey,
        step: 'pin_setup',
        nextStep: 'pin_confirmation'
      }
    });
    
  } catch (error) {
    console.error('Error setting up PIN:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to setup PIN' 
    });
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
      return res.status(400).json({ 
        success: false,
        error: 'Session ID and PIN are required' 
      });
    }
    
    // Get session data
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired session' 
      });
    }
    
    // Verify PIN matches
    if (sessionData.pin !== pin) {
      return res.status(400).json({ 
        success: false,
        error: 'PIN confirmation does not match. Please try again.' 
      });
    }
    
    // Update session
    sessionData.pinConfirmed = true;
    sessionData.step = 'pin_confirmed';
    sessionData.timestamp = new Date();
    
    signupSessions.set(sessionId, sessionData);
    
    console.log(`PIN confirmed for session: ${sessionId}`);
    
    res.json({
      success: true,
      message: 'PIN confirmed successfully',
      data: {
        sessionId,
        step: 'pin_confirmed',
        nextStep: 'biometric_setup'
      }
    });
    
  } catch (error) {
    console.error('Error confirming PIN:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to confirm PIN' 
    });
  }
});

/**
 * @route POST /api/auth/setup-biometric
 * @desc Step 6: Setup biometric authentication (Face ID, Fingerprint, Voice ID, Iris Scan)
 * @access Public
 */
router.post('/setup-biometric', createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many biometric setup attempts, please try again later'
}), async (req, res) => {
  try {
    const { sessionId, biometricType, biometricData } = req.body;
    
    // Validate required fields
    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        error: 'Session ID is required' 
      });
    }
    
    // Get session data
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired session' 
      });
    }
    
    // Verify PIN was confirmed
    if (!sessionData.pinConfirmed) {
      return res.status(400).json({ 
        success: false,
        error: 'PIN must be confirmed before setting up biometric authentication' 
      });
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
    
    res.json({
      success: true,
      message: biometricType ? `${biometricType} setup completed successfully` : 'Biometric setup skipped',
      data: {
        sessionId,
        step: 'biometric_setup',
        biometricType: biometricType || null,
        nextStep: 'did_creation'
      }
    });
    
  } catch (error) {
    console.error('Error setting up biometric:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to setup biometric authentication' 
    });
  }
});

/**
 * @route POST /api/auth/complete-signup
 * @desc Step 7: Complete signup with DID creation and ZK proof generation
 * @access Public
 */
router.post('/complete-signup', createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many signup completion attempts, please try again later'
}), async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Validate required fields
    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        error: 'Session ID is required' 
      });
    }
    
    // Get session data
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired session' 
      });
    }
    
    // Verify biometric setup was completed
    if (sessionData.step !== 'biometric_setup') {
      return res.status(400).json({ 
        success: false,
        error: 'Biometric setup must be completed before finalizing signup' 
      });
    }
    
    // Prepare user data for signup
    const userData = {
      phoneNumber: sessionData.phoneNumber,
      pin: sessionData.pin,
      biometricType: sessionData.biometricType,
      biometricData: sessionData.biometricData,
      verificationMethod: 'pin' // Default verification method
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
        
        res.json({
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
    res.status(500).json({ 
      success: false,
      error: 'Failed to complete signup' 
    });
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
      return res.status(400).json({ 
        success: false,
        error: 'Session ID and username are required' 
      });
    }
    
    // Validate username format
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ 
        success: false,
        error: 'Username must be between 3 and 30 characters' 
      });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        success: false,
        error: 'Username can only contain letters, numbers, and underscores' 
      });
    }
    
    // Get session data
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired session' 
      });
    }
    
    // Verify signup was completed
    if (sessionData.step !== 'signup_completed') {
      return res.status(400).json({ 
        success: false,
        error: 'Signup must be completed before setting up username' 
      });
    }
    
    // Check if username is already taken
    try {
      const existingUserResult = await storageService.findUser({ username });
      if (existingUserResult.success && existingUserResult.data) {
        return res.status(400).json({ 
          success: false,
          error: 'Username is already taken. Please choose a different username.' 
        });
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
          return res.status(500).json({ 
            success: false,
            error: 'Failed to save username' 
          });
        }
      } catch (error) {
        console.log('Error updating user with username:', error);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to save username' 
        });
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
    
    res.json({
      success: true,
      message: 'Username setup completed successfully. Welcome to K33P!',
      data: {
        sessionId,
        step: 'username_setup',
        username,
        userId: userIdToUpdate,
        walletAddress: sessionData.walletAddress,
        completed: true
      },
      token
    });
    
    // Clean up session after successful completion
    setTimeout(() => {
      signupSessions.del(sessionId);
    }, 5000);
    
  } catch (error) {
    console.error('Error setting up username:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to setup username' 
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
      return res.status(400).json({ 
        success: false,
        error: 'Session ID is required' 
      });
    }
    
    const sessionData = signupSessions.get(sessionId);
    if (!sessionData) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found or expired' 
      });
    }
    
    // Return session status without sensitive data
    res.json({
      success: true,
      data: {
        sessionId,
        step: sessionData.step,
        phoneNumber: sessionData.phoneNumber ? sessionData.phoneNumber.replace(/.(?=.{4})/g, '*') : null,
        pinConfirmed: sessionData.pinConfirmed || false,
        biometricType: sessionData.biometricType || null,
        username: sessionData.username || null,
        completed: sessionData.completed || false,
        timestamp: sessionData.timestamp
      }
    });
    
  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get session status' 
    });
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
      return res.status(400).json({ 
        success: false,
        error: 'Request ID and verification code are required' 
      });
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
      res.status(400).json({
        success: false,
        error: result.error || 'Invalid or expired OTP'
      });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify OTP' 
    });
  }
});

/**
 * Handle signup logic for all authentication methods
 */
async function handleSignup(req, res, defaultVerificationMethod = null, defaultBiometricType = null) {
  try {
    console.log('=== SIGNUP DEBUG START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Environment variables check:');
    console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
    console.log('- JWT_EXPIRATION:', process.env.JWT_EXPIRATION || 'NOT SET (using default)');
    console.log('- BLOCKFROST_API_KEY:', process.env.BLOCKFROST_API_KEY ? 'SET' : 'NOT SET');
    
    const { 
      userAddress, 
      userId, 
      phoneNumber, 
      username,
      senderWalletAddress, 
      pin, 
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
      phoneNumber, 
      senderWalletAddress, 
      verificationMethod,
      biometricType,
      walletAddress, 
      phone,
      hasPasskey: !!passkey,
      hasBiometric: !!biometric,
      hasBiometricData: !!biometricData
    });

    // Support both new and legacy request formats
    const finalUserAddress = userAddress || walletAddress;
    const finalPhoneNumber = phoneNumber || phone;
    const finalBiometricData = biometricData || biometric;

    console.log('Final processed fields:', {
      finalUserAddress,
      finalPhoneNumber,
      hasFinalBiometricData: !!finalBiometricData
    });

    // Validate required fields
    if (!finalPhoneNumber) {
      console.log('Validation failed: Phone number is required');
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!userId && !passkey) {
      console.log('Validation failed: User ID or passkey is required');
      return res.status(400).json({ error: 'User ID or passkey is required' });
    }
    if (username && (username.length < 3 || username.length > 30)) {
      console.log('Validation failed: Username must be 3-30 characters');
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }
    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      console.log('Validation failed: Username contains invalid characters');
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    
    // Validate verification method specific requirements
    if (verificationMethod === 'pin' && !pin) {
      console.log('Validation failed: PIN is required for PIN verification');
      return res.status(400).json({ error: 'PIN is required for PIN verification method' });
    }
    if (verificationMethod === 'pin' && !/^\d{4}$/.test(pin)) {
      console.log('Validation failed: PIN must be 4 digits');
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }
    if (verificationMethod === 'biometric' && !finalBiometricData) {
      console.log('Validation failed: Biometric data is required for biometric verification');
      return res.status(400).json({ error: 'Biometric data is required for biometric verification method' });
    }
    if (verificationMethod === 'biometric' && !biometricType) {
      console.log('Validation failed: Biometric type is required for biometric verification');
      return res.status(400).json({ error: 'Biometric type is required for biometric verification method' });
    }
    if (verificationMethod === 'biometric' && !['fingerprint', 'faceid', 'voice', 'iris'].includes(biometricType)) {
      console.log('Validation failed: Invalid biometric type');
      return res.status(400).json({ error: 'Biometric type must be one of: fingerprint, faceid, voice, iris' });
    }
    if (verificationMethod === 'passkey' && !passkey) {
      console.log('Validation failed: Passkey is required for passkey verification');
      return res.status(400).json({ error: 'Passkey is required for passkey verification method' });
    }

    console.log('Step 1: Hashing phone...');
    const phoneHash = hashPhone(finalPhoneNumber);
    console.log('Phone hash created successfully');

    console.log('Step 2: Hashing biometric data...');
    const biometricHash = finalBiometricData ? hashBiometric(finalBiometricData) : null;
    console.log('Biometric hash created:', !!biometricHash);

    console.log('Step 3: Hashing passkey...');
    const passkeyHash = passkey ? hashPasskey(passkey) : null;
    console.log('Passkey hash created:', !!passkeyHash);

    console.log('Step 4: Checking existing user by phone...');
    const existingUserResult = await storageService.findUser({ phoneHash });
    console.log('Existing user check completed, found:', !!existingUserResult.data);
    
    if (existingUserResult.success && existingUserResult.data) {
      console.log('Existing user found - updating with new ZK commitment and processing refund');
      
      const existingUser = existingUserResult.data;
      
      // Generate new ZK commitment and proof for existing user
      console.log('Step 4.1: Generating new ZK commitment for existing user...');
      const newCommitmentData = { phoneHash };
      if (biometricHash) newCommitmentData.biometricHash = biometricHash;
      if (passkeyHash) newCommitmentData.passkeyHash = passkeyHash;
      
      const newZkCommitment = generateZkCommitment(newCommitmentData);
      console.log('New ZK commitment generated successfully');

      console.log('Step 4.2: Generating new ZK proof for existing user...');
      const newProofData = { phone: finalPhoneNumber };
      if (finalBiometricData) newProofData.biometric = finalBiometricData;
      if (passkey) newProofData.passkey = passkey;
      
      const newZkProof = generateZkProof(newProofData, newZkCommitment);
      console.log('New ZK proof generated, valid:', newZkProof.isValid);
      
      if (!newZkProof.isValid) {
        console.log('New ZK proof validation failed');
        return res.status(400).json({ error: 'Invalid ZK proof for existing user update' });
      }

      // Update existing user with new data
      console.log('Step 4.3: Updating existing user with new ZK commitment...');
      const updateData = {
        zkCommitment: newZkCommitment,
        verificationMethod,
        biometricType: biometricType || null,
        senderWalletAddress: senderWalletAddress || null,
        phoneNumber: finalPhoneNumber, // Update actual phone number
        updatedAt: new Date()
      };
      
      if (biometricHash) updateData.biometricHash = biometricHash;
      if (passkeyHash) updateData.passkeyHash = passkeyHash;
      if (pin) updateData.pin = pin;
      if (finalUserAddress) updateData.walletAddress = finalUserAddress;
      if (username) updateData.username = username; // Update username if provided

      const updateResult = await storageService.updateUser(existingUser.id, updateData);
      if (!updateResult.success) {
        console.log('Failed to update existing user:', updateResult.error);
        return res.status(500).json({ error: 'Failed to update existing user: ' + updateResult.error });
      }
      
      console.log('Existing user updated successfully');

      // Process 2 ADA refund for existing user
      console.log('Step 4.4: Processing 2 ADA refund for existing user...');
      try {
        // Import the enhanced K33P manager for refund processing
        const { EnhancedK33PManagerDB } = await import('../enhanced-k33p-manager-db.js');
        const k33pManager = new EnhancedK33PManagerDB();
        
        // Determine refund address (priority: senderWalletAddress > finalUserAddress > existing walletAddress)
        const refundAddress = senderWalletAddress || finalUserAddress || existingUser.walletAddress;
        
        if (refundAddress) {
          const refundResult = await k33pManager.processRefund(refundAddress, {
            userId: existingUser.userId || existingUser.id,
            reason: 'Existing user signup update',
            zkCommitment: newZkCommitment,
            zkProof: newZkProof
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

      // Store new ZK proof using ZK Proof Service
      console.log('Step 4.5: Storing new ZK proof for existing user...');
      try {
        const { ZKProofService } = await import('../services/zk-proof-service');
        
        await ZKProofService.generateAndStoreUserZKProof({
          userId: existingUser.userId || existingUser.id,
          phoneNumber: finalPhoneNumber,
          biometricData: finalBiometricData,
          passkeyData: passkey,
          userAddress: finalUserAddress,
          additionalData: {
            verificationMethod,
            biometricType,
            senderWalletAddress,
            isUpdate: true
          }
        });
        
        console.log('New ZK proof stored for existing user successfully');
      } catch (zkError) {
        console.error('Failed to store new ZK proof for existing user:', zkError);
      }
      
      // Generate JWT token for updated existing user
      const token = jwt.sign(
        { id: existingUser.id, walletAddress: finalUserAddress || existingUser.walletAddress },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );
      
      return res.status(200).json({
        success: true,
        data: {
          verified: existingUser.verified || false,
          userId: existingUser.userId || existingUser.id,
          verificationMethod,
          message: 'User account updated successfully. Your refund has been processed.',
          depositAddress: finalUserAddress || existingUser.walletAddress,
          isUpdate: true
        },
        message: 'User account updated successfully. Your refund has been processed.',
        token
      });
    }

    // If user address is provided, check if it's already in use
    if (finalUserAddress) {
      console.log('Step 5: Checking existing user by wallet address...');
      const existingWalletUserResult = await storageService.findUser({ walletAddress: finalUserAddress });
      console.log('Existing wallet user check completed, found:', !!existingWalletUserResult.data);
      
      if (existingWalletUserResult.success && existingWalletUserResult.data) {
        console.log('User already exists with this wallet address');
        return res.status(400).json({ 
          success: false,
          error: 'This wallet address is already registered with another account. Please use a different wallet or contact support if this is your wallet.',
          code: 'WALLET_IN_USE'
        });
      }
    }

    console.log('Step 6: Generating ZK commitment...');
    const commitmentData = { phoneHash };
    if (biometricHash) commitmentData.biometricHash = biometricHash;
    if (passkeyHash) commitmentData.passkeyHash = passkeyHash;
    
    const zkCommitment = generateZkCommitment(commitmentData);
    console.log('ZK commitment generated successfully');

    console.log('Step 7: Generating ZK proof...');
    const proofData = { phone: finalPhoneNumber };
    if (finalBiometricData) proofData.biometric = finalBiometricData;
    if (passkey) proofData.passkey = passkey;
    
    const zkProof = generateZkProof(proofData, zkCommitment);
    console.log('ZK proof generated, valid:', zkProof.isValid);
    
    if (!zkProof.isValid) {
      console.log('ZK proof validation failed');
      return res.status(400).json({ error: 'Invalid ZK proof' });
    }

    // Note: Transaction creation happens later when user sends 2 ADA for verification
    // No transaction is created during initial signup

    console.log('Step 8: Creating user in storage...');
    const userData = {
      walletAddress: finalUserAddress || null,
      phoneHash,
      phoneNumber: finalPhoneNumber, // Store actual phone number
      username: username || null, // Store username
      zkCommitment,
      userId: userId || crypto.randomUUID(),
      verificationMethod,
      biometricType: biometricType || null,
      senderWalletAddress: senderWalletAddress || null
    };
    
    if (biometricHash) userData.biometricHash = biometricHash;
    if (passkeyHash) userData.passkeyHash = passkeyHash;
    if (pin) userData.pin = pin;

    const userResult = await storageService.storeUser(userData);
    if (!userResult.success) {
      console.log('Failed to create user:', userResult.error);
      return res.status(500).json({ error: 'Failed to create user: ' + userResult.error });
    }
    
    const user = { id: userResult.data.id, ...userData };
    console.log('User created successfully, ID:', user.id, 'Storage:', userResult.storageUsed);

    console.log('Step 8.1: Storing ZK proof using ZK Proof Service...');
    try {
      // Import ZK Proof Service
      const { ZKProofService } = await import('../services/zk-proof-service');
      
      // Generate and store comprehensive ZK proof
      await ZKProofService.generateAndStoreUserZKProof({
        userId: userData.userId,
        phoneNumber: finalPhoneNumber,
        biometricData: finalBiometricData,
        passkeyData: passkey,
        userAddress: finalUserAddress,
        additionalData: {
          verificationMethod,
          biometricType,
          senderWalletAddress
        }
      });
      
      console.log('ZK proof stored using ZK Proof Service successfully');
    } catch (zkError) {
      console.error('Failed to store ZK proof using ZK Proof Service:', zkError);
      // Don't fail the signup if ZK proof storage fails, just log it
    }

    console.log('Step 9: Generating JWT token...');
    const token = jwt.sign(
      { id: user.id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    console.log('JWT token generated successfully');

    console.log('Step 10: Creating session...');
    await iagon.createSession({ 
      userId: user.id, 
      token, 
      expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) 
    });
    console.log('Session created successfully');

    console.log('Step 11: Building response...');
    const response = {
      success: true,
      data: {
        verified: verificationMethod === 'phone' ? false : true,
        userId: userId || user.id,
        verificationMethod,
        message: 'DID created successfully. Welcome to K33P!',
        depositAddress: finalUserAddress
      },
      message: 'DID created successfully. Welcome to K33P!',
      token
    };

    console.log('Response built successfully');
    console.log('=== SIGNUP DEBUG END ===');
    res.status(201).json(response);
  } catch (error) {
    console.error('=== SIGNUP ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END SIGNUP ERROR ===');
    
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
}



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
      return res.status(400).json({ error: 'At least one identifier is required: phone, username, or walletAddress' });
    }
    
    if (!proof || !commitment) {
      return res.status(400).json({ error: 'Missing required fields: proof and commitment are required' });
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
      return res.status(404).json({ error: 'User not found' });
    }
    // Verify ZK proof (simulated)
    if (user.zkCommitment !== commitment) {
      return res.status(401).json({ error: 'Invalid ZK proof' });
    }
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    // Create session in Iagon
    await iagon.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) });
    res.status(200).json({ message: 'Login successful', token, hasWallet: !!user.walletAddress });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
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
      return res.status(400).json({ 
        success: false,
        error: 'Phone number is required' 
      });
    }
    
    if (!otpRequestId) {
      console.log('Validation failed: OTP request ID is required');
      return res.status(400).json({ 
        success: false,
        error: 'OTP request ID is required' 
      });
    }
    
    if (!otpCode) {
      console.log('Validation failed: OTP code is required');
      return res.status(400).json({ 
        success: false,
        error: 'OTP code is required' 
      });
    }
    
    if (!pin) {
      console.log('Validation failed: PIN is required');
      return res.status(400).json({ 
        success: false,
        error: 'PIN is required' 
      });
    }
    
    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      console.log('Validation failed: PIN must be 4 digits');
      return res.status(400).json({ 
        success: false,
        error: 'PIN must be exactly 4 digits' 
      });
    }
    
    // Validate OTP code format (5 digits)
    if (!/^\d{5}$/.test(otpCode)) {
      console.log('Validation failed: OTP code must be 5 digits');
      return res.status(400).json({ 
        success: false,
        error: 'OTP code must be exactly 5 digits' 
      });
    }
    
    console.log('Step 1: Verifying OTP...');
    const otpVerification = await verifyOtp(otpRequestId, otpCode);
    
    if (!otpVerification.success) {
      console.log('OTP verification failed:', otpVerification.error);
      return res.status(400).json({ 
        success: false,
        error: otpVerification.error || 'Invalid or expired OTP' 
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
      return res.status(404).json({ 
        success: false,
        error: 'User not found with this phone number' 
      });
    }
    
    const user = userResult.data;
    console.log('User found:', user.id);
    
    // Check if user has a PIN stored
    if (!user.pin) {
      console.log('User does not have a PIN set');
      return res.status(400).json({ 
        success: false,
        error: 'No PIN found for this user. Please contact support.' 
      });
    }
    
    console.log('Step 4: Verifying PIN...');
    // Verify PIN (direct comparison since it's stored as plain text during signup)
    if (user.pin !== pin) {
      console.log('PIN verification failed');
      return res.status(401).json({ 
        success: false,
        error: 'Invalid PIN. Please try again.' 
      });
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
    
    res.status(200).json({
      success: true,
      message: 'Sign in successful',
      data: {
        userId: user.userId || user.id,
        phoneNumber: user.phoneNumber,
        username: user.username,
        walletAddress: user.walletAddress,
        verificationMethod: user.verificationMethod
      },
      token
    });
    
  } catch (error) {
    console.error('=== SIGNIN ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END SIGNIN ERROR ===');
    
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
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
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
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
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.data;
    res.status(200).json({ 
      id: user.id, 
      walletAddress: user.walletAddress, 
      createdAt: user.createdAt, 
      updatedAt: user.updatedAt,
      storageUsed: userResult.storageUsed 
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
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
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      timestamp: new Date().toISOString()
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
      return res.status(400).json({ message: 'Wallet address is required' });
    }

    // Check if wallet address is already in use by another user
    const existingUserResult = await storageService.findUser({ walletAddress });
    if (existingUserResult.success && existingUserResult.data && existingUserResult.data.userId !== userId) {
      return res.status(400).json({ message: 'Wallet address already in use by another user' });
    }

    // Query blockchain for recent transactions
    const isValidTx = await verify2AdaTransaction(walletAddress);
    if (!isValidTx) {
      return res.status(400).json({ message: 'No valid 2 ADA transaction found' });
    }

    // Update user with wallet address using storage abstraction
    const updateResult = await storageService.updateUser(userId, { walletAddress });
    if (!updateResult.success) {
      return res.status(500).json({ message: 'Failed to update user wallet address: ' + updateResult.error });
    }

    res.json({ message: 'Wallet verified successfully' });
  } catch (error) {
    console.error('Wallet verification error:', error);
    res.status(500).json({ message: 'Wallet verification failed', error: error.message });
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
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.data;
    if (!user.walletAddress) {
      return res.status(400).json({ message: 'No wallet address found' });
    }
    
    res.json({ 
      walletAddress: user.walletAddress,
      storageUsed: userResult.storageUsed 
    });
  } catch (error) {
    console.error('Wallet connect error:', error);
    res.status(500).json({ message: 'Wallet connect failed', error: error.message });
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
      return res.status(400).json({ 
        success: false,
        error: 'Sender wallet address is required' 
      });
    }

    // Get user data
    const userResult = await storageService.findUser({ userId });
    if (!userResult.success || !userResult.data) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    const user = userResult.data;

    console.log('Step 1: Verifying 2 ADA transaction from sender wallet...');
    // Verify 2 ADA transaction from the sender wallet to the script address
    const hasValidDeposit = await verify2AdaDeposit(senderWalletAddress);
    
    if (!hasValidDeposit) {
      console.log('No valid 2 ADA deposit found');
      return res.status(400).json({ 
        success: false,
        error: 'No valid 2 ADA deposit found from this wallet address' 
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
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update user: ' + updateResult.error
      });
    }
    
    console.log('User updated successfully, storage used:', updateResult.storageUsed);

    console.log('Step 4: Initiating refund process...');
    // Note: The actual refund will be handled by the auto-refund monitor
    // which detects the UTXO and processes the refund automatically

    console.log('=== DEPOSIT VERIFICATION SUCCESS ===');
    res.status(200).json({ 
      success: true,
      message: 'Deposit verified successfully. Refund will be processed automatically.',
      txHash,
      senderWalletAddress
    });
  } catch (error) {
    console.error('=== DEPOSIT VERIFICATION ERROR ===');
    console.error('Error:', error);
    console.error('=== END DEPOSIT VERIFICATION ERROR ===');
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify deposit',
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
      return res.status(400).json({ 
        success: false,
        error: 'Token is required' 
      });
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user exists
      const userResult = await storageService.findUser({ userId: decoded.id });
      if (!userResult.success || !userResult.data) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      const user = userResult.data;

      // Check if session exists in Iagon
      const session = await iagon.findSession({ userId: decoded.id, token });
      if (!session) {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid session' 
        });
      }

      res.status(200).json({ 
        success: true,
        message: 'Token is valid',
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt
        }
      });
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or expired token' 
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify token' 
    });
  }
});

export default router;