/**
 * Image Number Routes for K33P Backend
 * Handles user image number management (profile avatar selection)
 * Image numbers: 1, 2, or 3 (for different avatar styles)
 */

import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { UserModel } from '../database/models.js';

const router = express.Router();

// Extend Express Request interface to include user property
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
// VALIDATION MIDDLEWARE
// ============================================================================

const validateImageNumber = [
  body('imageNumber')
    .isInt({ min: 1, max: 3 })
    .withMessage('Image number must be 1, 2, or 3')
];

const validateResetConfirmation = [
  body('confirm')
    .optional()
    .isBoolean()
    .withMessage('Confirm must be a boolean')
];

// ============================================================================
// IMAGE NUMBER MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/image-number
 * Get current image number for authenticated user
 */
router.get('/',
  authenticateToken,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found in token',
          error: 'USER_NOT_AUTHENTICATED'
        });
      }
      
      logger.info(`Getting image number for user: ${userId}`);
      
      // Get user from database
      const user = await UserModel.findByUserId(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      // Default to 1 if not set
      const imageNumber = user.image_number || 1;
      
      res.json({
        success: true,
        message: 'Image number retrieved successfully',
        data: {
          userId,
          imageNumber,
          availableNumbers: [1, 2, 3],
          description: 'Image number can be 1, 2, or 3. Default is 1.'
        }
      });
      
    } catch (error: any) {
      logger.error('Error getting image number:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get image number',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * PUT /api/image-number
 * Update authenticated user's image number
 */
router.put('/',
  authenticateToken,
  validateImageNumber,
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { imageNumber } = req.body;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found in token',
          error: 'USER_NOT_AUTHENTICATED'
        });
      }
      
      logger.info(`Updating image number for user ${userId} to ${imageNumber}`);
      
      // Check if user exists
      const existingUser = await UserModel.findByUserId(userId);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      // Check if new image number is different from current
      const currentImageNumber = existingUser.image_number || 1;
      if (currentImageNumber === imageNumber) {
        return res.status(400).json({
          success: false,
          message: 'New image number must be different from current image number',
          error: 'SAME_IMAGE_NUMBER'
        });
      }
      
      // Update image number using the specific method
      const updatedUser = await UserModel.updateImageNumber(userId, imageNumber);
      
      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update image number',
          error: 'UPDATE_FAILED'
        });
      }
      
      // Log activity
      logger.info(`Image number updated for user ${userId}: ${currentImageNumber} -> ${imageNumber}`);
      
      res.json({
        success: true,
        message: 'Image number updated successfully',
        data: {
          userId,
          oldImageNumber: currentImageNumber,
          newImageNumber: imageNumber,
          updatedAt: updatedUser.updated_at || new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      logger.error('Error updating image number:', error);
      
      if (error.message && error.message.includes('Image number must be 1, 2, or 3')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: 'INVALID_IMAGE_NUMBER'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update image number',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * GET /api/image-number/preview
 * Get available image number previews for authenticated user (for UI purposes)
 */
router.get('/preview',
  authenticateToken,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found in token',
          error: 'USER_NOT_AUTHENTICATED'
        });
      }
      
      logger.info(`Getting image number previews for user: ${userId}`);
      
      // Get user's current image number
      const user = await UserModel.findByUserId(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      const currentImageNumber = user.image_number || 1;
      
      // Generate preview data (this would typically come from a CDN or storage service)
      const previews = [
        {
          number: 1,
          name: 'Default Avatar',
          description: 'Standard profile image',
          isCurrent: currentImageNumber === 1,
          previewUrl: '/api/images/avatars/default-1.jpg' // Example URL
        },
        {
          number: 2,
          name: 'Alternate Avatar',
          description: 'Secondary profile image',
          isCurrent: currentImageNumber === 2,
          previewUrl: '/api/images/avatars/default-2.jpg'
        },
        {
          number: 3,
          name: 'Premium Avatar',
          description: 'Exclusive profile image',
          isCurrent: currentImageNumber === 3,
          previewUrl: '/api/images/avatars/default-3.jpg'
        }
      ];
      
      res.json({
        success: true,
        message: 'Image number previews retrieved successfully',
        data: {
          userId,
          currentImageNumber,
          availableNumbers: [1, 2, 3],
          previews,
          note: 'Image numbers correspond to different avatar styles in the app'
        }
      });
      
    } catch (error: any) {
      logger.error('Error getting image number previews:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get image number previews',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * PUT /api/image-number/random
 * Set a random image number for authenticated user
 */
router.put('/random',
  authenticateToken,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found in token',
          error: 'USER_NOT_AUTHENTICATED'
        });
      }
      
      logger.info(`Setting random image number for user: ${userId}`);
      
      // Check if user exists
      const existingUser = await UserModel.findByUserId(userId);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      const currentImageNumber = existingUser.image_number || 1;
      
      // Generate a random image number (1, 2, or 3) different from current
      let randomImageNumber;
      do {
        randomImageNumber = Math.floor(Math.random() * 3) + 1;
      } while (randomImageNumber === currentImageNumber);
      
      // Update image number
      const updatedUser = await UserModel.updateImageNumber(userId, randomImageNumber);
      
      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: 'Failed to set random image number',
          error: 'UPDATE_FAILED'
        });
      }
      
      // Log activity
      logger.info(`Random image number set for user ${userId}: ${currentImageNumber} -> ${randomImageNumber}`);
      
      res.json({
        success: true,
        message: 'Random image number set successfully',
        data: {
          userId,
          oldImageNumber: currentImageNumber,
          newImageNumber: randomImageNumber,
          wasRandomized: true,
          updatedAt: updatedUser.updated_at || new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      logger.error('Error setting random image number:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set random image number',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * PUT /api/image-number/reset
 * Reset image number to default (1) for authenticated user
 */
router.put('/reset',
  authenticateToken,
  validateResetConfirmation,
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { confirm } = req.body;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found in token',
          error: 'USER_NOT_AUTHENTICATED'
        });
      }
      
      // Check if user wants to confirm reset
      if (confirm !== true) {
        return res.status(400).json({
          success: false,
          message: 'Reset must be confirmed',
          error: 'CONFIRMATION_REQUIRED',
          confirmationMessage: 'Are you sure you want to reset your image number to default (1)?',
          confirmationEndpoint: `/api/image-number/reset`,
          confirmationBody: { confirm: true }
        });
      }
      
      logger.info(`Resetting image number for user: ${userId}`);
      
      // Check if user exists
      const existingUser = await UserModel.findByUserId(userId);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      const currentImageNumber = existingUser.image_number || 1;
      
      // Already at default, nothing to do
      if (currentImageNumber === 1) {
        return res.status(400).json({
          success: false,
          message: 'Image number is already at default (1)',
          error: 'ALREADY_DEFAULT'
        });
      }
      
      // Reset to default (1)
      const updatedUser = await UserModel.updateImageNumber(userId, 1);
      
      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: 'Failed to reset image number',
          error: 'UPDATE_FAILED'
        });
      }
      
      // Log activity
      logger.info(`Image number reset for user ${userId}: ${currentImageNumber} -> 1`);
      
      res.json({
        success: true,
        message: 'Image number reset to default successfully',
        data: {
          userId,
          oldImageNumber: currentImageNumber,
          newImageNumber: 1,
          wasReset: true,
          updatedAt: updatedUser.updated_at || new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      logger.error('Error resetting image number:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset image number',
        error: 'SERVER_ERROR'
      });
    }
  })
);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

router.use((error: any, req: Request, res: Response, next: any) => {
  logger.error('Image number route error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      details: error.details
    });
  }
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'INVALID_TOKEN'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: 'TOKEN_EXPIRED'
    });
  }
  
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed',
      error: 'DATABASE_ERROR'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: 'SERVER_ERROR'
  });
});

export default router;