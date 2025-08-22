import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { subscriptionService } from '../services/subscription-service.js';
import { authenticateToken } from '../middleware/auth.js';
import { 
  requirePremiumSubscription, 
  attachSubscriptionStatus,
  checkExpiringSubscription 
} from '../middleware/subscription-middleware.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Apply authentication to all subscription routes
router.use(authenticateToken);

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: any) => {
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

/**
 * GET /api/subscription/status
 * Get current subscription status for authenticated user
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const subscriptionStatus = await subscriptionService.getSubscriptionStatus(userId);
    
    if (!subscriptionStatus) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        tier: subscriptionStatus.tier,
        isActive: subscriptionStatus.isActive,
        startDate: subscriptionStatus.startDate,
        endDate: subscriptionStatus.endDate,
        daysRemaining: subscriptionStatus.daysRemaining,
        autoRenew: subscriptionStatus.autoRenew
      }
    });
  } catch (error) {
    logger.error('Failed to get subscription status', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription status'
    });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel current premium subscription
 */
router.post('/cancel', requirePremiumSubscription, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const success = await subscriptionService.cancelSubscription(userId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel subscription'
      });
    }
    
    logger.info('Subscription cancelled', { userId });
    
    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        tier: 'freemium',
        cancelledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to cancel subscription', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
});

/**
 * POST /api/subscription/activate
 * Activate premium subscription (admin only or after payment)
 */
router.post('/activate', [
  body('durationMonths')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Duration must be between 1 and 12 months'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { durationMonths = 1 } = req.body;
    
    // Check if user already has active premium subscription
    const currentStatus = await subscriptionService.getSubscriptionStatus(userId);
    if (currentStatus?.tier === 'premium' && currentStatus.isActive) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active premium subscription',
        data: {
          currentTier: currentStatus.tier,
          endDate: currentStatus.endDate,
          daysRemaining: currentStatus.daysRemaining
        }
      });
    }
    
    const success = await subscriptionService.activatePremiumSubscription(userId, durationMonths);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to activate premium subscription'
      });
    }
    
    const newStatus = await subscriptionService.getSubscriptionStatus(userId);
    
    logger.info('Premium subscription activated', { 
      userId, 
      durationMonths,
      endDate: newStatus?.endDate 
    });
    
    res.json({
      success: true,
      message: 'Premium subscription activated successfully',
      data: {
        tier: 'premium',
        startDate: newStatus?.startDate,
        endDate: newStatus?.endDate,
        daysRemaining: newStatus?.daysRemaining
      }
    });
  } catch (error) {
    logger.error('Failed to activate subscription', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to activate subscription'
    });
  }
});

/**
 * GET /api/subscription/check-expiry
 * Check if subscription is expired or expiring soon
 */
router.get('/check-expiry', attachSubscriptionStatus, checkExpiringSubscription, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const isExpired = await subscriptionService.isSubscriptionExpired(userId);
    const subscriptionStatus = await subscriptionService.getSubscriptionStatus(userId);
    
    if (!subscriptionStatus) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    const isExpiringSoon = subscriptionStatus.tier === 'premium' && 
                          subscriptionStatus.isActive && 
                          subscriptionStatus.daysRemaining <= 7;
    
    res.json({
      success: true,
      data: {
        isExpired,
        isExpiringSoon,
        daysRemaining: subscriptionStatus.daysRemaining,
        tier: subscriptionStatus.tier,
        isActive: subscriptionStatus.isActive,
        endDate: subscriptionStatus.endDate
      }
    });
  } catch (error) {
    logger.error('Failed to check subscription expiry', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription expiry'
    });
  }
});

/**
 * GET /api/subscription/statistics (Admin only)
 * Get subscription statistics
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware
    const stats = await subscriptionService.getSubscriptionStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get subscription statistics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription statistics'
    });
  }
});

/**
 * POST /api/subscription/manual-renewal-check (Admin only)
 * Manually trigger renewal check
 */
router.post('/manual-renewal-check', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware
    await subscriptionService.runRenewalCheck();
    
    res.json({
      success: true,
      message: 'Manual renewal check completed'
    });
  } catch (error) {
    logger.error('Failed to run manual renewal check', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to run renewal check'
    });
  }
});

/**
 * GET /api/subscription/expiring
 * Get users with expiring subscriptions (Admin only)
 */
router.get('/expiring', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware
    const expiringUserIds = await subscriptionService.getExpiringSubscriptions();
    
    res.json({
      success: true,
      data: {
        count: expiringUserIds.length,
        userIds: expiringUserIds
      }
    });
  } catch (error) {
    logger.error('Failed to get expiring subscriptions', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expiring subscriptions'
    });
  }
});

/**
 * GET /api/subscription/expired
 * Get users with expired subscriptions (Admin only)
 */
router.get('/expired', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication middleware
    const expiredUserIds = await subscriptionService.getExpiredSubscriptions();
    
    res.json({
      success: true,
      data: {
        count: expiredUserIds.length,
        userIds: expiredUserIds
      }
    });
  } catch (error) {
    logger.error('Failed to get expired subscriptions', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expired subscriptions'
    });
  }
});

export default router;