/**
 * Account Recovery Routes for K33P Backend
 * Handles various account recovery strategies including emergency contacts,
 * backup phrases, onchain proofs, and multi-factor authentication
 */

import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { Pool } from 'pg';
import { EnhancedK33PManagerDB } from '../enhanced-k33p-manager-db.js';
import crypto from 'crypto';
import { dbService } from '../database/service.js';
import nodemailer from 'nodemailer';

const router = express.Router();
const pool = new Pool();
const k33pManager = new EnhancedK33PManagerDB();

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface RecoveryRequest {
  id: string;
  userId?: string;
  phoneNumber?: string;
  email?: string;
  recoveryMethod: 'emergency_contact' | 'backup_phrase' | 'onchain_proof' | 'multi_factor';
  newPhoneNumber: string;
  verificationData: any;
  timestamp: Date;
  status: 'pending' | 'verified' | 'completed' | 'failed' | 'expired';
  attempts: number;
  expiresAt: Date;
}

interface BackupPhrase {
  userId: string;
  phraseHash: string;
  salt: string;
  createdAt: Date;
  lastUsed?: Date;
}

interface EmergencyContact {
  userId: string;
  email: string;
  name: string;
  relationship: string;
  verified: boolean;
  createdAt: Date;
}

// ============================================================================
// IN-MEMORY STORAGE (Replace with Redis in production)
// ============================================================================

const recoveryRequests = new Map<string, RecoveryRequest>();
const emergencyTokens = new Map<string, { userId: string; email: string; expiresAt: Date }>();
const backupPhraseAttempts = new Map<string, { attempts: number; lastAttempt: Date }>();

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

const validateRecoveryInit = [
  body('identifier')
    .notEmpty()
    .withMessage('Phone number or email is required'),
  body('recoveryMethod')
    .isIn(['emergency_contact', 'backup_phrase', 'onchain_proof', 'multi_factor'])
    .withMessage('Invalid recovery method'),
  body('newPhoneNumber')
    .isMobilePhone('any')
    .withMessage('Valid new phone number is required')
];

const validateBackupPhrase = [
  body('recoveryId')
    .isUUID()
    .withMessage('Valid recovery ID is required'),
  body('backupPhrase')
    .isLength({ min: 12 })
    .withMessage('Backup phrase must be at least 12 words')
];

const validateEmergencyContact = [
  body('recoveryId')
    .isUUID()
    .withMessage('Valid recovery ID is required'),
  body('emergencyToken')
    .isUUID()
    .withMessage('Valid emergency token is required')
];

const validateOnchainProof = [
  body('recoveryId')
    .isUUID()
    .withMessage('Valid recovery ID is required'),
  body('txHash')
    .isLength({ min: 64, max: 64 })
    .withMessage('Valid transaction hash is required'),
  body('walletAddress')
    .notEmpty()
    .withMessage('Wallet address is required')
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateRecoveryId = (): string => {
  return crypto.randomUUID();
};

const generateEmergencyToken = (): string => {
  return crypto.randomUUID();
};

const hashPhone = (phoneNumber: string): string => {
  return crypto.createHash('sha256').update(phoneNumber + process.env.PHONE_SALT || 'default-salt').digest('hex');
};

const hashBackupPhrase = (phrase: string, salt: string): string => {
  return crypto.createHash('sha256').update(phrase + salt).digest('hex');
};

const generateSalt = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

const sendEmergencyEmail = async (email: string, token: string, userName: string): Promise<boolean> => {
  try {
    // Configure email transporter (use your preferred email service)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const recoveryLink = `${process.env.FRONTEND_URL}/recovery/emergency?token=${token}`;
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@k33p.io',
      to: email,
      subject: 'K33P Account Recovery Request',
      html: `
        <h2>Account Recovery Request</h2>
        <p>Hello ${userName},</p>
        <p>A recovery request has been initiated for a K33P account. If this was you, please click the link below to proceed:</p>
        <p><a href="${recoveryLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Recovery Request</a></p>
        <p>This link will expire in 30 minutes.</p>
        <p>If you did not request this recovery, please ignore this email.</p>
        <p>Best regards,<br>K33P Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Emergency recovery email sent to ${email}`);
    return true;
  } catch (error) {
    logger.error('Error sending emergency email:', error);
    return false;
  }
};

const findUserByIdentifier = async (identifier: string): Promise<any> => {
  try {
    const client = await pool.connect();
    
    // Try to find by phone hash first
    const phoneHash = hashPhone(identifier);
    let result = await client.query(
      'SELECT * FROM users WHERE phone_hash = $1',
      [phoneHash]
    );
    
    if (result.rows.length === 0) {
      // Try to find by email
      result = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [identifier]
      );
    }
    
    client.release();
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error finding user by identifier:', error);
    return null;
  }
};

