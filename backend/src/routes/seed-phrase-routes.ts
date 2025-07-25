/**
 * Seed Phrase Storage and NOK Access Routes for K33P
 * Handles secure storage of 12/24-word seed phrases on Iagon and NOK inheritance
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { SeedPhraseStorageService } from '../services/seed-phrase-storage.js';

import { authenticateToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { auditLogger } from '../middleware/audit-logger.js';
import { Pool } from 'pg';
import { EnhancedK33PManagerDB } from '../enhanced-k33p-manager-db.js';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        [key: string]: any;
      };
    }
  }
}

const router = express.Router();
const pool = new Pool();
const k33pManager = new EnhancedK33PManagerDB();
const seedPhraseService = new SeedPhraseStorageService();
// NOK service instances removed

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Validation middleware
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// ============================================================================
// SEED PHRASE STORAGE ROUTES
// ============================================================================

/**
 * Store a new seed phrase on Iagon
 * POST /api/seed-phrases/store
 */
router.post('/store',
  authenticateToken,
  createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 }), // 3 requests per hour
  [
    body('walletName')
      .isLength({ min: 1, max: 100 })
      .withMessage('Wallet name must be between 1 and 100 characters'),
    body('walletType')
      .isIn(['cardano', 'bitcoin', 'ethereum', 'solana', 'other'])
      .withMessage('Invalid wallet type'),
    body('mnemonicType')
      .isIn(['12-word', '24-word'])
      .withMessage('Mnemonic type must be either 12-word or 24-word'),
    body('seedPhrase')
      .isLength({ min: 10 })
      .withMessage('Seed phrase is required'),
    body('encryptionPassword')
      .isLength({ min: 8 })
      .withMessage('Encryption password must be at least 8 characters'),
    // Removed NOK access validation fields
  ],
  handleValidationErrors,
  auditLogger('STORE', 'SEED_PHRASE'),
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const {
        walletName,
        walletType,
        mnemonicType,
        seedPhrase,
        encryptionPassword
      } = req.body;

      const result = await seedPhraseService.storeSeedPhrase(
        userId,
        walletName,
        seedPhrase,
        walletType
      );

      res.status(201).json({
        success: true,
        message: 'Seed phrase stored successfully',
        data: {
          seedPhraseId: result.id,
          walletName,
          walletType,
          mnemonicType: result.mnemonicType
        }
      });
    } catch (error) {
      console.error('Error storing seed phrase:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to store seed phrase',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get user's stored seed phrases (metadata only)
 * GET /api/seed-phrases
 */
router.get('/',
  authenticateToken,
  auditLogger('LIST', 'SEED_PHRASE'),
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const seedPhrases = await seedPhraseService.getUserSeedPhrases(userId);

      res.json({
        success: true,
        data: seedPhrases.map(sp => ({
          id: sp.id,
          walletName: sp.walletName,
          walletType: sp.walletType,
          mnemonicType: sp.mnemonicType,
          createdAt: sp.createdAt,
          lastAccessed: sp.lastAccessed
        }))
      });
    } catch (error) {
      console.error('Error fetching seed phrases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch seed phrases',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Retrieve a specific seed phrase (owner only)
 * POST /api/seed-phrases/:id/retrieve
 */
router.post('/:id/retrieve',
  authenticateToken,
  createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 }), // 3 requests per hour
  [
    param('id').isUUID().withMessage('Invalid seed phrase ID'),
    body('encryptionPassword')
      .isLength({ min: 8 })
      .withMessage('Encryption password is required')
  ],
  handleValidationErrors,
  auditLogger('RETRIEVE', 'SEED_PHRASE'),
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      const seedPhraseId = req.params.id;
      const { encryptionPassword } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const result = await seedPhraseService.retrieveSeedPhrase(
        seedPhraseId,
        userId,
        encryptionPassword
      );

      res.json({
        success: true,
        message: 'Seed phrase retrieved successfully',
        data: {
          seedPhrase: result.seedPhrase,
          walletName: result.walletName,
          walletType: result.walletType,
          mnemonicType: result.mnemonicType
        }
      });
    } catch (error) {
      console.error('Error retrieving seed phrase:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve seed phrase',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);



// NOK access requests route removed

// Inheritance monitoring routes removed

export default router;