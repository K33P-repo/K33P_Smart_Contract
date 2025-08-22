import { subscriptionService } from '../services/subscription-service.js';
import { logger } from '../utils/logger.js';
/**
 * Middleware to check if user has an active premium subscription
 */
export const requirePremiumSubscription = async (req, res, next) => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        const subscriptionStatus = await subscriptionService.getSubscriptionStatus(req.user.userId);
        if (!subscriptionStatus) {
            res.status(404).json({
                success: false,
                message: 'User subscription not found'
            });
            return;
        }
        if (subscriptionStatus.tier !== 'premium' || !subscriptionStatus.isActive) {
            res.status(403).json({
                success: false,
                message: 'Premium subscription required',
                data: {
                    currentTier: subscriptionStatus.tier,
                    isActive: subscriptionStatus.isActive,
                    upgradeRequired: true
                }
            });
            return;
        }
        // Add subscription info to request for use in route handlers
        req.subscription = {
            tier: subscriptionStatus.tier,
            isActive: subscriptionStatus.isActive,
            daysRemaining: subscriptionStatus.daysRemaining
        };
        next();
    }
    catch (error) {
        logger.error('Subscription check failed', {
            error,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            message: 'Failed to verify subscription status'
        });
    }
};
/**
 * Middleware to attach subscription status to request (non-blocking)
 */
export const attachSubscriptionStatus = async (req, res, next) => {
    try {
        if (req.user?.userId) {
            const subscriptionStatus = await subscriptionService.getSubscriptionStatus(req.user.userId);
            if (subscriptionStatus) {
                req.subscription = {
                    tier: subscriptionStatus.tier,
                    isActive: subscriptionStatus.isActive,
                    daysRemaining: subscriptionStatus.daysRemaining
                };
            }
        }
        next();
    }
    catch (error) {
        logger.error('Failed to attach subscription status', {
            error,
            userId: req.user?.userId
        });
        // Don't block the request, just continue without subscription info
        next();
    }
};
/**
 * Middleware to check subscription limits (e.g., API rate limits for freemium users)
 */
export const checkSubscriptionLimits = (limits) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
                return;
            }
            const subscriptionStatus = await subscriptionService.getSubscriptionStatus(req.user.userId);
            if (!subscriptionStatus) {
                res.status(404).json({
                    success: false,
                    message: 'User subscription not found'
                });
                return;
            }
            const userLimits = subscriptionStatus.tier === 'premium' && subscriptionStatus.isActive
                ? limits.premium
                : limits.freemium;
            // TODO: Implement actual rate limiting logic with Redis or in-memory store
            // For now, just attach the limits to the request
            req.subscription = {
                tier: subscriptionStatus.tier,
                isActive: subscriptionStatus.isActive,
                daysRemaining: subscriptionStatus.daysRemaining
            };
            // Add rate limit headers
            if (userLimits.requestsPerHour) {
                res.setHeader('X-RateLimit-Limit-Hour', userLimits.requestsPerHour);
            }
            if (userLimits.requestsPerDay) {
                res.setHeader('X-RateLimit-Limit-Day', userLimits.requestsPerDay);
            }
            res.setHeader('X-Subscription-Tier', subscriptionStatus.tier);
            res.setHeader('X-Subscription-Active', subscriptionStatus.isActive.toString());
            next();
        }
        catch (error) {
            logger.error('Subscription limits check failed', {
                error,
                userId: req.user?.userId
            });
            res.status(500).json({
                success: false,
                message: 'Failed to check subscription limits'
            });
        }
    };
};
/**
 * Middleware to warn users about expiring subscriptions
 */
export const checkExpiringSubscription = async (req, res, next) => {
    try {
        if (req.user?.userId && req.subscription) {
            const { tier, isActive, daysRemaining } = req.subscription;
            if (tier === 'premium' && isActive && daysRemaining <= 7) {
                res.setHeader('X-Subscription-Warning', `Your premium subscription expires in ${daysRemaining} days`);
                res.setHeader('X-Subscription-Days-Remaining', daysRemaining.toString());
            }
        }
        next();
    }
    catch (error) {
        logger.error('Failed to check expiring subscription', {
            error,
            userId: req.user?.userId
        });
        // Don't block the request
        next();
    }
};
/**
 * Helper function to check if user has premium access
 */
export const hasPremiumAccess = (req) => {
    return req.subscription?.tier === 'premium' && req.subscription?.isActive === true;
};
/**
 * Helper function to get subscription tier
 */
export const getSubscriptionTier = (req) => {
    return req.subscription?.tier || 'freemium';
};
/**
 * Helper function to check if subscription is expiring soon (within 7 days)
 */
export const isSubscriptionExpiringSoon = (req) => {
    return req.subscription?.tier === 'premium' &&
        req.subscription?.isActive === true &&
        req.subscription?.daysRemaining <= 7;
};
//# sourceMappingURL=subscription-middleware.js.map