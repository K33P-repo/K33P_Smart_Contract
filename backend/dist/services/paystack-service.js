import Paystack from 'paystack';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import pool from '../database/config.js';
dotenv.config();
class PaystackService {
    paystack;
    secretKey;
    constructor() {
        this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
        if (!this.secretKey) {
            throw new Error('PAYSTACK_SECRET_KEY is required');
        }
        this.paystack = Paystack(this.secretKey);
        logger.info('PaystackService initialized successfully');
    }
    /**
     * Initialize one-time payment
     */
    async initializePayment(data) {
        try {
            // Use generic email as shown in Paystack docs
            const paymentData = {
                email: 'payment@k33p.app',
                amount: data.amount * 100, // Convert to kobo
                currency: data.currency || 'NGN',
                metadata: data.metadata
            };
            logger.info('Initializing Paystack payment', {
                amount: data.amount,
                currency: paymentData.currency
            });
            const response = await this.paystack.transaction.initialize(paymentData);
            if (response.status) {
                // Store payment initialization in database
                await this.storePaymentRecord({
                    reference: response.data.reference,
                    amount: data.amount,
                    currency: paymentData.currency,
                    userId: data.metadata?.userId,
                    status: 'initialized',
                    access_code: response.data.access_code
                });
                return {
                    success: true,
                    data: {
                        reference: response.data.reference,
                        authorization_url: response.data.authorization_url,
                        access_code: response.data.access_code
                    }
                };
            }
            else {
                throw new Error(response.message || 'Payment initialization failed');
            }
        }
        catch (error) {
            logger.error('Payment initialization failed', { error: error.message });
            return {
                success: false,
                error: error.message || 'Payment initialization failed'
            };
        }
    }
    /**
     * Verify payment transaction
     */
    /**
   * Verify payment transaction
   */
    async verifyPayment(reference) {
        try {
            logger.info('Verifying Paystack payment', { reference });
            const response = await this.paystack.transaction.verify(reference);
            if (response.status) {
                const paymentData = response.data;
                // Update payment record regardless of status
                await this.updatePaymentRecord(reference, {
                    status: paymentData.status,
                    gateway_response: paymentData.gateway_response,
                    paid_at: paymentData.paid_at ? new Date(paymentData.paid_at) : null,
                    authorization: paymentData.authorization
                });
                // Check the actual payment status
                if (paymentData.status === 'success') {
                    return {
                        success: true,
                        data: {
                            reference: paymentData.reference,
                            amount: paymentData.amount / 100,
                            status: paymentData.status,
                            authorization: paymentData.authorization,
                            customer: paymentData.customer,
                            metadata: paymentData.metadata
                        }
                    };
                }
                else {
                    // Payment verification was successful, but payment itself failed
                    return {
                        success: false,
                        error: `Payment status: ${paymentData.status}. ${paymentData.gateway_response || 'Payment not completed'}`,
                        data: paymentData // Include the data for debugging
                    };
                }
            }
            else {
                // Paystack API call failed
                await this.updatePaymentRecord(reference, {
                    status: 'failed',
                    gateway_response: response.message || 'Payment verification failed'
                });
                return {
                    success: false,
                    error: response.message || 'Payment verification failed'
                };
            }
        }
        catch (error) {
            logger.error('Payment verification failed', { error: error.message, reference });
            // Update status to failed in database
            await this.updatePaymentRecord(reference, {
                status: 'failed',
                gateway_response: error.message
            });
            return {
                success: false,
                error: error.message || 'Payment verification failed'
            };
        }
    }
    /**
     * Charge authorization for recurring payments
     */
    async chargeAuthorization(data) {
        try {
            const chargeData = {
                authorization_code: data.authorization_code,
                email: data.email,
                amount: data.amount * 100,
                currency: data.currency || 'NGN',
                metadata: data.metadata
            };
            logger.info('Charging authorization for recurring payment', {
                authorization_code: data.authorization_code,
                amount: data.amount
            });
            const response = await this.paystack.transaction.charge_authorization(chargeData);
            if (response.status) {
                // Store recurring charge record
                await this.storePaymentRecord({
                    reference: response.data.reference,
                    amount: data.amount,
                    currency: chargeData.currency,
                    userId: data.metadata?.userId,
                    status: 'initialized',
                    authorization_code: data.authorization_code,
                    is_recurring: true
                });
                return {
                    success: true,
                    data: {
                        reference: response.data.reference,
                        status: response.data.status
                    }
                };
            }
            else {
                throw new Error(response.message || 'Charge authorization failed');
            }
        }
        catch (error) {
            logger.error('Charge authorization failed', { error: error.message });
            return {
                success: false,
                error: error.message || 'Charge authorization failed'
            };
        }
    }
    /**
     * Create subscription plan
     */
    async createSubscriptionPlan(data) {
        try {
            const planData = {
                name: data.name,
                interval: data.interval,
                amount: data.amount * 100,
                currency: data.currency || 'NGN',
                description: `K33P Premium subscription - ${data.interval} billing`
            };
            logger.info('Creating subscription plan', planData);
            const response = await this.paystack.plan.create(planData);
            if (response.status) {
                return {
                    success: true,
                    data: {
                        plan_code: response.data.plan_code,
                        name: response.data.name,
                        amount: response.data.amount / 100,
                        interval: response.data.interval
                    }
                };
            }
            else {
                throw new Error(response.message || 'Subscription plan creation failed');
            }
        }
        catch (error) {
            logger.error('Subscription plan creation failed', { error: error.message });
            return {
                success: false,
                error: error.message || 'Subscription plan creation failed'
            };
        }
    }
    /**
     * Create subscription
     */
    async createSubscription(data) {
        try {
            const subscriptionData = {
                customer: data.customer,
                plan: data.plan,
                authorization: data.authorization
            };
            logger.info('Creating subscription', {
                customer: data.customer,
                plan: data.plan
            });
            const response = await this.paystack.subscription.create(subscriptionData);
            if (response.status) {
                return {
                    success: true,
                    data: {
                        subscription_code: response.data.subscription_code,
                        status: response.data.status,
                        next_payment_date: response.data.next_payment_date
                    }
                };
            }
            else {
                throw new Error(response.message || 'Subscription creation failed');
            }
        }
        catch (error) {
            logger.error('Subscription creation failed', { error: error.message });
            return {
                success: false,
                error: error.message || 'Subscription creation failed'
            };
        }
    }
    /**
     * Store payment record in database
     */
    async storePaymentRecord(data) {
        const client = await pool.connect();
        try {
            await client.query(`INSERT INTO payment_transactions 
         (reference, amount, currency, user_id, status, access_code, authorization_code, is_recurring, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`, [
                data.reference,
                data.amount,
                data.currency,
                data.userId,
                data.status,
                data.access_code,
                data.authorization_code,
                data.is_recurring || false
            ]);
        }
        catch (error) {
            logger.error('Failed to store payment record', { error });
        }
        finally {
            client.release();
        }
    }
    /**
     * Update payment record in database
     */
    async updatePaymentRecord(reference, data) {
        const client = await pool.connect();
        try {
            const updateFields = [];
            const values = [];
            let paramIndex = 1;
            if (data.status) {
                updateFields.push(`status = $${paramIndex++}`);
                values.push(data.status);
            }
            if (data.gateway_response) {
                updateFields.push(`gateway_response = $${paramIndex++}`);
                values.push(data.gateway_response);
            }
            if (data.paid_at) {
                updateFields.push(`paid_at = $${paramIndex++}`);
                values.push(data.paid_at);
            }
            if (data.authorization) {
                updateFields.push(`authorization_code = $${paramIndex++}`);
                values.push(data.authorization.authorization_code);
            }
            if (updateFields.length > 0) {
                values.push(reference);
                await client.query(`UPDATE payment_transactions SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE reference = $${paramIndex}`, values);
            }
        }
        catch (error) {
            logger.error('Failed to update payment record', { error });
        }
        finally {
            client.release();
        }
    }
    // Add this to PaystackService
    async createAutoRenewSubscription(userId, email, amount = 5000) {
        try {
            // Create monthly plan
            const planResult = await this.createSubscriptionPlan({
                name: `K33P Premium Monthly - ${amount} NGN`,
                amount: amount,
                interval: 'monthly'
            });
            if (!planResult.success) {
                return planResult;
            }
            // Initialize subscription (not one-time payment)
            const subscriptionData = {
                customer: email,
                plan: planResult?.data?.plan_code,
                authorization: '' // You need authorization from initial payment
            };
            const response = await this.paystack.subscription.create(subscriptionData);
            if (response.status) {
                return {
                    success: true,
                    data: {
                        subscription_code: response.data.subscription_code,
                        status: response.data.status,
                        next_payment_date: response.data.next_payment_date
                    }
                };
            }
            else {
                throw new Error(response.message);
            }
        }
        catch (error) {
            logger.error('Auto-renew subscription creation failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }
    // Add these methods to your PaystackService class
    /**
     * Verify Paystack webhook signature
     */
    async verifyWebhookSignature(payload, signature) {
        try {
            const crypto = await import('crypto');
            const hash = crypto
                .createHmac('sha512', this.secretKey)
                .update(payload)
                .digest('hex');
            return hash === signature;
        }
        catch (error) {
            logger.error('Webhook signature verification failed', { error });
            return false;
        }
    }
    /**
     * Process webhook event
     */
    /**
     * Process webhook event
     */
    async processWebhookEvent(event) {
        try {
            logger.info('Processing Paystack webhook event', { event: event.event });
            // Handle different event types
            switch (event.event) {
                case 'charge.success':
                    return await this.handleChargeSuccess(event.data);
                case 'subscription.create':
                    return await this.handleSubscriptionCreate(event.data);
                case 'subscription.disable':
                    return await this.handleSubscriptionDisable(event.data);
                case 'invoice.create':
                    return await this.handleInvoiceCreate(event.data);
                default:
                    logger.info('Unhandled webhook event', { event: event.event });
                    return { success: true, message: 'Event not handled' };
            }
        }
        catch (error) {
            logger.error('Webhook event processing failed', { error: error.message });
            return { success: false, message: error.message }; // Changed from error to message
        }
    }
    /**
     * Get subscription details
     */
    async getSubscription(subscriptionCode) {
        try {
            logger.info('Getting subscription details', { subscriptionCode });
            const response = await this.paystack.subscription.get(subscriptionCode);
            if (response.status) {
                return {
                    success: true,
                    data: response.data
                };
            }
            else {
                throw new Error(response.message || 'Failed to get subscription');
            }
        }
        catch (error) {
            logger.error('Failed to get subscription', { error: error.message, subscriptionCode });
            return {
                success: false,
                error: error.message || 'Failed to get subscription'
            };
        }
    }
    /**
     * Create monthly subscription plan (alias for createSubscriptionPlan)
     */
    async createMonthlySubscriptionPlan(amount, name) {
        return this.createSubscriptionPlan({
            name: name || `K33P Premium Monthly - ${amount} NGN`,
            amount: amount,
            interval: 'monthly'
        });
    }
    /**
     * Initialize recurring subscription
     */
    async initializeRecurringSubscription(phone, planCode, metadata) {
        try {
            const subscriptionData = {
                customer: phone, // Using phone as customer identifier
                plan: planCode,
                authorization: '', // This should be set after initial authorization
                metadata: metadata
            };
            logger.info('Initializing recurring subscription', { phone, planCode });
            const response = await this.paystack.subscription.create(subscriptionData);
            if (response.status) {
                return {
                    success: true,
                    data: {
                        subscription_code: response.data.subscription_code,
                        status: response.data.status,
                        next_payment_date: response.data.next_payment_date
                    }
                };
            }
            else {
                throw new Error(response.message || 'Recurring subscription initialization failed');
            }
        }
        catch (error) {
            logger.error('Recurring subscription initialization failed', { error: error.message });
            return {
                success: false,
                error: error.message || 'Recurring subscription initialization failed'
            };
        }
    }
    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionCode) {
        try {
            logger.info('Cancelling subscription', { subscriptionCode });
            const response = await this.paystack.subscription.disable(subscriptionCode);
            if (response.status) {
                return {
                    success: true,
                    data: {
                        subscription_code: response.data.subscription_code,
                        status: response.data.status
                    }
                };
            }
            else {
                throw new Error(response.message || 'Subscription cancellation failed');
            }
        }
        catch (error) {
            logger.error('Subscription cancellation failed', { error: error.message, subscriptionCode });
            return {
                success: false,
                error: error.message || 'Subscription cancellation failed'
            };
        }
    }
    // Private helper methods for webhook processing
    async handleChargeSuccess(data) {
        logger.info('Charge successful', {
            reference: data.reference,
            amount: data.amount,
            customer: data.customer?.email
        });
        return { success: true, message: 'Charge success processed' };
    }
    async handleSubscriptionCreate(data) {
        logger.info('Subscription created', {
            subscription_code: data.subscription_code,
            customer: data.customer?.email
        });
        return { success: true, message: 'Subscription creation processed' };
    }
    async handleSubscriptionDisable(data) {
        logger.info('Subscription disabled', {
            subscription_code: data.subscription_code,
            customer: data.customer?.email
        });
        return { success: true, message: 'Subscription disable processed' };
    }
    async handleInvoiceCreate(data) {
        logger.info('Invoice created', {
            subscription: data.subscription?.subscription_code,
            amount: data.amount
        });
        return { success: true, message: 'Invoice creation processed' };
    }
    /**
     * Get configuration for frontend
     */
    getPublicConfig() {
        return {
            publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
            subscriptionAmount: parseInt(process.env.SUBSCRIPTION_AMOUNT || '5000'),
            subscriptionCurrency: process.env.SUBSCRIPTION_CURRENCY || 'NGN'
        };
    }
}
export const paystackService = new PaystackService();
export default PaystackService;
//# sourceMappingURL=paystack-service.js.map