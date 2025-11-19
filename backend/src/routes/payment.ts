import express from 'express';
import { paystackService } from '../services/paystack-service.js';
import { logger } from '../utils/logger.js';
import pool from '../database/config.js';
import { authenticateToken } from '../middleware/auth.js';
import { subscriptionService } from '../services/subscription-service.js';

const router = express.Router();

/**
 * Initialize one-time payment
 * POST /api/payment/initialize
 */
router.post('/initialize', authenticateToken, async (req, res) => {
  try {
    const { amount = 5000 } = req.body;
    const userId = req.user!.userId;

    // Check if user exists and get their email/phone hash for metadata
    const client = await pool.connect();
    let userEmail = 'user@k33p.app';
    
    try {
      const userResult = await client.query(
        'SELECT email, phone_hash FROM users WHERE user_id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = userResult.rows[0];
      userEmail = user.email || `user_${userId}@k33p.app`;
    } finally {
      client.release();
    }

    // Check if user already has premium
    const subscriptionResult = await client.query(
      'SELECT tier FROM subscriptions WHERE user_id = $1 AND tier = $2 AND is_active = true',
      [userId, 'premium']
    );

    if (subscriptionResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already has active premium subscription'
      });
    }

    // Initialize payment with Paystack
    const paymentData = {
      amount: amount,
      currency: 'NGN',
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
      metadata: {
        userId: userId,
        subscriptionType: 'premium'
      }
    };

    const result = await paystackService.initializePayment(paymentData);
    
    if (result.success) {
      logger.info('Payment initialized successfully', { userId });
      
      res.json({
        success: true,
        data: result.data
      });
    } else {
      logger.error('Payment initialization failed', { userId, error: result.error });
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    logger.error('Payment initialization error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Verify payment and activate subscription
 * POST /api/payment/verify
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return res.status(400).json({
        success: false,
        error: 'Payment reference is required'
      });
    }

    const result = await paystackService.verifyPayment(reference);
    
    if (result.success) {
      logger.info('Payment verified successfully', { reference });
      
      // If payment is successful and has authorization, activate subscription
      if (result.data?.status === 'success' && result.data?.authorization) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          const userId = result.data.metadata?.userId;
          
          if (userId) {
            // Update user subscription
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

            await client.query(
              `INSERT INTO subscriptions (user_id, tier, is_active, start_date, end_date, auto_renew, authorization_code)
               VALUES ($1, 'premium', true, $2, $3, true, $4)
               ON CONFLICT (user_id) 
               DO UPDATE SET 
                 tier = 'premium',
                 is_active = true,
                 start_date = $2,
                 end_date = $3,
                 auto_renew = true,
                 authorization_code = $4,
                 updated_at = CURRENT_TIMESTAMP`,
              [userId, startDate, endDate, result.data.authorization.authorization_code]
            );

            logger.info('Premium subscription activated', { userId });
          }
          
          await client.query('COMMIT');
        } catch (dbError) {
          await client.query('ROLLBACK');
          logger.error('Failed to activate subscription', { error: dbError });
        } finally {
          client.release();
        }
      }
      
      res.json({
        success: true,
        data: result.data
      });
    } else {
      logger.error('Payment verification failed', { reference, error: result.error });
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    logger.error('Payment verification error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Process recurring payment using stored authorization
 * POST /api/payment/charge-recurring
 */
router.post('/charge-recurring', authenticateToken, async (req, res) => {
  try {
    const { amount = 5000 } = req.body;
    const userId = req.user!.userId;

    const client = await pool.connect();
    try {
      // Get user's authorization code
      const subscriptionResult = await client.query(
        'SELECT authorization_code FROM subscriptions WHERE user_id = $1 AND tier = $2 AND is_active = true',
        [userId, 'premium']
      );

      if (subscriptionResult.rows.length === 0 || !subscriptionResult.rows[0].authorization_code) {
        return res.status(400).json({
          success: false,
          error: 'No active subscription with authorization found'
        });
      }

      const authorizationCode = subscriptionResult.rows[0].authorization_code;
      const userEmail = `user_${userId}@k33p.app`; // Use consistent email

      // Charge using authorization
      const chargeResult = await paystackService.chargeAuthorization({
        authorization_code: authorizationCode,
        email: userEmail,
        amount: amount,
        currency: 'NGN',
        metadata: {
          userId: userId,
          subscriptionType: 'premium_recurring'
        }
      });

      if (chargeResult.success) {
        // Extend subscription
        const newEndDate = new Date();
        newEndDate.setMonth(newEndDate.getMonth() + 1);

        await client.query(
          'UPDATE subscriptions SET end_date = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [newEndDate, userId]
        );

        logger.info('Recurring payment processed successfully', { userId });
        
        res.json({
          success: true,
          data: chargeResult.data
        });
      } else {
        logger.error('Recurring payment failed', { userId, error: chargeResult.error });
        res.status(400).json({
          success: false,
          error: chargeResult.error
        });
      }
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Recurring payment error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get payment configuration for frontend
 * GET /api/payment/config
 */
router.get('/config', (req, res) => {
  try {
    const config = paystackService.getPublicConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    logger.error('Failed to get payment config', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get user subscription status
 * GET /api/payment/subscription/status
 */
router.get('/subscription/status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!; // Auth middleware ensures user exists
    
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT subscription_tier, subscription_start_date, subscription_end_date 
         FROM users WHERE user_id = $1`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      const subscription = result.rows[0];
      const now = new Date();
      const isActive = subscription.subscription_tier === 'premium' && 
                      subscription.subscription_end_date && 
                      new Date(subscription.subscription_end_date) > now;
      
      res.json({
        success: true,
        data: {
          tier: subscription.subscription_tier,
          isActive: isActive,
          startDate: subscription.subscription_start_date,
          endDate: subscription.subscription_end_date,
          daysRemaining: isActive ? 
            Math.ceil((new Date(subscription.subscription_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Failed to get subscription status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Cancel subscription
 * POST /api/payment/subscription/cancel
 */
router.post('/subscription/cancel', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update user subscription to freemium
      const result = await client.query(
        `UPDATE users 
         SET subscription_tier = 'freemium',
             subscription_end_date = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND subscription_tier = 'premium'
         RETURNING email`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'No active premium subscription found'
        });
      }
      
      await client.query('COMMIT');
      
      logger.info('Subscription cancelled successfully', { userId });
      
      res.json({
        success: true,
        message: 'Subscription cancelled successfully'
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Failed to cancel subscription', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Paystack webhook endpoint
 * POST /api/payment/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    const payload = req.body.toString();
    
    // Verify webhook signature
    const isValid = await paystackService.verifyWebhookSignature(payload, signature);
    if (!isValid) {
      logger.warn('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const event = JSON.parse(payload);
    
    // Process webhook event
    const result = await paystackService.processWebhookEvent(event);
    
    if (result.success) {
      res.status(200).json({ message: 'Webhook processed successfully' });
    } else {
      res.status(400).json({ error: result.message }); // Changed from result.error to result.message
    }
  } catch (error: any) {
    logger.error('Webhook processing error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get payment history for user
 * GET /api/payment/history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT reference, amount, currency, status, created_at, paid_at, gateway_response
         FROM payment_transactions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      const countResult = await client.query(
        'SELECT COUNT(*) FROM payment_transactions WHERE user_id = $1',
        [userId]
      );
      
      res.json({
        success: true,
        data: {
          transactions: result.rows,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: Number(countResult.rows[0].count),
            totalPages: Math.ceil(Number(countResult.rows[0].count) / Number(limit))
          }
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Failed to get payment history', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Add these new routes to your existing payment routes

/**
 * Initialize monthly recurring subscription with phone number
 * POST /api/payment/initialize-monthly
 */
router.post('/initialize-monthly', authenticateToken, async (req, res) => {
  try {
    const { phone, amount } = req.body;
    const userId = req.user!.userId;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required for monthly subscription'
      });
    }

    // Validate phone number format
    const phoneRegex = /^\+?[\d\s-()]{10,}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Valid phone number is required'
      });
    }

    // Initialize monthly recurring subscription
    const result = await subscriptionService.initializeMonthlyRecurringSubscription(
      userId,
      phone,
      amount || 5000 // Default to 5000 NGN
    );
    
    if (result.success) {
      logger.info('Monthly subscription payment initialized successfully', { 
        userId, 
        phone 
      });
      
      res.json({
        success: true,
        data: {
          paymentUrl: result.paymentUrl,
          reference: result.reference
        }
      });
    } else {
      logger.error('Monthly subscription initialization failed', { 
        userId, 
        phone, 
        error: result.message 
      });
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error: any) {
    logger.error('Monthly subscription initialization error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get recurring subscription details
 * GET /api/payment/subscription/details
 */
router.get('/subscription/details', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!;
    
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT s.subscription_code, s.phone, s.status, s.next_payment_date, 
                s.auto_renew, s.created_at, s.cancelled_at,
                pt.reference, pt.amount, pt.currency
         FROM subscriptions s
         LEFT JOIN payment_transactions pt ON s.user_id = pt.user_id 
         WHERE s.user_id = $1 AND s.tier = 'premium'
         ORDER BY pt.created_at DESC LIMIT 1`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No active subscription found'
        });
      }
      
      const subscription = result.rows[0];
      
      // If we have a subscription code, get details from Paystack
      let paystackDetails = null;
      if (subscription.subscription_code) {
        const paystackResult = await paystackService.getSubscription(subscription.subscription_code);
        if (paystackResult.success) {
          paystackDetails = paystackResult.data;
        }
      }
      
      res.json({
        success: true,
        data: {
          subscription: {
            code: subscription.subscription_code,
            phone: subscription.phone,
            status: subscription.status,
            nextPaymentDate: subscription.next_payment_date,
            autoRenew: subscription.auto_renew,
            createdAt: subscription.created_at,
            cancelledAt: subscription.cancelled_at
          },
          lastPayment: {
            reference: subscription.reference,
            amount: subscription.amount,
            currency: subscription.currency
          },
          paystackDetails: paystackDetails
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Failed to get subscription details', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Cancel recurring subscription
 * POST /api/payment/subscription/cancel-recurring
 */
router.post('/subscription/cancel-recurring', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user!;
    
    const success = await subscriptionService.cancelRecurringSubscription(userId);
    
    if (success) {
      logger.info('Recurring subscription cancelled successfully', { userId });
      
      res.json({
        success: true,
        message: 'Recurring subscription cancelled successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to cancel recurring subscription'
      });
    }
  } catch (error: any) {
    logger.error('Failed to cancel recurring subscription', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;