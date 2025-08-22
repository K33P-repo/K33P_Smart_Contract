interface SubscriptionStatus {
    userId: string;
    tier: 'freemium' | 'premium';
    isActive: boolean;
    startDate: Date | null;
    endDate: Date | null;
    daysRemaining: number;
    autoRenew: boolean;
}
interface SubscriptionUpdate {
    tier?: 'freemium' | 'premium';
    startDate?: Date;
    endDate?: Date;
    autoRenew?: boolean;
}
declare class SubscriptionService {
    private renewalCheckInterval;
    constructor();
    /**
     * Get subscription status for a user
     */
    getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null>;
    /**
     * Update subscription for a user
     */
    updateSubscription(userId: string, updates: SubscriptionUpdate): Promise<boolean>;
    /**
     * Activate premium subscription
     */
    activatePremiumSubscription(userId: string, durationMonths?: number): Promise<boolean>;
    /**
     * Cancel premium subscription
     */
    cancelSubscription(userId: string): Promise<boolean>;
    /**
     * Check if subscription is expired
     */
    isSubscriptionExpired(userId: string): Promise<boolean>;
    /**
     * Get users with expiring subscriptions (within next 3 days)
     */
    getExpiringSubscriptions(): Promise<string[]>;
    /**
     * Get expired subscriptions
     */
    getExpiredSubscriptions(): Promise<string[]>;
    /**
     * Process expired subscriptions
     */
    processExpiredSubscriptions(): Promise<void>;
    /**
     * Send renewal reminders
     */
    sendRenewalReminders(): Promise<void>;
    /**
     * Get subscription statistics
     */
    getSubscriptionStatistics(): Promise<{
        totalUsers: number;
        premiumUsers: number;
        freemiumUsers: number;
        activeSubscriptions: number;
        expiredSubscriptions: number;
        expiringSubscriptions: number;
    }>;
    /**
     * Start the renewal checker (runs daily)
     */
    private startRenewalChecker;
    /**
     * Stop the renewal checker
     */
    stopRenewalChecker(): void;
    /**
     * Manual trigger for renewal check (for testing)
     */
    runRenewalCheck(): Promise<void>;
}
export declare const subscriptionService: SubscriptionService;
export default SubscriptionService;
//# sourceMappingURL=subscription-service.d.ts.map