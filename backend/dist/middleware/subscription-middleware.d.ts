import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                [key: string]: any;
            };
            subscription?: {
                tier: 'freemium' | 'premium';
                isActive: boolean;
                daysRemaining: number;
            };
        }
    }
}
/**
 * Middleware to check if user has an active premium subscription
 */
export declare const requirePremiumSubscription: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to attach subscription status to request (non-blocking)
 */
export declare const attachSubscriptionStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to check subscription limits (e.g., API rate limits for freemium users)
 */
export declare const checkSubscriptionLimits: (limits: {
    freemium: {
        requestsPerHour?: number;
        requestsPerDay?: number;
    };
    premium: {
        requestsPerHour?: number;
        requestsPerDay?: number;
    };
}) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to warn users about expiring subscriptions
 */
export declare const checkExpiringSubscription: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Helper function to check if user has premium access
 */
export declare const hasPremiumAccess: (req: Request) => boolean;
/**
 * Helper function to get subscription tier
 */
export declare const getSubscriptionTier: (req: Request) => "freemium" | "premium";
/**
 * Helper function to check if subscription is expiring soon (within 7 days)
 */
export declare const isSubscriptionExpiringSoon: (req: Request) => boolean;
//# sourceMappingURL=subscription-middleware.d.ts.map