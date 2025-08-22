interface PaymentInitializationData {
    email: string;
    amount: number;
    currency?: string;
    plan?: string;
    callback_url?: string;
    metadata?: {
        userId: string;
        subscriptionType: 'premium';
        [key: string]: any;
    };
}
interface SubscriptionData {
    userId: string;
    email: string;
    planCode?: string;
}
declare class PaystackService {
    private paystack;
    private config;
    constructor();
    /**
     * Initialize a payment transaction
     */
    initializePayment(data: PaymentInitializationData): Promise<{
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
     * Verify a payment transaction
     */
    verifyPayment(reference: string): Promise<{
        success: boolean;
        data: {
            reference: any;
            amount: number;
            currency: any;
            status: any;
            paid_at: any;
            customer: any;
            metadata: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Create a subscription plan
     */
    createSubscriptionPlan(): Promise<{
        success: boolean;
        data: {
            plan_code: any;
            name: any;
            amount: number;
            interval: any;
            currency: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    /**
     * Create a subscription for a customer
     */
    createSubscription(data: SubscriptionData): Promise<{
        success: boolean;
        data: {
            subscription_code: any;
            email_token: any;
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
     * Cancel a subscription
     */
    cancelSubscription(subscriptionCode: string): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message?: undefined;
    }>;
    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload: string, signature: string): boolean;
    /**
     * Process webhook events
     */
    processWebhookEvent(event: any): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    /**
     * Handle successful payment
     */
    private handleSuccessfulPayment;
    /**
     * Handle subscription created
     */
    private handleSubscriptionCreated;
    /**
     * Handle subscription cancelled
     */
    private handleSubscriptionCancelled;
    /**
     * Handle invoice events
     */
    private handleInvoiceEvent;
    /**
     * Store payment record in database
     */
    private storePaymentRecord;
    /**
     * Update payment record in database
     */
    private updatePaymentRecord;
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