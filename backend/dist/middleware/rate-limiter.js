import { logger } from '../utils/logger.js';
// Simple in-memory rate limiter
const requestCounts = new Map();
export const createRateLimiter = (options) => {
    return (req, res, next) => {
        const clientId = req.ip || 'unknown';
        const now = Date.now();
        const clientData = requestCounts.get(clientId);
        if (!clientData || now > clientData.resetTime) {
            // Reset or initialize counter
            requestCounts.set(clientId, {
                count: 1,
                resetTime: now + options.windowMs
            });
            return next();
        }
        if (clientData.count >= options.max) {
            logger.warn(`Rate limit exceeded for IP: ${clientId}`);
            return res.status(429).json({
                error: options.message || 'Too many requests, please try again later.'
            });
        }
        clientData.count++;
        next();
    };
};
// Default rate limiter for seed phrase operations
export const rateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: 'Too many seed phrase requests, please try again later.'
});
//# sourceMappingURL=rate-limiter.js.map