const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

const handleAsyncRoute = (fn: Function) => {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================================================
// ACCOUNT RECOVERY ROUTES
// ============================================================================

/**
 * POST /api/recovery/initiate
 * Initiate account recovery process
 */
router.post('/initiate',
  validateRecoveryInit,
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const { identifier, recoveryMethod, newPhoneNumber } = req.body;
      
      logger.info(`Recovery initiation for identifier: ${identifier.substring(0, 4)}...`);
      
      // Find user by phone number or email
      const user = await findUserByIdentifier(identifier);
      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({
          success: true,
          message: 'If an account exists with this identifier, recovery instructions have been sent',
          data: { recoveryMethod }
        });
      }
      
      const recoveryId = generateRecoveryId();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      
      const recoveryRequest: RecoveryRequest = {
        id: recoveryId,
        userId: user.user_id,
        phoneNumber: identifier.startsWith('+') ? identifier : undefined,
        email: identifier.includes('@') ? identifier : user.email,
        recoveryMethod,
        newPhoneNumber,
        verificationData: {},
        timestamp: new Date(),
        status: 'pending',
        attempts: 0,
        expiresAt
      };
      
      recoveryRequests.set(recoveryId, recoveryRequest);
      
      switch (recoveryMethod) {
        case 'emergency_contact':
          // Get emergency contact from database
          const client = await pool.connect();
          const emergencyResult = await client.query(
            'SELECT * FROM emergency_contacts WHERE user_id = $1 AND verified = true',
            [user.user_id]
          );
          client.release();
          
          if (emergencyResult.rows.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'No verified emergency contact found',
              error: 'NO_EMERGENCY_CONTACT'
            });
          }
          
          const emergencyContact = emergencyResult.rows[0];
          const emergencyToken = generateEmergencyToken();
          emergencyTokens.set(emergencyToken, {
            userId: user.user_id,
            email: emergencyContact.email,
            expiresAt
          });
          
          await sendEmergencyEmail(emergencyContact.email, emergencyToken, emergencyContact.name);
          
          res.json({
            success: true,
            message: 'Recovery email sent to emergency contact',
            data: {
              recoveryId,
              recoveryMethod,
              emergencyContactEmail: emergencyContact.email.replace(/(.{2}).*(@.*)/, '$1***$2')
            }
          });
          break;
          
        case 'backup_phrase':
          res.json({
            success: true,
            message: 'Please provide your backup phrase',
            data: {
              recoveryId,
              recoveryMethod,
              expiresAt
            }
          });
          break;
          
        case 'onchain_proof':
          const depositAddress = process.env.RECOVERY_DEPOSIT_ADDRESS || process.env.DEPOSIT_ADDRESS;
          res.json({
            success: true,
            message: 'Send transaction from your registered wallet to prove ownership',
            data: {
              recoveryId,
              recoveryMethod,
              depositAddress,
              requiredAmount: '2000000', // 2 ADA
              expiresAt
            }
          });
          break;
          
        case 'multi_factor':
          // Combine multiple methods for enhanced security
          res.json({
            success: true,
            message: 'Multi-factor recovery initiated. You will need to complete multiple verification steps',
            data: {
              recoveryId,
              recoveryMethod,
              requiredSteps: ['backup_phrase', 'emergency_contact'],
              expiresAt
            }
          });
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid recovery method',
            error: 'INVALID_METHOD'
          });
      }
      
    } catch (error: any) {
      logger.error('Error initiating recovery:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate recovery',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * POST /api/recovery/verify-backup-phrase
 * Verify backup phrase for account recovery
 */
router.post('/verify-backup-phrase',
  validateBackupPhrase,
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const { recoveryId, backupPhrase } = req.body;
      
      const recoveryRequest = recoveryRequests.get(recoveryId);
      if (!recoveryRequest) {
        return res.status(404).json({
          success: false,
          message: 'Recovery request not found or expired',
          error: 'INVALID_RECOVERY_ID'
        });
      }
      
      if (recoveryRequest.expiresAt < new Date()) {
        recoveryRequests.delete(recoveryId);
        return res.status(400).json({
          success: false,
          message: 'Recovery request expired',
          error: 'RECOVERY_EXPIRED'
        });
      }
      
      // Check rate limiting
      const attemptKey = `${recoveryRequest.userId}_backup_phrase`;
      const attempts = backupPhraseAttempts.get(attemptKey) || { attempts: 0, lastAttempt: new Date(0) };
      
      if (attempts.attempts >= 3 && new Date().getTime() - attempts.lastAttempt.getTime() < 15 * 60 * 1000) {
        return res.status(429).json({
          success: false,
          message: 'Too many attempts. Please try again in 15 minutes',
          error: 'RATE_LIMITED'
        });
      }
      
      // Get stored backup phrase hash
      const client = await pool.connect();
      const result = await client.query(
        'SELECT phrase_hash, salt FROM backup_phrases WHERE user_id = $1',
        [recoveryRequest.userId]
      );
      client.release();
      
      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No backup phrase found for this account',
          error: 'NO_BACKUP_PHRASE'
        });
      }
      
      const { phrase_hash, salt } = result.rows[0];
      const providedPhraseHash = hashBackupPhrase(backupPhrase.trim().toLowerCase(), salt);
      
      attempts.attempts++;
      attempts.lastAttempt = new Date();
      backupPhraseAttempts.set(attemptKey, attempts);
      
      if (providedPhraseHash !== phrase_hash) {
        return res.status(400).json({
          success: false,
          message: 'Invalid backup phrase',
          error: 'INVALID_BACKUP_PHRASE',
          attemptsRemaining: Math.max(0, 3 - attempts.attempts)
        });
      }
      
      // Backup phrase verified
      recoveryRequest.status = 'verified';
      recoveryRequest.verificationData.backupPhraseVerified = true;
      recoveryRequests.set(recoveryId, recoveryRequest);
      
      // Clear rate limiting
      backupPhraseAttempts.delete(attemptKey);
      
      if (recoveryRequest.recoveryMethod === 'backup_phrase') {
        // Single method recovery - complete the process
        await completeRecovery(recoveryRequest);
        
        res.json({
          success: true,
          message: 'Account recovery completed successfully',
          data: {
            recoveryId,
            newPhoneHash: hashPhone(recoveryRequest.newPhoneNumber),
            timestamp: new Date()
          }
        });
      } else {
        // Multi-factor recovery - continue to next step
        res.json({
          success: true,
          message: 'Backup phrase verified. Please complete additional verification steps',
          data: {
            recoveryId,
            nextStep: 'emergency_contact',
            progress: '1/2'
          }
        });
      }
      
    } catch (error: any) {
      logger.error('Error verifying backup phrase:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify backup phrase',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * POST /api/recovery/verify-emergency-contact
 * Verify emergency contact token
 */
router.post('/verify-emergency-contact',
  validateEmergencyContact,
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const { recoveryId, emergencyToken } = req.body;
      
      const recoveryRequest = recoveryRequests.get(recoveryId);
      if (!recoveryRequest) {
        return res.status(404).json({
          success: false,
          message: 'Recovery request not found or expired',
          error: 'INVALID_RECOVERY_ID'
        });
      }
      
      const tokenData = emergencyTokens.get(emergencyToken);
      if (!tokenData || tokenData.userId !== recoveryRequest.userId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired emergency token',
          error: 'INVALID_TOKEN'
        });
      }
      
      if (tokenData.expiresAt < new Date()) {
        emergencyTokens.delete(emergencyToken);
        return res.status(400).json({
          success: false,
          message: 'Emergency token expired',
          error: 'TOKEN_EXPIRED'
        });
      }
      
      // Emergency contact verified
      recoveryRequest.status = 'verified';
      recoveryRequest.verificationData.emergencyContactVerified = true;
      recoveryRequests.set(recoveryId, recoveryRequest);
      
      // Clean up token
      emergencyTokens.delete(emergencyToken);
      
      if (recoveryRequest.recoveryMethod === 'emergency_contact') {
        // Single method recovery - complete the process
        await completeRecovery(recoveryRequest);
        
        res.json({
          success: true,
          message: 'Account recovery completed successfully',
          data: {
            recoveryId,
            newPhoneHash: hashPhone(recoveryRequest.newPhoneNumber),
            timestamp: new Date()
          }
        });
      } else {
        // Multi-factor recovery - check if all steps completed
        const allStepsCompleted = recoveryRequest.verificationData.backupPhraseVerified && 
                                 recoveryRequest.verificationData.emergencyContactVerified;
        
        if (allStepsCompleted) {
          await completeRecovery(recoveryRequest);
          
          res.json({
            success: true,
            message: 'Multi-factor recovery completed successfully',
            data: {
              recoveryId,
              newPhoneHash: hashPhone(recoveryRequest.newPhoneNumber),
              timestamp: new Date()
            }
          });
        } else {
          res.json({
            success: true,
            message: 'Emergency contact verified. Please complete remaining verification steps',
            data: {
              recoveryId,
              progress: '1/2'
            }
          });
        }
      }
      
    } catch (error: any) {
      logger.error('Error verifying emergency contact:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify emergency contact',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * POST /api/recovery/verify-onchain
 * Verify onchain proof for account recovery
 */
router.post('/verify-onchain',
  validateOnchainProof,
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const { recoveryId, txHash, walletAddress } = req.body;
      
      const recoveryRequest = recoveryRequests.get(recoveryId);
      if (!recoveryRequest) {
        return res.status(404).json({
          success: false,
          message: 'Recovery request not found or expired',
          error: 'INVALID_RECOVERY_ID'
        });
      }
      
      if (recoveryRequest.expiresAt < new Date()) {
        recoveryRequests.delete(recoveryId);
        return res.status(400).json({
          success: false,
          message: 'Recovery request expired',
          error: 'RECOVERY_EXPIRED'
        });
      }
      
      // Verify that the wallet address belongs to the user
      const user = await dbService.getUserById(recoveryRequest.userId!);
      if (!user || user.wallet_address !== walletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address does not match user account',
          error: 'WALLET_MISMATCH'
        });
      }
      
      // Verify transaction using K33P manager
      const verificationResult = await k33pManager.verifyTransactionByWalletAddress(
        walletAddress,
        2000000n // 2 ADA
      );
      
      if (!verificationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Transaction verification failed',
          error: 'INVALID_TRANSACTION',
          details: verificationResult.error
        });
      }
      
      // Onchain proof verified
      recoveryRequest.status = 'verified';
      recoveryRequest.verificationData.onchainProofVerified = true;
      recoveryRequest.verificationData.txHash = txHash;
      recoveryRequests.set(recoveryId, recoveryRequest);
      
      // Complete recovery
      await completeRecovery(recoveryRequest);
      
      res.json({
        success: true,
        message: 'Account recovery completed successfully via blockchain verification',
        data: {
          recoveryId,
          newPhoneHash: hashPhone(recoveryRequest.newPhoneNumber),
          txHash,
          timestamp: new Date()
        }
      });
      
    } catch (error: any) {
      logger.error('Error verifying onchain proof:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify onchain proof',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * GET /api/recovery/status/:recoveryId
 * Get recovery request status
 */
router.get('/status/:recoveryId',
  param('recoveryId').isUUID().withMessage('Valid recovery ID is required'),
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const { recoveryId } = req.params;
      
      const recoveryRequest = recoveryRequests.get(recoveryId);
      if (!recoveryRequest) {
        return res.status(404).json({
          success: false,
          message: 'Recovery request not found',
          error: 'INVALID_RECOVERY_ID'
        });
      }
      
      res.json({
        success: true,
        data: {
          recoveryId,
          status: recoveryRequest.status,
          recoveryMethod: recoveryRequest.recoveryMethod,
          timestamp: recoveryRequest.timestamp,
          expiresAt: recoveryRequest.expiresAt,
          verificationData: {
            backupPhraseVerified: recoveryRequest.verificationData.backupPhraseVerified || false,
            emergencyContactVerified: recoveryRequest.verificationData.emergencyContactVerified || false,
            onchainProofVerified: recoveryRequest.verificationData.onchainProofVerified || false
          }
        }
      });
      
    } catch (error: any) {
      logger.error('Error getting recovery status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recovery status',
        error: 'SERVER_ERROR'
      });
    }
  })
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Complete the recovery process by updating the user's phone number
 */
async function completeRecovery(recoveryRequest: RecoveryRequest): Promise<void> {
  try {
    const newPhoneHash = hashPhone(recoveryRequest.newPhoneNumber);
    
    // Update user's phone number
    await dbService.updateUser(recoveryRequest.userId!, {
      phone_hash: newPhoneHash,
      updated_at: new Date()
    });
    
    // Update recovery request status
    recoveryRequest.status = 'completed';
    recoveryRequests.set(recoveryRequest.id, recoveryRequest);
    
    // Log the recovery
    logger.info(`Account recovery completed for user: ${recoveryRequest.userId}`);
    
    // Update last used timestamp for backup phrase if used
    if (recoveryRequest.verificationData.backupPhraseVerified) {
      const client = await pool.connect();
      await client.query(
        'UPDATE backup_phrases SET last_used = CURRENT_TIMESTAMP WHERE user_id = $1',
        [recoveryRequest.userId]
      );
      client.release();
    }
    
  } catch (error) {
    logger.error('Error completing recovery:', error);
    throw error;
  }
}

export default router;