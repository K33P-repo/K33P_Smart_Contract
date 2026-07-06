declare class PaystackService {
    private paystack;
    private secretKey;
    constructor();
    /**
     * Initialize one-time payment
     */
    initializePayment(data: {
        amount: number;
        currency?: string;
        callback_url?: string;
        metadata?: any;
    }): Promise<{
        success: boolean;
        data: {
            reference: any;
            authorization_url: any;
            access_code: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Verify payment transaction
     */
    /**
   * Verify payment transaction
   */
    verifyPayment(reference: string): Promise<{
        success: boolean;
        data: {
            reference: any;
            amount: number;
            status: any;
            authorization: any;
            customer: any;
            metadata: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        data: any;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Charge authorization for recurring payments
     */
    chargeAuthorization(data: {
        authorization_code: string;
        email: string;
        amount: number;
        currency?: string;
        metadata?: any;
    }): Promise<{
        success: boolean;
        data: {
            reference: any;
            status: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Create subscription plan
     */
    createSubscriptionPlan(data: {
        name: string;
        amount: number;
        interval: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
        currency?: string;
    }): Promise<{
        success: boolean;
        data: {
            plan_code: any;
            name: any;
            amount: number;
            interval: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Create subscription
     */
    createSubscription(data: {
        customer: string;
        plan: string;
        authorization: string;
    }): Promise<{
        success: boolean;
        data: {
            subscription_code: any;
            status: any;
            next_payment_date: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Store payment record in database
     */
    private storePaymentRecord;
    /**
     * Update payment record in database
     */
    private updatePaymentRecord;
    createAutoRenewSubscription(userId: string, email: string, amount?: number): Promise<{
        success: boolean;
        data: {
            plan_code: any;
            name: any;
            amount: number;
            interval: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            subscription_code: any;
            status: any;
            next_payment_date: any;
        };
    }>;
    /**
     * Verify Paystack webhook signature
     */
    verifyWebhookSignature(payload: string, signature: string): Promise<boolean>;
    /**
     * Process webhook event
     */
    /**
     * Process webhook event
     */
    processWebhookEvent(event: any): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Get subscription details
     */
    getSubscription(subscriptionCode: string): Promise<{
        success: boolean;
        data: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Create monthly subscription plan (alias for createSubscriptionPlan)
     */
    createMonthlySubscriptionPlan(amount: number, name?: string): Promise<{
        success: boolean;
        data: {
            plan_code: any;
            name: any;
            amount: number;
            interval: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Initialize recurring subscription
     */
    initializeRecurringSubscription(phone: string, planCode: string, metadata?: any): Promise<{
        success: boolean;
        data: {
            subscription_code: any;
            status: any;
            next_payment_date: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Cancel subscription
     */
    cancelSubscription(subscriptionCode: string): Promise<{
        success: boolean;
        data: {
            subscription_code: any;
            status: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    private handleChargeSuccess;
    private handleSubscriptionCreate;
    private handleSubscriptionDisable;
    private handleInvoiceCreate;
    /**
     * Get configuration for frontend
     */
    getPublicConfig(): {
        publicKey: string;
        subscriptionAmount: number;
        subscriptionCurrency: string;
    };
}
export declare const paystackService: PaystackService;
export default PaystackService;
//# sourceMappingURL=paystack-service.d.ts.map