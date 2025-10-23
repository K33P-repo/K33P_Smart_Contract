import express from 'express';
import jwt from 'jsonwebtoken';
import { poseidonHash, generateZkCommitment, generateZkProof, verifyZkProof } from '../utils/zk.js';
import { hashPhone } from '../utils/hash.js';
import { verifyToken } from '../middleware/auth.js';
import ZKProofService from '../services/zk-proof-service.js';

const ResponseUtils = {
  success: (res, code, data, message) => {
    return res.status(200).json({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    });
  },
  error: (res, code, data, message) => {
    return res.status(400).json({
      success: false,
      error: {
        code,
        message,
        ...data
      },
      timestamp: new Date().toISOString()
    });
  }
};

const ErrorCodes = {
  PHONE_REQUIRED: 'PHONE_REQUIRED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  SERVER_ERROR: 'SERVER_ERROR',
  PIN_REQUIRED: 'PIN_REQUIRED',
  BIOMETRIC_DATA_REQUIRED: 'BIOMETRIC_DATA_REQUIRED',
  INVALID_PIN: 'INVALID_PIN'
};

const SuccessCodes = {
  USER_FOUND: 'USER_FOUND',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  PIN_CONFIRMED: 'PIN_CONFIRMED'
};

const router = express.Router();

async function findUserInPostgres(query) {
  if (query.walletAddress) {
    return await ZKProofService.getUserByWalletAddress(query.walletAddress);
  } else if (query.phoneHash) {
    return await ZKProofService.getUserByPhoneHash(query.phoneHash);
  } else if (query.userId) {
    return await ZKProofService.getUserById(query.userId);
  }
  return null;
}

