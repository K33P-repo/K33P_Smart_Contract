/**
 * Admin Authentication Middleware for K33P Backend
 * Validates X-API-KEY header against ADMIN_API_KEY environment variable
 */
import { logger } from '../utils/logger.js';
/**
 * Middleware to authenticate admin requests using X-API-KEY header
 */
export const authenticateAdmin = (req, res, next) => {
    try {
        // Get API key from X-API-KEY header
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            logger.warn('Admin authentication failed: No API key provided', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                endpoint: req.path
            });
            return res.status(401).json({
                success: false,
                message: 'Admin API key required',
                error: 'MISSING_API_KEY'
            });
        }
        // Validate API key against environment variable
        if (apiKey !== process.env.ADMIN_API_KEY) {
            logger.warn('Admin authentication failed: Invalid API key', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                endpoint: req.path,
                providedKey: apiKey.substring(0, 8) + '...' // Log only first 8 chars for security
            });
            return res.status(401).json({
                success: false,
                message: 'Invalid admin API key',
                error: 'INVALID_API_KEY'
            });
        }
        // Check if ADMIN_API_KEY is properly configured
        if (!process.env.ADMIN_API_KEY) {
            logger.error('Admin authentication failed: ADMIN_API_KEY not configured');
            return res.status(500).json({
                success: false,
                message: 'Admin authentication not properly configured',
                error: 'ADMIN_CONFIG_ERROR'
            });
        }
        logger.info('Admin authentication successful', {
            ip: req.ip,
            endpoint: req.path
        });
        next();
    }
    catch (error) {
        logger.error('Admin authentication middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Admin authentication failed',
            error: 'AUTHENTICATION_ERROR'
        });
    }
};
export default {
    authenticateAdmin
};
//# sourceMappingURL=admin-auth.js.map