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
    isActive?: boolean;
    startDate?: Date;
    endDate?: Date;
    autoRenew?: boolean;
}
interface PaymentResult {
    success: boolean;
    paymentUrl?: string;
    reference?: string;
    message?: string;
}
declare class SubscriptionService {
    private renewalCheckInterval;
    constructor();
    /**
     * Get subscription status for a user
     */
    getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>;
    /**
     * Update subscription for a user
     */
    updateSubscription(userId: string, updates: SubscriptionUpdate): Promise<boolean>;
    /**
     * Initialize premium subscription payment via Paystack
     */
    initializePremiumSubscription(userId: string, email: string, durationMonths?: number, amount?: number): Promise<PaymentResult>;
    /**
     * Verify and activate premium subscription after payment
     */
    verifyAndActivateSubscription(reference: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Handle Paystack webhook for subscription payments
     */
    handlePaystackWebhook(event: any): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Verify Paystack webhook signature
     */
    verifyPaystackWebhookSignature(payload: string, signature: string): Promise<boolean>;
    /**
     * Handle successful payment webhook
     */
    private handleSuccessfulPaymentWebhook;
    /**
     * Handle subscription created webhook
     */
    private handleSubscriptionCreatedWebhook;
    /**
     * Handle subscription cancelled webhook
     */
    private handleSubscriptionCancelledWebhook;
    /**
     * Activate premium subscription directly (for testing or admin use)
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
     * Get users with expiring subscriptions (within next 7 days)
     */
    getExpiringSubscriptions(): Promise<string[]>;
    /**
     * Get expired subscriptions
     */
    getExpiredSubscriptions(): Promise<string[]>;
    /**
     * Initialize monthly recurring subscription with phone number
     */
    /**
     * Initialize monthly recurring subscription with phone number
     */
    initializeMonthlyRecurringSubscription(userId: string, phone: string, amount?: number): Promise<PaymentResult>;
    /**
     * Process recurring payment webhook
     */
    handleRecurringPaymentWebhook(event: any): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Handle successful recurring charge
     */
    private handleRecurringChargeSuccess;
    /**
     * Handle recurring subscription created
     */
    private handleRecurringSubscriptionCreated;
    /**
     * Handle monthly invoice creation
     */
    private handleMonthlyInvoiceCreated;
    /**
     * Cancel recurring subscription
     */
    cancelRecurringSubscription(userId: string): Promise<boolean>;
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