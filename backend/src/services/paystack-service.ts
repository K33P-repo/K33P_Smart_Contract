import Paystack from 'paystack';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import pool from '../database/config.js';

dotenv.config();

interface PaystackConfig {
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  subscriptionAmount: number;
  subscriptionCurrency: string;
}

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

class PaystackService {
  private paystack: any;
  private config: PaystackConfig;

  constructor() {
    this.config = {
      secretKey: process.env.PAYSTACK_SECRET_KEY || '',
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
      webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
      subscriptionAmount: parseInt(process.env.SUBSCRIPTION_AMOUNT || '399'),
      subscriptionCurrency: process.env.SUBSCRIPTION_CURRENCY || 'USD'
    };

    if (!this.config.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is required');
    }

    this.paystack = Paystack(this.config.secretKey);
    logger.info('PaystackService initialized successfully');
  }

  /**
   * Initialize a payment transaction
   */
  async initializePayment(data: PaymentInitializationData) {
    try {
      const paymentData = {
        email: data.email,
        amount: data.amount * 100, // Paystack expects amount in kobo (cents)
        currency: data.currency || this.config.subscriptionCurrency,
        callback_url: data.callback_url,
        metadata: data.metadata || {}
      };

      logger.info('Initializing Paystack payment', { 
        email: data.email, 
        amount: data.amount,
        currency: paymentData.currency
      });

      const response = await this.paystack.transaction.initialize(paymentData);
      
      if (response.status) {
        // Store payment initialization in database
        await this.storePaymentRecord({
          reference: response.data.reference,
          email: data.email,
          amount: data.amount,
          currency: paymentData.currency,
          userId: data.metadata?.userId,
          status: 'initialized'
        });

        return {
          success: true,
          data: {
            reference: response.data.reference,
            authorization_url: response.data.authorization_url,
            access_code: response.data.access_code
          }
        };
      } else {
        throw new Error(response.message || 'Payment initialization failed');
      }
    } catch (error: any) {
      logger.error('Payment initialization failed', { error: error.message });
      return {
        success: false,
        error: error.message || 'Payment initialization failed'
      };
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(reference: string) {
    try {
      logger.info('Verifying Paystack payment', { reference });
      
      const response = await this.paystack.transaction.verify(reference);
      
      if (response.status && response.data.status === 'success') {
        // Update payment record in database
        await this.updatePaymentRecord(reference, {
          status: 'success',
          gateway_response: response.data.gateway_response,
          paid_at: new Date(response.data.paid_at),
          channel: response.data.channel,
          fees: response.data.fees / 100 // Convert from kobo to main currency
        });

        return {
          success: true,
          data: {
            reference: response.data.reference,
            amount: response.data.amount / 100, // Convert from kobo
            currency: response.data.currency,
            status: response.data.status,
            paid_at: response.data.paid_at,
            customer: response.data.customer,
            metadata: response.data.metadata
          }
        };
      } else {
        await this.updatePaymentRecord(reference, {
          status: 'failed',
          gateway_response: response.data?.gateway_response || 'Payment verification failed'
        });
        
        return {
          success: false,
          error: 'Payment verification failed'
        };
      }
    } catch (error: any) {
      logger.error('Payment verification failed', { error: error.message, reference });
      return {
        success: false,
        error: error.message || 'Payment verification failed'
      };
    }
  }

  /**
   * Create a subscription plan
   */
  async createSubscriptionPlan() {
    try {
      const planData = {
        name: 'K33P Premium Monthly',
        interval: 'monthly',
        amount: this.config.subscriptionAmount * 100, // Convert to kobo
        currency: this.config.subscriptionCurrency,
        description: 'K33P Premium subscription - Monthly billing'
      };

      logger.info('Creating Paystack subscription plan', planData);
      
      const response = await this.paystack.plan.create(planData);
      
      if (response.status) {
        return {
          success: true,
          data: {
            plan_code: response.data.plan_code,
            name: response.data.name,
            amount: response.data.amount / 100,
            interval: response.data.interval,
            currency: response.data.currency
          }
        };
      } else {
        throw new Error(response.message || 'Plan creation failed');
      }
    } catch (error: any) {
      logger.error('Subscription plan creation failed', { error: error.message });
      return {
        success: false,
        error: error.message || 'Plan creation failed'
      };
    }
  }

  /**
   * Create a subscription for a customer
   */
  async createSubscription(data: SubscriptionData) {
    try {
      const subscriptionData = {
        customer: data.email,
        plan: data.planCode,
        authorization: '', // This should be obtained from a successful transaction
        start_date: new Date().toISOString()
      };

      logger.info('Creating Paystack subscription', { 
        email: data.email, 
        planCode: data.planCode 
      });
      
      const response = await this.paystack.subscription.create(subscriptionData);
      
      if (response.status) {
        return {
          success: true,
          data: {
            subscription_code: response.data.subscription_code,
            email_token: response.data.email_token,
            status: response.data.status,
            next_payment_date: response.data.next_payment_date
          }
        };
      } else {
        throw new Error(response.message || 'Subscription creation failed');
      }
    } catch (error: any) {
      logger.error('Subscription creation failed', { error: error.message });
      return {
        success: false,
        error: error.message || 'Subscription creation failed'
      };
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionCode: string) {
    try {
      logger.info('Cancelling Paystack subscription', { subscriptionCode });
      
      const response = await this.paystack.subscription.disable({
        code: subscriptionCode,
        token: '' // Email token from subscription creation
      });
      
      if (response.status) {
        return {
          success: true,
          message: 'Subscription cancelled successfully'
        };
      } else {
        throw new Error(response.message || 'Subscription cancellation failed');
      }
    } catch (error: any) {
      logger.error('Subscription cancellation failed', { error: error.message });
      return {
        success: false,
        error: error.message || 'Subscription cancellation failed'
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const hash = crypto.createHmac('sha512', this.config.webhookSecret)
        .update(payload)
        .digest('hex');
      
      return hash === signature;
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      return false;
    }
  }

  /**
   * Process webhook events
   */
  async processWebhookEvent(event: any) {
    try {
      logger.info('Processing Paystack webhook event', { event: event.event });
      
      switch (event.event) {
        case 'charge.success':
          await this.handleSuccessfulPayment(event.data);
          break;
        case 'subscription.create':
          await this.handleSubscriptionCreated(event.data);
          break;
        case 'subscription.disable':
          await this.handleSubscriptionCancelled(event.data);
          break;
        case 'invoice.create':
        case 'invoice.payment_failed':
          await this.handleInvoiceEvent(event.data, event.event);
          break;
        default:
          logger.info('Unhandled webhook event', { event: event.event });
      }
      
      return { success: true };
    } catch (error: any) {
      logger.error('Webhook event processing failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle successful payment
   */
  private async handleSuccessfulPayment(data: any) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update payment record
      await client.query(
        `UPDATE payment_transactions 
         SET status = 'success', paid_at = $1, gateway_response = $2 
         WHERE reference = $3`,
        [new Date(data.paid_at), data.gateway_response, data.reference]
      );
      
      // If this is a subscription payment, update user subscription
      if (data.metadata && data.metadata.userId) {
        await client.query(
          `UPDATE users 
           SET subscription_tier = 'premium', 
               subscription_start_date = CURRENT_TIMESTAMP,
               subscription_end_date = CURRENT_TIMESTAMP + INTERVAL '1 month'
           WHERE user_id = $1`,
          [data.metadata.userId]
        );
      }
      
      await client.query('COMMIT');
      logger.info('Successfully processed payment', { reference: data.reference });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle subscription created
   */
  private async handleSubscriptionCreated(data: any) {
    logger.info('Subscription created', { 
      subscription_code: data.subscription_code,
      customer: data.customer.email 
    });
  }

  /**
   * Handle subscription cancelled
   */
  private async handleSubscriptionCancelled(data: any) {
    const client = await pool.connect();
    try {
      // Find user by email and update subscription status
      await client.query(
        `UPDATE users 
         SET subscription_tier = 'freemium', 
             subscription_end_date = CURRENT_TIMESTAMP 
         WHERE email = $1`,
        [data.customer.email]
      );
      
      logger.info('Subscription cancelled', { 
        subscription_code: data.subscription_code,
        customer: data.customer.email 
      });
    } finally {
      client.release();
    }
  }

  /**
   * Handle invoice events
   */
  private async handleInvoiceEvent(data: any, eventType: string) {
    logger.info('Invoice event received', { 
      event: eventType,
      subscription: data.subscription.subscription_code 
    });
  }

  /**
   * Store payment record in database
   */
  private async storePaymentRecord(data: any) {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO payment_transactions 
         (reference, email, amount, currency, user_id, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [data.reference, data.email, data.amount, data.currency, data.userId, data.status]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update payment record in database
   */
  private async updatePaymentRecord(reference: string, data: any) {
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
      if (data.channel) {
        updateFields.push(`channel = $${paramIndex++}`);
        values.push(data.channel);
      }
      if (data.fees) {
        updateFields.push(`fees = $${paramIndex++}`);
        values.push(data.fees);
      }

      if (updateFields.length > 0) {
        values.push(reference);
        await client.query(
          `UPDATE payment_transactions SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE reference = $${paramIndex}`,
          values
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * Get configuration for frontend
   */
  getPublicConfig() {
    return {
      publicKey: this.config.publicKey,
      subscriptionAmount: this.config.subscriptionAmount,
      subscriptionCurrency: this.config.subscriptionCurrency
    };
  }
}

export const paystackService = new PaystackService();
export default PaystackService;