router.post('/confirm-pin', async (req, res) => {
  try {
    console.log('=== CONFIRM PIN DEBUG START ===');
    const { phoneHash, pinHash } = req.body;

    console.log('Request body:', { 
      phoneHash: phoneHash ? `${phoneHash.substring(0, 20)}...` : null,
      pinHash: pinHash ? `${pinHash.substring(0, 20)}...` : null
    });

    if (!phoneHash) {
      console.log('Validation failed: Phone encrypted data is required');
      return ResponseUtils.error(res, ErrorCodes.PHONE_REQUIRED);
    }

    if (!pinHash) {
      console.log('Validation failed: PIN encrypted data is required');
      return ResponseUtils.error(res, ErrorCodes.PIN_REQUIRED);
    }

    console.log('Finding user by phone hash...');
    const user = await ZKProofService.getUserByPhoneHash(phoneHash);
    
    if (!user) {
      console.log('No user found with this phone encrypted data');
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND);
    }

    console.log('User found:', {
      userId: user.user_id,
      hasStoredPinHash: !!user.pin_hash
    });

    if (!user.pin_hash) {
      console.log('User does not have a PIN stored');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'User does not have a PIN registered');
    }

    console.log('Comparing provided PIN hash with stored PIN hash...');
    console.log('Provided PIN hash:', pinHash.substring(0, 20) + '...');
    console.log('Stored PIN hash:', user.pin_hash.substring(0, 20) + '...');

    const pinMatches = user.pin_hash === pinHash;

    console.log('PIN comparison result:', pinMatches);

    if (!pinMatches) {
      console.log('PIN confirmation failed - hashes do not match');
      return ResponseUtils.error(res, ErrorCodes.INVALID_PIN, null, 'Invalid PIN');
    }

    console.log('PIN confirmed successfully, generating JWT token...');
    
    const token = jwt.sign(
      { 
        id: user.id, 
        userId: user.user_id,
        walletAddress: user.wallet_address,
        authMethods: user.auth_methods?.map(m => m.type) || [],
        verificationMethod: user.verification_method,
        zkCommitment: user.zk_commitment
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    console.log('JWT token generated successfully');

    const responseData = {
      verified: true,
      userId: user.user_id,
      walletAddress: user.wallet_address,
      authMethods: user.auth_methods?.map(m => m.type) || [],
      zkCommitment: user.zk_commitment,
      verificationMethod: user.verification_method,
      requiresDeposit: user.verification_method === 'phone',
      message: 'PIN confirmed successfully',
      token: token
    };

    console.log('=== CONFIRM PIN DEBUG END ===');
    return ResponseUtils.success(res, SuccessCodes.PIN_CONFIRMED, responseData, 'PIN confirmed successfully');

  } catch (error) {
    console.error('=== CONFIRM PIN ERROR ===');
    console.error('Error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

router.post('/commitment', async (req, res) => {
  try {
    const { phone, biometric, passkey } = req.body;
    
    if (!phone || !biometric || !passkey) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required inputs: phone, biometric, and passkey are required'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const phoneHash = poseidonHash([phone]);
    const biometricHash = poseidonHash([biometric]);
    const passkeyHash = poseidonHash([passkey]);
    
    const commitment = generateZkCommitment({ phoneHash, biometricHash, passkeyHash });
    
    return res.status(200).json({
      success: true,
      data: {
        commitment,
        hashes: {
          phoneHash,
          biometricHash,
          passkeyHash
        }
      },
      message: 'ZK commitment generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating ZK commitment:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate ZK commitment'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/proof', async (req, res) => {
  try {
    const { phone, biometric, passkey, commitment } = req.body;
    
    if (!phone || !biometric || !passkey || !commitment) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required inputs: phone, biometric, passkey, and commitment are required'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const proof = generateZkProof({ phone, biometric, passkey }, commitment);
    
    if (!proof.isValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ZK_VERIFICATION_FAILED',
          message: 'Failed to generate a valid ZK proof',
          details: proof.error || 'Unknown error'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({
      success: true,
      data: proof,
      message: 'ZK proof generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating ZK proof:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate ZK proof'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { proof, commitment } = req.body;
    
    if (!proof || !commitment) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required inputs: proof and commitment are required'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    if (!proof.publicInputs || !proof.publicInputs.commitment || typeof proof.isValid !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PROOF_STRUCTURE',
          message: 'Invalid proof object structure. Expected: { publicInputs: { commitment: string }, isValid: boolean }'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const isValid = verifyZkProof(proof, commitment);
    
    return res.status(200).json({
      success: true,
      data: {
        isValid
      },
      message: isValid ? 'ZK proof verified successfully' : 'ZK proof verification failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error verifying ZK proof:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify ZK proof'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { walletAddress, phone, proof, commitment } = req.body;
    
    if (!proof || !commitment) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required inputs: proof and commitment are required'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    if (!walletAddress && !phone) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Either walletAddress or phone must be provided'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    let user;
    try {
      if (walletAddress) {
        user = await findUserInPostgres({ walletAddress });
      } else if (phone) {
        const phoneHash = hashPhone(phone);
        user = await findUserInPostgres({ phoneHash });
      }
    } catch (error) {
      console.error('Error finding user:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to find user in database',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const isValid = verifyZkProof(proof, commitment);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ZK_VERIFICATION_FAILED',
          message: 'ZK proof verification failed'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const storedCommitment = user.zk_commitment;
    const baseStoredCommitment = storedCommitment.includes('-') ? storedCommitment.split('-')[0] : storedCommitment;
    
    if (baseStoredCommitment !== commitment) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid commitment for this user'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const token = jwt.sign(
      { 
        userId: user.user_id,
        walletAddress: user.wallet_address 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      success: true,
      data: {
        message: 'ZK login successful',
        userId: user.user_id,
        token
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during ZK login:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to login with ZK proof',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required parameter: userId'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    let user;
    try {
      user = await findUserInPostgres({ userId });
    } catch (error) {
      console.error('Error finding user:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to find user in database',
          details: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        userId: user.user_id,
        zkCommitment: user.zk_commitment
      },
      message: 'User ZK commitment retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving user ZK commitment:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve user ZK commitment'
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/find-user', async (req, res) => {
  try {
    console.log('=== FIND USER DEBUG START ===');
    const { phoneHash } = req.body;

    console.log('Request body:', { phoneHash });

    if (!phoneHash) {
      console.log('Validation failed: Phone encrypted data is required');
      return ResponseUtils.error(res, ErrorCodes.PHONE_REQUIRED);
    }

    console.log('Finding user by phone hash...');
    
    const user = await ZKProofService.getUserByPhoneHash(phoneHash);
    
    if (!user) {
      console.log('No user found with this phone encrypted data');
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND, null, 'No user found');
    }

    console.log('User found:', {
      userId: user.user_id,
      walletAddress: user.wallet_address,
      verificationMethod: user.verification_method,
      hasAuthMethods: !!user.auth_methods,
      authMethodCount: user.auth_methods?.length || 0,
      hasZkCommitment: !!user.zk_commitment
    });

    const authMethods = user.auth_methods?.map(method => ({
      type: method.type,
      data: method.data,
      createdAt: method.createdAt,
      lastUsed: method.lastUsed || method.createdAt
    })) || [];

    console.log('Available auth methods:', authMethods.map(m => ({
      type: m.type,
      hasData: !!m.data,
      createdAt: m.createdAt
    })));

    const responseData = {
      userId: user.user_id,
      walletAddress: user.wallet_address,
      verificationMethod: user.verification_method,
      zkCommitment: user.zk_commitment,
      authMethods: authMethods,
      registeredAuthMethods: authMethods.map(m => m.type),
      requiresDeposit: user.verification_method === 'phone',
      isVerified: user.verified || false,
      message: 'User found successfully'
    };

    console.log('Response data prepared:', {
      userId: responseData.userId,
      authMethodCount: responseData.authMethods.length,
      hasZkCommitment: !!responseData.zkCommitment,
      requiresDeposit: responseData.requiresDeposit
    });

    console.log('=== FIND USER DEBUG END ===');
    return ResponseUtils.success(res, SuccessCodes.USER_FOUND, responseData, 'User found successfully');

  } catch (error) {
    console.error('=== FIND USER ERROR ===');
    console.error('Error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

router.post('/login-with-pin', async (req, res) => {
  try {
    console.log('=== LOGIN DEBUG START ===');
    const { 
      phoneHash,
      authMethod, 
      pinHash,
      biometricHash, 
      biometricType,
      authMethods
    } = req.body;

    console.log('Request body:', { 
      phoneHash: phoneHash ? `${phoneHash.substring(0, 20)}...` : null,
      authMethod, 
      hasPinHash: !!pinHash,
      hasBiometricHash: !!biometricHash,
      biometricType,
      authMethodsCount: authMethods?.length || 0
    });

    // Log detailed auth methods
    if (authMethods) {
      console.log('Provided auth methods:');
      authMethods.forEach((method, index) => {
        console.log(`  [${index}] type: ${method.type}, data: ${method.data ? `${method.data.substring(0, 20)}...` : 'undefined'}, hasData: ${!!method.data}`);
      });
    }

    if (!phoneHash) {
      console.log('Validation failed: Phone encrypted data is required');
      return ResponseUtils.error(res, ErrorCodes.PHONE_REQUIRED);
    }

    if (!authMethod) {
      console.log('Validation failed: Authentication method is required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Authentication method is required');
    }

    if (!authMethods || !Array.isArray(authMethods) || authMethods.length !== 3) {
      console.log('Validation failed: Exactly 3 authentication methods are required');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Exactly 3 authentication methods are required for verification');
    }

    if (authMethod === 'pin' && !pinHash) {
      console.log('Validation failed: PIN encrypted data is required for PIN authentication');
      return ResponseUtils.error(res, ErrorCodes.PIN_REQUIRED);
    }

    console.log('Finding user by phone hash...');
    const user = await ZKProofService.getUserByPhoneHash(phoneHash);
    
    if (!user) {
      console.log('No user found with this phone encrypted data');
      return ResponseUtils.error(res, ErrorCodes.USER_NOT_FOUND);
    }

    console.log('User found:', {
      userId: user.user_id,
      walletAddress: user.wallet_address,
      storedAuthMethodsCount: user.auth_methods?.length || 0
    });

    // Log stored auth methods
    if (user.auth_methods) {
      console.log('Stored auth methods:');
      user.auth_methods.forEach((method, index) => {
        console.log(`  [${index}] type: ${method.type}, data: ${method.data ? `${method.data.substring(0, 20)}...` : 'undefined'}, hasData: ${!!method.data}`);
      });
    }

    if (!user.auth_methods || user.auth_methods.length !== 3) {
      console.log('User auth methods configuration invalid');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'User authentication configuration is invalid');
    }

    console.log('Validating provided auth methods against stored methods...');
    
    const storedAuthMethods = user.auth_methods;
    let authMethodsMatch = true;
    const methodComparison = [];

    for (let i = 0; i < 3; i++) {
      const providedMethod = authMethods[i];
      const storedMethod = storedAuthMethods[i];
      
      // For fingerprint, don't compare data field
      const isFingerprint = providedMethod.type === 'fingerprint' && storedMethod.type === 'fingerprint';
      
      const typeMatch = providedMethod.type === storedMethod.type;
      const createdAtMatch = providedMethod.createdAt === storedMethod.createdAt;
      
      // For fingerprint, only check type and createdAt
      // For other methods, also check data
      let dataMatch = true;
      if (!isFingerprint) {
        dataMatch = providedMethod.data === storedMethod.data;
      }
      
      const methodMatch = typeMatch && dataMatch && createdAtMatch;
      
      methodComparison.push({
        type: providedMethod.type,
        storedType: storedMethod.type,
        dataMatch: dataMatch,
        createdAtMatch: createdAtMatch,
        overallMatch: methodMatch,
        isFingerprint: isFingerprint
      });

      if (!methodMatch) {
        authMethodsMatch = false;
        console.log(`Method mismatch at index ${i}:`, {
          provided: { type: providedMethod.type, hasData: !!providedMethod.data },
          stored: { type: storedMethod.type, hasData: !!storedMethod.data },
          isFingerprint: isFingerprint
        });
      }
    }

    console.log('Auth methods comparison:', methodComparison);

    if (!authMethodsMatch) {
      console.log('Authentication methods do not match stored methods');
      return ResponseUtils.error(res, ErrorCodes.AUTHENTICATION_FAILED, null, 'Authentication methods verification failed');
    }

    console.log('Authenticating with specific method:', authMethod);
    
    const userAuthMethod = storedAuthMethods.find(method => method.type === authMethod);
    if (!userAuthMethod) {
      console.log('User does not have this authentication method registered');
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, `User does not have ${authMethod} authentication method registered`);
    }

    console.log('Found user auth method:', {
      type: userAuthMethod.type,
      hasData: !!userAuthMethod.data,
      data: userAuthMethod.data ? `${userAuthMethod.data.substring(0, 20)}...` : 'undefined'
    });

    let authenticationSuccessful = false;
    let authDetails = {};

    switch (authMethod) {
      case 'pin':
        if (pinHash) {
          // For PIN, we need stored data to compare
          if (!userAuthMethod.data) {
            console.log('Stored PIN data is undefined for user');
            return ResponseUtils.error(res, ErrorCodes.AUTHENTICATION_FAILED, null, 'PIN authentication not properly configured');
          }
          
          authenticationSuccessful = userAuthMethod.data === pinHash;
          console.log('PIN comparison:', {
            storedPin: userAuthMethod.data ? `${userAuthMethod.data.substring(0, 20)}...` : 'undefined',
            providedPin: pinHash ? `${pinHash.substring(0, 20)}...` : 'undefined',
            match: authenticationSuccessful
          });
          
          authDetails = { 
            method: 'pin', 
            usedFallback: false,
            verified: authenticationSuccessful 
          };
        }
        break;

      case 'face':
      case 'voice':
        if (biometricHash) {
          // For face/voice, we need stored data to compare
          if (!userAuthMethod.data) {
            console.log('Stored biometric data is undefined for user');
            return ResponseUtils.error(res, ErrorCodes.AUTHENTICATION_FAILED, null, 'Biometric authentication not properly configured');
          }
          authenticationSuccessful = userAuthMethod.data === biometricHash;
          authDetails = { 
            method: authMethod, 
            type: biometricType,
            verified: authenticationSuccessful 
          };
        }
        break;

      case 'fingerprint':
        // For fingerprint, no data comparison needed - rely on device verification
        authenticationSuccessful = true;
        authDetails = { 
          method: 'fingerprint', 
          deviceVerified: true,
          verified: true 
        };
        console.log('Fingerprint authentication - device level verification');
        break;

      case 'iris':
        authenticationSuccessful = true;
        authDetails = { 
          method: 'iris', 
          deviceVerified: true,
          verified: true 
        };
        break;

      case 'phone':
        authenticationSuccessful = true;
        authDetails = { 
          method: 'phone', 
          requiresAdditionalVerification: true,
          verified: true 
        };
        break;

      default:
        console.log('Unsupported authentication method:', authMethod);
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Unsupported authentication method');
    }

    if (!authenticationSuccessful) {
      console.log('Authentication failed for method:', authMethod);
      return ResponseUtils.error(res, ErrorCodes.AUTHENTICATION_FAILED, null, `Authentication failed using ${authMethod}`);
    }

    console.log('Authentication successful, generating JWT token...');
    
    const token = jwt.sign(
      { 
        id: user.id, 
        userId: user.user_id,
        walletAddress: user.wallet_address,
        authMethod: authMethod,
        authMethods: storedAuthMethods.map(m => m.type),
        verificationMethod: user.verification_method,
        zkCommitment: user.zk_commitment,
        authDetails: authDetails
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    console.log('JWT token generated successfully');

    const responseData = {
      verified: true,
      userId: user.user_id,
      walletAddress: user.wallet_address,
      authMethod: authMethod,
      authDetails: authDetails,
      authMethods: storedAuthMethods, 
      zkCommitment: user.zk_commitment,
      verificationMethod: user.verification_method,
      requiresDeposit: user.verification_method === 'phone',
      message: `Login successful using ${authMethod}`,
      token: token
    };

    console.log('=== LOGIN DEBUG END ===');
    return ResponseUtils.success(res, SuccessCodes.LOGIN_SUCCESS, responseData, `Login successful using ${authMethod}`);

  } catch (error) {
    console.error('=== LOGIN ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, {
      message: error.message
    });
  }
});

export default router;