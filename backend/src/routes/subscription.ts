import express from 'express';
import { subscriptionService } from '../services/subscription-service.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import { paystackService } from '../services/paystack-service.js';

const router = express.Router();

/**
 * Get user subscription status
 * GET /api/subscription/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!;
    
    const subscriptionStatus = await subscriptionService.getSubscriptionStatus(userId);
    
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
  } catch (error: any) {
    logger.error('Failed to get subscription status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Activate premium subscription after payment
 * POST /api/subscription/activate
 */
router.post('/activate', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!;
    const { reference, durationMonths = 1 } = req.body;
    
    if (!reference) {
      return res.status(400).json({
        success: false,
        error: 'Payment reference is required'
      });
    }

    // Verify payment first
    const paymentResult = await paystackService.verifyPayment(reference);
    
    if (!paymentResult.success || paymentResult.data?.status !== 'success') {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed or payment not successful'
      });
    }

    // Activate subscription
    const success = await subscriptionService.activatePremiumSubscription(userId, durationMonths);
    
    if (success) {
      logger.info('Premium subscription activated', { userId });
      
      res.json({
        success: true,
        message: 'Premium subscription activated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to activate subscription'
      });
    }
  } catch (error: any) {
    logger.error('Failed to activate subscription', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Cancel subscription
 * POST /api/subscription/cancel
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!;
    
    const success = await subscriptionService.cancelSubscription(userId);
    
    if (success) {
      logger.info('Subscription cancelled successfully', { userId });
      
      res.json({
        success: true,
        message: 'Subscription cancelled successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to cancel subscription'
      });
    }
  } catch (error: any) {
    logger.error('Failed to cancel subscription', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;