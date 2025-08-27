// Zero-Knowledge Proof routes for K33P Identity System (PostgreSQL Version)
import express from 'express';
import jwt from 'jsonwebtoken';
import { poseidonHash, generateZkCommitment, generateZkProof, verifyZkProof } from '../utils/zk.js';
import { hashPhone } from '../utils/hash.js';
import { verifyToken } from '../middleware/auth.js';
import pool from '../database/config.js';

const router = express.Router();

// PostgreSQL-based user lookup function
async function findUserInPostgres(query) {
  const client = await pool.connect();
  try {
    let user = null;
    
    if (query.walletAddress) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE wallet_address = $1',
        [query.walletAddress]
      );
      user = result.rows[0] || null;
    } else if (query.phoneHash) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE phone_hash = $1',
        [query.phoneHash]
      );
      user = result.rows[0] || null;
    } else if (query.userId) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE user_id = $1',
        [query.userId]
      );
      user = result.rows[0] || null;
    }
    
    return user;
  } finally {
    client.release();
  }
}

/**
 * Generate a ZK commitment from user inputs
 * @route POST /api/zk/commitment
 */
router.post('/commitment', async (req, res) => {
  try {
    const { phone, biometric, passkey } = req.body;
    
    // Validate inputs
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
    
    // Hash the inputs
    const phoneHash = poseidonHash([phone]);
    const biometricHash = poseidonHash([biometric]);
    const passkeyHash = poseidonHash([passkey]);
    
    // Generate a commitment from the hashed inputs
    const commitment = generateZkCommitment({ phoneHash, biometricHash, passkeyHash });
    
    // Return the commitment and hashes
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

/**
 * Generate a ZK proof
 * @route POST /api/zk/proof
 */
router.post('/proof', async (req, res) => {
  try {
    const { phone, biometric, passkey, commitment } = req.body;
    
    // Validate inputs
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
    
    // Generate a proof
    const proof = generateZkProof({ phone, biometric, passkey }, commitment);
    
    // Check if the proof is valid
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
    
    // Return the proof
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

/**
 * Verify a ZK proof
 * @route POST /api/zk/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { proof, commitment } = req.body;
    
    // Validate inputs
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
    
    // Validate proof structure
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
    
    // Verify the proof
    const isValid = verifyZkProof(proof, commitment);
    
    // Return the verification result
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

/**
 * Login with ZK proof (PostgreSQL Version)
 * @route POST /api/zk/login
 */
router.post('/login', async (req, res) => {
  try {
    const { walletAddress, phone, proof, commitment } = req.body;
    
    // Validate inputs
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
    
    // Find the user by wallet address or phone hash using PostgreSQL
    let user;
    try {
      if (walletAddress) {
        user = await findUserInPostgres({ walletAddress });
      } else if (phone) {
        const phoneHash = hashPhone(phone);
        user = await findUserInPostgres({ phoneHash });
      }
    } catch (error) {
      console.error('Error finding user in PostgreSQL:', error);
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
    
    // Check if the user exists
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
    
    // Verify the ZK proof
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
    
    // Check if the commitment matches the user's commitment
    // Handle the case where stored commitment has a suffix (e.g., "commitment-12345678")
    const storedCommitment = user.zkCommitment;
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
    
    // Generate a JWT token for the authenticated user
    const token = jwt.sign(
      { 
        userId: user.userId,
        walletAddress: user.walletAddress 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    // Login successful
    return res.status(200).json({
      success: true,
      data: {
        message: 'ZK login successful',
        userId: user.userId,
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

/**
 * Get a user's ZK commitment (PostgreSQL Version)
 * @route GET /api/zk/user/:userId
 */
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate inputs
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
    
    // Find the user by userId using PostgreSQL
    let user;
    try {
      user = await findUserInPostgres({ userId });
    } catch (error) {
      console.error('Error finding user in PostgreSQL:', error);
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
    
    // Check if the user exists
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
    
    // Return the user's ZK commitment
    return res.status(200).json({
      success: true,
      data: {
        userId: user.userId,
        zkCommitment: user.zkCommitment
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

/**
 * Login with phone number and PIN (Auto ZK Authentication)
 * @route POST /api/zk/login-with-pin
 */
router.post('/login-with-pin', async (req, res) => {
  try {
    const { phoneNumber, pin, biometricData, biometricType, passkeyData } = req.body;
    
    // Validate inputs - phoneNumber is required, but PIN is now optional
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required input: phoneNumber is required'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate PIN format if provided (4 digits)
    if (pin && !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PIN_FORMAT',
          message: 'PIN must be exactly 4 digits'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const client = await pool.connect();
    
    try {
      // Hash the phone number to find the user
      const phoneHash = hashPhone(phoneNumber);
      
      // Find user by phone hash and get their verification method and authentication data
      const userQuery = await client.query(
        `SELECT u.user_id as "userId", u.wallet_address as "walletAddress", u.phone_hash as "phoneHash", 
                u.zk_commitment as "zkCommitment", u.pin, ud.verification_method as "verificationMethod", 
                ud.biometric_type as "biometricType", ud.biometric_hash as "biometricHash"
         FROM users u 
         LEFT JOIN user_deposits ud ON u.user_id = ud.user_id 
         WHERE u.phone_hash = $1`,
        [phoneHash]
      );
      
      if (userQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'No user found with this phone number'
          },
          timestamp: new Date().toISOString()
        });
      }
      
      const user = userQuery.rows[0];
      
      // Authentication logic based on user's original verification method
      let authenticationSuccessful = false;
      let authMethod = '';
      
      // Check if no authentication data is provided
      if (!pin && !biometricData && !passkeyData) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_AUTH_DATA',
            message: 'At least one authentication method is required (PIN, biometric, or passkey)',
            availableMethods: {
              originalMethod: user.verificationMethod,
              biometricType: user.biometricType,
              hasPIN: !!user.pin
            }
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Try authentication with user's original verification method first
      if (user.verificationMethod === 'biometric' && biometricData && biometricType) {
        if (biometricType === user.biometricType && user.biometricHash) {
          // Import hash function for biometric verification
          const { hashBiometric } = await import('../utils/hash.js');
          const providedBiometricHash = hashBiometric(biometricData);
          
          if (providedBiometricHash === user.biometricHash) {
            authenticationSuccessful = true;
            authMethod = `${user.biometricType} biometric`;
          }
        }
      } else if (user.verificationMethod === 'pin' && pin) {
        // Verify PIN for users who originally signed up with PIN
        if (user.pin === pin) {
          authenticationSuccessful = true;
          authMethod = 'PIN';
        }
      }
      
      // If original method failed or wasn't provided, try PIN as fallback (if available)
      if (!authenticationSuccessful && pin && user.pin && user.verificationMethod !== 'pin') {
        if (user.pin === pin) {
          authenticationSuccessful = true;
          authMethod = 'PIN (fallback)';
        }
      }
      
      // If authentication failed
      if (!authenticationSuccessful) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed. Please use your original signup method or correct credentials.',
            availableMethods: {
              originalMethod: user.verificationMethod,
              biometricType: user.biometricType,
              hasPIN: !!user.pin
            }
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if user has ZK commitment
      if (!user.zkCommitment) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_ZK_COMMITMENT',
            message: 'User does not have a ZK commitment stored'
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Retrieve the user's ZK proof from the database
      const proofQuery = await client.query(
        'SELECT proof, commitment, public_inputs, is_valid FROM zk_proofs WHERE user_id = $1 AND is_valid = true ORDER BY created_at DESC LIMIT 1',
        [user.userId]
      );
      
      if (proofQuery.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_ZK_PROOF',
            message: 'No valid ZK proof found for this user'
          },
          timestamp: new Date().toISOString()
        });
      }
      
      const zkProofData = proofQuery.rows[0];
      
      // Parse the proof data if it's stored as JSON string
      let proof;
      try {
        proof = typeof zkProofData.proof === 'string' ? JSON.parse(zkProofData.proof) : zkProofData.proof;
      } catch (parseError) {
        proof = zkProofData.proof;
      }
      
      // Get the commitment from the proof or use the stored commitment
      const commitment = zkProofData.commitment || user.zkCommitment;
      
      // Verify the ZK proof
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
      
      // Check if the commitment matches the user's stored commitment
      // Handle the case where stored commitment has a suffix (e.g., "commitment-12345678")
      const storedCommitment = user.zkCommitment;
      const baseStoredCommitment = storedCommitment.includes('-') ? storedCommitment.split('-')[0] : storedCommitment;
      const baseCommitment = commitment.includes('-') ? commitment.split('-')[0] : commitment;
      
      if (baseStoredCommitment !== baseCommitment) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'COMMITMENT_MISMATCH',
            message: 'ZK commitment does not match user record'
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Generate a JWT token for the authenticated user
      const token = jwt.sign(
        { 
          userId: user.userId,
          walletAddress: user.walletAddress,
          authMethod: `zk-${authMethod.toLowerCase().replace(' ', '-')}`
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );
      
      // Login successful
      return res.status(200).json({
        success: true,
        data: {
          message: `ZK login successful using ${authMethod}`,
          userId: user.userId,
          walletAddress: user.walletAddress,
          token,
          authMethod: authMethod,
          originalVerificationMethod: user.verificationMethod
        },
        timestamp: new Date().toISOString()
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error during ZK login with PIN:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to login with ZK proof using PIN',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;