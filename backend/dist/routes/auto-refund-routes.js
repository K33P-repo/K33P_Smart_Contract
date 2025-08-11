/**
 * Auto-Refund Monitor Routes for K33P Backend
 * Provides health monitoring, status endpoints, and webhook management
 * for the automatic refund monitoring service
 */
import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateAdmin } from '../middleware/admin-auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { autoRefundMonitor } from '../services/auto-refund-monitor.js';
import { logger } from '../utils/logger.js';
const router = express.Router();
// Rate limiters for different endpoints
const statusLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Too many status requests'
});
const controlLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 control requests per minute
    message: 'Too many control requests'
});
// ============================================================================
// MIDDLEWARE
// ============================================================================
const handleValidationErrors = (req, res, next) => {
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
const handleAsyncRoute = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
// ============================================================================
// HEALTH AND STATUS ENDPOINTS
// ============================================================================
/**
 * GET /api/auto-refund/health
 * Get health check information for monitoring
 */
router.get('/health', statusLimiter, handleAsyncRoute(async (req, res) => {
    try {
        const healthCheck = autoRefundMonitor.getHealthCheck();
        // Set appropriate HTTP status based on health
        const statusCode = healthCheck.status === 'healthy' ? 200 :
            healthCheck.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json({
            success: healthCheck.status !== 'unhealthy',
            message: `Auto-refund monitor is ${healthCheck.status}`,
            data: healthCheck
        });
    }
    catch (error) {
        logger.error('Error getting health check:', error);
        res.status(500).json({
            success: false,
            message: 'Health check failed',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * GET /api/auto-refund/status
 * Get comprehensive monitoring status and statistics
 */
router.get('/status', statusLimiter, handleAsyncRoute(async (req, res) => {
    try {
        const status = autoRefundMonitor.getStatus();
        res.json({
            success: true,
            message: 'Status retrieved successfully',
            data: status
        });
    }
    catch (error) {
        logger.error('Error getting status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get status',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// CONTROL ENDPOINTS (ADMIN ONLY)
// ============================================================================
/**
 * POST /api/auto-refund/start
 * Start the auto-refund monitoring service
 */
router.post('/start', authenticateAdmin, controlLimiter, handleAsyncRoute(async (req, res) => {
    try {
        await autoRefundMonitor.start();
        res.json({
            success: true,
            message: 'Auto-refund monitor started successfully'
        });
    }
    catch (error) {
        logger.error('Error starting auto-refund monitor:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start auto-refund monitor',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/auto-refund/stop
 * Stop the auto-refund monitoring service
 */
router.post('/stop', authenticateAdmin, controlLimiter, handleAsyncRoute(async (req, res) => {
    try {
        autoRefundMonitor.stop();
        res.json({
            success: true,
            message: 'Auto-refund monitor stopped successfully'
        });
    }
    catch (error) {
        logger.error('Error stopping auto-refund monitor:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop auto-refund monitor',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/auto-refund/trigger
 * Manually trigger a monitoring check
 */
router.post('/trigger', authenticateAdmin, controlLimiter, handleAsyncRoute(async (req, res) => {
    try {
        await autoRefundMonitor.triggerManualCheck();
        res.json({
            success: true,
            message: 'Manual check triggered successfully'
        });
    }
    catch (error) {
        logger.error('Error triggering manual check:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger manual check',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/auto-refund/reset-stats
 * Reset monitoring statistics
 */
router.post('/reset-stats', authenticateAdmin, controlLimiter, handleAsyncRoute(async (req, res) => {
    try {
        autoRefundMonitor.resetStatistics();
        res.json({
            success: true,
            message: 'Statistics reset successfully'
        });
    }
    catch (error) {
        logger.error('Error resetting statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset statistics',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// WEBHOOK MANAGEMENT ENDPOINTS
// ============================================================================
/**
 * POST /api/auto-refund/webhook/test
 * Test webhook notifications with mock transaction
 */
router.post('/webhook/test', authenticateAdmin, controlLimiter, body('testTransaction').optional().isObject().withMessage('Test transaction must be an object'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { testTransaction } = req.body;
        autoRefundMonitor.triggerWebhookTest(testTransaction);
        res.json({
            success: true,
            message: 'Webhook test triggered successfully',
            data: {
                webhookListenerCount: autoRefundMonitor.getStatus().webhookListenerCount
            }
        });
    }
    catch (error) {
        logger.error('Error testing webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test webhook',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// WEBHOOK REGISTRATION ENDPOINT (for external services)
// ============================================================================
/**
 * POST /api/auto-refund/webhook/register
 * Register a webhook URL for transaction notifications
 * Note: This is a simplified implementation. In production, you might want
 * to store webhook URLs in database and implement proper authentication
 */
router.post('/webhook/register', authenticateAdmin, controlLimiter, body('webhookUrl').isURL().withMessage('Valid webhook URL is required'), body('secret').optional().isString().withMessage('Webhook secret must be a string'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { webhookUrl, secret } = req.body;
        // Create webhook listener that sends HTTP POST to the provided URL
        const unsubscribe = autoRefundMonitor.registerWebhookListener(async (transaction) => {
            try {
                const payload = {
                    event: 'transaction_detected',
                    timestamp: Date.now(),
                    data: transaction
                };
                const headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'K33P-AutoRefund-Monitor/1.0'
                };
                // Add signature if secret is provided
                if (secret) {
                    const crypto = await import('crypto');
                    const signature = crypto.createHmac('sha256', secret)
                        .update(JSON.stringify(payload))
                        .digest('hex');
                    headers['X-K33P-Signature'] = `sha256=${signature}`;
                }
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    logger.warn(`Webhook delivery failed: ${response.status} ${response.statusText}`);
                }
                else {
                    logger.info(`Webhook delivered successfully to ${webhookUrl}`);
                }
            }
            catch (error) {
                logger.error(`Webhook delivery error for ${webhookUrl}:`, error);
            }
        });
        res.json({
            success: true,
            message: 'Webhook registered successfully',
            data: {
                webhookUrl,
                webhookListenerCount: autoRefundMonitor.getStatus().webhookListenerCount,
                note: 'Store the unsubscribe function if you need to remove this webhook later'
            }
        });
    }
    catch (error) {
        logger.error('Error registering webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register webhook',
            error: 'SERVER_ERROR'
        });
    }
}));
export default router;
//# sourceMappingURL=auto-refund-routes.js.map