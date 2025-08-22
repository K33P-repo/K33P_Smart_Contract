import express from 'express';
import { paystackService } from '../services/paystack-service.js';
import { logger } from '../utils/logger.js';
import pool from '../database/config.js';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
/**
 * Initialize payment for premium subscription
 * POST /api/payment/initialize
 */
router.post('/initialize', authenticateToken, async (req, res) => {
    try {
        const { email, userId } = req.body;
        if (!email || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Email and userId are required'
            });
        }
        // Check if user exists
        const client = await pool.connect();
        try {
            const userResult = await client.query('SELECT id, email, subscription_tier FROM users WHERE user_id = $1', [userId]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            const user = userResult.rows[0];
            // Check if user is already premium
            if (user.subscription_tier === 'premium') {
                return res.status(400).json({
                    success: false,
                    error: 'User already has premium subscription'
                });
            }
            // Initialize payment with Paystack
            const paymentData = {
                email: email,
                amount: 3.99, // $3.99 subscription amount
                currency: 'USD',
                callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
                metadata: {
                    userId: userId,
                    subscriptionType: 'premium',
                    userEmail: email
                }
            };
            const result = await paystackService.initializePayment(paymentData);
            if (result.success) {
                logger.info('Payment initialized successfully', {
                    userId,
                    email,
                    reference: result.data?.reference
                });
                res.json({
                    success: true,
                    data: result.data
                });
            }
            else {
                logger.error('Payment initialization failed', { userId, email, error: result.error });
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        logger.error('Payment initialization error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
/**
 * Verify payment transaction
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
            // If payment is successful, update user subscription
            if (result.data?.status === 'success' && result.data?.metadata?.userId) {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    await client.query(`UPDATE users 
             SET subscription_tier = 'premium',
                 subscription_start_date = CURRENT_TIMESTAMP,
                 subscription_end_date = CURRENT_TIMESTAMP + INTERVAL '1 month'
             WHERE user_id = $1`, [result.data.metadata.userId]);
                    await client.query('COMMIT');
                    logger.info('User subscription updated to premium', {
                        userId: result.data.metadata.userId
                    });
                }
                catch (dbError) {
                    await client.query('ROLLBACK');
                    logger.error('Failed to update user subscription', {
                        error: dbError,
                        userId: result.data.metadata.userId
                    });
                }
                finally {
                    client.release();
                }
            }
            res.json({
                success: true,
                data: result.data
            });
        }
        else {
            logger.error('Payment verification failed', { reference, error: result.error });
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    }
    catch (error) {
        logger.error('Payment verification error', { error: error.message });
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
    }
    catch (error) {
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
        const { userId } = req.user; // Auth middleware ensures user exists
        const client = await pool.connect();
        try {
            const result = await client.query(`SELECT subscription_tier, subscription_start_date, subscription_end_date 
         FROM users WHERE user_id = $1`, [userId]);
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
        }
        finally {
            client.release();
        }
    }
    catch (error) {
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
        const { userId } = req.user;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Update user subscription to freemium
            const result = await client.query(`UPDATE users 
         SET subscription_tier = 'freemium',
             subscription_end_date = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND subscription_tier = 'premium'
         RETURNING email`, [userId]);
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
        }
        catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
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
        const signature = req.headers['x-paystack-signature'];
        const payload = req.body.toString();
        // Verify webhook signature
        if (!paystackService.verifyWebhookSignature(payload, signature)) {
            logger.warn('Invalid webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }
        const event = JSON.parse(payload);
        // Process webhook event
        const result = await paystackService.processWebhookEvent(event);
        if (result.success) {
            res.status(200).json({ message: 'Webhook processed successfully' });
        }
        else {
            res.status(400).json({ error: result.error });
        }
    }
    catch (error) {
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
        const { userId } = req.user;
        const { page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const client = await pool.connect();
        try {
            const result = await client.query(`SELECT reference, amount, currency, status, created_at, paid_at, gateway_response
         FROM payment_transactions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`, [userId, limit, offset]);
            const countResult = await client.query('SELECT COUNT(*) FROM payment_transactions WHERE user_id = $1', [userId]);
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
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        logger.error('Failed to get payment history', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
export default router;
//# sourceMappingURL=payment.js.map