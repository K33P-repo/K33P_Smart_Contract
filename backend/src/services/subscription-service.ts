import pool from '../database/config.js';
import { logger } from '../utils/logger.js';
import { paystackService } from './paystack-service.js';
import cron from 'node-cron';

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

class SubscriptionService {
  private renewalCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startRenewalChecker();
  }

  /**
   * Get subscription status for a user
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT tier, is_active, start_date, end_date, auto_renew 
         FROM subscriptions WHERE user_id = $1`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        // Return default freemium status if no subscription exists
        return {
          userId,
          tier: 'freemium',
          isActive: false,
          startDate: null,
          endDate: null,
          daysRemaining: 0,
          autoRenew: false
        };
      }
      
      const subscription = result.rows[0];
      const now = new Date();
      const endDate = subscription.end_date ? new Date(subscription.end_date) : null;
      const isActive = subscription.tier === 'premium' && 
                      subscription.is_active &&
                      endDate && 
                      endDate > now;
      
      const daysRemaining = isActive && endDate ? 
        Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        userId,
        tier: subscription.tier || 'freemium',
        isActive: isActive || false,
        startDate: subscription.start_date ? new Date(subscription.start_date) : null,
        endDate: endDate,
        daysRemaining: Math.max(0, daysRemaining),
        autoRenew: subscription.auto_renew || false
      };
    } catch (error) {
      logger.error('Failed to get subscription status', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update subscription for a user
   */
  async updateSubscription(userId: string, updates: SubscriptionUpdate): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Check if subscription exists
      const existingSubscription = await client.query(
        'SELECT id FROM subscriptions WHERE user_id = $1',
        [userId]
      );
      
      if (existingSubscription.rows.length === 0) {
        // Create new subscription
        await client.query(
          `INSERT INTO subscriptions (user_id, tier, is_active, start_date, end_date, auto_renew)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            updates.tier || 'freemium',
            updates.isActive !== undefined ? updates.isActive : (updates.tier === 'premium'),
            updates.startDate || (updates.tier === 'premium' ? new Date() : null),
            updates.endDate,
            updates.autoRenew || false
          ]
        );
      } else {
        // Update existing subscription
        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        if (updates.tier !== undefined) {
          updateFields.push(`tier = $${paramIndex++}`);
          values.push(updates.tier);
        }
        if (updates.isActive !== undefined) {
          updateFields.push(`is_active = $${paramIndex++}`);
          values.push(updates.isActive);
        }
        if (updates.startDate !== undefined) {
          updateFields.push(`start_date = $${paramIndex++}`);
          values.push(updates.startDate);
        }
        if (updates.endDate !== undefined) {
          updateFields.push(`end_date = $${paramIndex++}`);
          values.push(updates.endDate);
        }
        if (updates.autoRenew !== undefined) {
          updateFields.push(`auto_renew = $${paramIndex++}`);
          values.push(updates.autoRenew);
        }

        if (updateFields.length > 0) {
          values.push(userId);
          await client.query(
            `UPDATE subscriptions SET ${updateFields.join(', ')} WHERE user_id = $${paramIndex}`,
            values
          );
        }
      }
      
      await client.query('COMMIT');
      
      logger.info('Subscription updated successfully', { 
        userId, 
        updates 
      });
      
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update subscription', { 
        error, 
        userId, 
        updates 
      });
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize premium subscription payment via Paystack
   */
  async initializePremiumSubscription(
    userId: string, 
    email: string, 
    durationMonths: number = 1,
    amount: number = 5000 // 5000 NGN = ~$5 USD
  ): Promise<PaymentResult> {
    try {
      // Check if user already has active premium subscription
      const currentStatus = await this.getSubscriptionStatus(userId);
      if (currentStatus?.tier === 'premium' && currentStatus.isActive) {
        return {
          success: false,
          message: 'User already has an active premium subscription'
        };
      }

      // Use your existing Paystack service
      const paymentResult = await paystackService.initializePayment({
        amount: amount,
        currency: 'NGN', // Use NGN for Paystack
        metadata: {
          userId,
          subscriptionType: 'premium',
          durationMonths,
          custom_fields: [
            {
              display_name: "User ID",
              variable_name: "user_id",
              value: userId
            },
            {
              display_name: "Subscription Type",
              variable_name: "subscription_type", 
              value: "premium"
            },
            {
              display_name: "Duration",
              variable_name: "duration_months",
              value: durationMonths.toString()
            }
          ]
        }
      });

      if (paymentResult.success && paymentResult.data) {
        logger.info('Premium subscription payment initialized', {
          userId,
          email,
          durationMonths,
          amount,
          reference: paymentResult.data.reference
        });

        return {
          success: true,
          paymentUrl: paymentResult.data.authorization_url,
          reference: paymentResult.data.reference,
          message: 'Payment initialized successfully'
        };
      } else {
        logger.error('Failed to initialize payment with Paystack', {
          userId,
          error: paymentResult.error
        });

        return {
          success: false,
          message: paymentResult.error || 'Failed to initialize payment'
        };
      }
    } catch (error) {
      logger.error('Error initializing premium subscription payment', {
        error,
        userId,
        email
      });

      return {
        success: false,
        message: 'Failed to initialize subscription payment'
      };
    }
  }

  /**
   * Verify and activate premium subscription after payment
   */
  async verifyAndActivateSubscription(reference: string): Promise<{ success: boolean; message: string }> {
    try {
      // Use your existing Paystack verification
      const verificationResult = await paystackService.verifyPayment(reference);
      
      if (!verificationResult.success || !verificationResult.data) {
        return {
          success: false,
          message: verificationResult.error || 'Payment verification failed'
        };
      }

      const paymentData = verificationResult.data;
      
      // Check if payment was successful
      if (paymentData.status !== 'success') {
        return {
          success: false,
          message: `Payment not successful. Status: ${paymentData.status}`
        };
      }

      // Extract metadata from your Paystack service format
      const metadata = paymentData.metadata || {};
      const userId = metadata.userId || 
                    (metadata.custom_fields && metadata.custom_fields.find((f: any) => f.variable_name === 'user_id')?.value);
      
      const durationMonths = parseInt(
        metadata.durationMonths || 
        (metadata.custom_fields && metadata.custom_fields.find((f: any) => f.variable_name === 'duration_months')?.value) || 
        '1'
      );

      if (!userId) {
        logger.error('User ID not found in payment metadata', { reference, metadata });
        return {
          success: false,
          message: 'User ID not found in payment data'
        };
      }

      // Activate premium subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);

      const success = await this.updateSubscription(userId, {
        tier: 'premium',
        isActive: true,
        startDate,
        endDate,
        autoRenew: true
      });

      if (success) {
        logger.info('Premium subscription activated after payment verification', {
          userId,
          reference,
          durationMonths,
          startDate,
          endDate
        });

        return {
          success: true,
          message: 'Premium subscription activated successfully'
        };
      } else {
        logger.error('Failed to activate subscription after payment verification', {
          userId,
          reference
        });

        return {
          success: false,
          message: 'Failed to activate subscription'
        };
      }
    } catch (error) {
      logger.error('Error verifying and activating subscription', {
        error,
        reference
      });

      return {
        success: false,
        message: 'Failed to verify and activate subscription'
      };
    }
  }

  /**
   * Handle Paystack webhook for subscription payments
   */
  async handlePaystackWebhook(event: any): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Processing Paystack webhook for subscription', { event: event.event });

      switch (event.event) {
        case 'charge.success':
          return await this.handleSuccessfulPaymentWebhook(event.data);
        
        case 'subscription.create':
          return await this.handleSubscriptionCreatedWebhook(event.data);
        
        case 'subscription.disable':
          return await this.handleSubscriptionCancelledWebhook(event.data);
        
        default:
          logger.info('Unhandled Paystack webhook event', { event: event.event });
          return { success: true, message: 'Event not handled' };
      }
    } catch (error) {
      logger.error('Error processing Paystack webhook', { error, event: event.event });
      return { success: false, message: 'Webhook processing failed' };
    }
  }

  /**
   * Verify Paystack webhook signature
   */
  verifyPaystackWebhookSignature(payload: string, signature: string): boolean {
    return paystackService.verifyWebhookSignature(payload, signature);
  }

  /**
   * Handle successful payment webhook
   */
  private async handleSuccessfulPaymentWebhook(data: any): Promise<{ success: boolean; message: string }> {
    try {
      const metadata = data.metadata || {};
      const userId = metadata.userId;

      if (!userId) {
        logger.error('User ID not found in webhook metadata', { reference: data.reference });
        return { success: false, message: 'User ID not found' };
      }

      // Check if this is a subscription payment
      if (metadata.subscriptionType === 'premium') {
        const durationMonths = parseInt(metadata.durationMonths || '1');
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + durationMonths);

        const success = await this.updateSubscription(userId, {
          tier: 'premium',
          isActive: true,
          startDate,
          endDate,
          autoRenew: true
        });

        if (success) {
          logger.info('Subscription activated via webhook', {
            userId,
            reference: data.reference,
            durationMonths
          });
          return { success: true, message: 'Subscription activated successfully' };
        }
      }

      return { success: false, message: 'Not a subscription payment or activation failed' };
    } catch (error) {
      logger.error('Error handling successful payment webhook', { error, reference: data.reference });
      return { success: false, message: 'Webhook handling failed' };
    }
  }

  /**
   * Handle subscription created webhook
   */
  private async handleSubscriptionCreatedWebhook(data: any): Promise<{ success: boolean; message: string }> {
    logger.info('Subscription created via webhook', {
      subscription_code: data.subscription_code,
      customer: data.customer.email
    });
    return { success: true, message: 'Subscription creation noted' };
  }

  /**
   * Handle subscription cancelled webhook
   */
  private async handleSubscriptionCancelledWebhook(data: any): Promise<{ success: boolean; message: string }> {
    try {
      // Find user by email and cancel subscription
      const client = await pool.connect();
      try {
        const userResult = await client.query(
          'SELECT user_id FROM users WHERE email = $1',
          [data.customer.email]
        );

        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].user_id;
          await this.cancelSubscription(userId);
          logger.info('Subscription cancelled via webhook', { userId });
        }
      } finally {
        client.release();
      }

      return { success: true, message: 'Subscription cancellation processed' };
    } catch (error) {
      logger.error('Error handling subscription cancellation webhook', { error });
      return { success: false, message: 'Cancellation processing failed' };
    }
  }

  /**
   * Activate premium subscription directly (for testing or admin use)
   */
  async activatePremiumSubscription(userId: string, durationMonths: number = 1): Promise<boolean> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);
    
    return await this.updateSubscription(userId, {
      tier: 'premium',
      isActive: true,
      startDate,
      endDate,
      autoRenew: true
    });
  }

  /**
   * Cancel premium subscription
   */
  async cancelSubscription(userId: string): Promise<boolean> {
    return await this.updateSubscription(userId, {
      tier: 'freemium',
      isActive: false,
      autoRenew: false
    });
  }

  /**
   * Check if subscription is expired
   */
  async isSubscriptionExpired(userId: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(userId);
    return status.tier === 'premium' && !status.isActive;
  }

  /**
   * Get users with expiring subscriptions (within next 7 days)
   */
  async getExpiringSubscriptions(): Promise<string[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT user_id FROM subscriptions 
         WHERE tier = 'premium' 
         AND is_active = true
         AND end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' 
         AND end_date > CURRENT_TIMESTAMP`
      );
      
      return result.rows.map(row => row.user_id);
    } catch (error) {
      logger.error('Failed to get expiring subscriptions', { error });
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Get expired subscriptions
   */
  async getExpiredSubscriptions(): Promise<string[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT user_id FROM subscriptions 
         WHERE tier = 'premium' 
         AND is_active = true
         AND end_date <= CURRENT_TIMESTAMP`
      );
      
      return result.rows.map(row => row.user_id);
    } catch (error) {
      logger.error('Failed to get expired subscriptions', { error });
      return [];
    } finally {
      client.release();
    }
  }

  // Add these methods to your existing SubscriptionService class

/**
 * Initialize monthly recurring subscription with phone number
 */
async initializeMonthlyRecurringSubscription(
  userId: string, 
  phone: string, 
  amount: number = 5000 // 5000 NGN = Monthly subscription
): Promise<PaymentResult> {
  try {
    // Check if user already has active premium subscription
    const currentStatus = await this.getSubscriptionStatus(userId);
    if (currentStatus?.tier === 'premium' && currentStatus.isActive) {
      return {
        success: false,
        message: 'User already has an active premium subscription'
      };
    }

    // Create monthly plan if it doesn't exist
    const planName = `K33P Premium Monthly - ${amount} NGN`;
    const planResult = await paystackService.createMonthlySubscriptionPlan(amount, planName);
    
    if (!planResult.success) {
      return {
        success: false,
        message: planResult.error || 'Failed to create subscription plan'
      };
    }

    const planCode = planResult?.data?.plan_code;

    // Initialize recurring subscription with phone number
    // Fix line 197 - remove email from payment initialization
const paymentResult = await paystackService.initializePayment({
  amount: amount,
  currency: 'NGN',
  metadata: {
    userId,
    email, // Move email to metadata
    subscriptionType: 'premium',
    durationMonths,
    custom_fields: [
      {
        display_name: "User ID",
        variable_name: "user_id",
        value: userId
      },
      {
        display_name: "Email",
        variable_name: "email",
        value: email
      },
      {
        display_name: "Subscription Type",
        variable_name: "subscription_type", 
        value: "premium"
      },
      {
        display_name: "Duration",
        variable_name: "duration_months",
        value: durationMonths.toString()
      }
    ]
  }
});

// Fix line 702 - remove phone from SubscriptionUpdate

    if (paymentResult.success && paymentResult.data) {
      logger.info('Monthly recurring subscription initialized', {
        userId,
        phone,
        amount,
        planCode,
        reference: paymentResult.data.reference
      });

      return {
        success: true,
        paymentUrl: paymentResult.data.authorization_url,
        reference: paymentResult.data.reference,
        message: 'Monthly subscription payment initialized successfully'
      };
    } else {
      logger.error('Failed to initialize monthly subscription', {
        userId,
        error: paymentResult.error
      });

      return {
        success: false,
        message: paymentResult.error || 'Failed to initialize monthly subscription'
      };
    }
  } catch (error) {
    logger.error('Error initializing monthly recurring subscription', {
      error,
      userId,
      phone
    });

    return {
      success: false,
      message: 'Failed to initialize monthly subscription'
    };
  }
}

/**
 * Process recurring payment webhook
 */
async handleRecurringPaymentWebhook(event: any): Promise<{ success: boolean; message: string }> {
  try {
    logger.info('Processing recurring payment webhook', { event: event.event });

    switch (event.event) {
      case 'charge.success':
        return await this.handleRecurringChargeSuccess(event.data);
      
      case 'subscription.create':
        return await this.handleRecurringSubscriptionCreated(event.data);
      
      case 'invoice.create':
        return await this.handleMonthlyInvoiceCreated(event.data);
      
      default:
        return { success: true, message: 'Event not handled by recurring service' };
    }
  } catch (error) {
    logger.error('Error processing recurring payment webhook', { error });
    return { success: false, message: 'Recurring webhook processing failed' };
  }
}

/**
 * Handle successful recurring charge
 */
private async handleRecurringChargeSuccess(data: any): Promise<{ success: boolean; message: string }> {
  try {
    const metadata = data.metadata || {};
    const userId = metadata.userId;
    const phone = metadata.userPhone;

    if (!userId || !phone) {
      logger.error('User ID or phone not found in recurring payment', { reference: data.reference });
      return { success: false, message: 'User ID or phone not found' };
    }

    // Extend subscription by 1 month
    const currentStatus = await this.getSubscriptionStatus(userId);
    let newEndDate = new Date();
    
    if (currentStatus.endDate && currentStatus.endDate > new Date()) {
      // Extend from current end date
      newEndDate = new Date(currentStatus.endDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else {
      // Start new subscription period
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    }

    const success = await this.updateSubscription(userId, {
      tier: 'premium',
      isActive: true,
      startDate: currentStatus.startDate || new Date(),
      endDate: newEndDate,
      autoRenew: true,
    });

    if (success) {
      logger.info('Monthly recurring subscription extended', {
        userId,
        phone,
        reference: data.reference,
        newEndDate
      });

      return { success: true, message: 'Monthly subscription extended successfully' };
    } else {
      return { success: false, message: 'Failed to extend subscription' };
    }
  } catch (error) {
    logger.error('Error handling recurring charge success', { error, reference: data.reference });
    return { success: false, message: 'Failed to process recurring payment' };
  }
}

/**
 * Handle recurring subscription created
 */
private async handleRecurringSubscriptionCreated(data: any): Promise<{ success: boolean; message: string }> {
  try {
    logger.info('Recurring subscription activated', {
      subscription_code: data.subscription_code,
      customer_code: data.customer.customer_code,
      next_payment_date: data.next_payment_date
    });

    // Update subscription record with subscription code
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE subscriptions 
         SET subscription_code = $1, next_payment_date = $2, status = 'active'
         WHERE customer_code = $3`,
        [data.subscription_code, new Date(data.next_payment_date), data.customer.customer_code]
      );
    } finally {
      client.release();
    }

    return { success: true, message: 'Recurring subscription activated' };
  } catch (error) {
    logger.error('Error handling recurring subscription creation', { error });
    return { success: false, message: 'Failed to activate recurring subscription' };
  }
}

/**
 * Handle monthly invoice creation
 */
private async handleMonthlyInvoiceCreated(data: any): Promise<{ success: boolean; message: string }> {
  logger.info('Monthly invoice created for recurring subscription', {
    subscription_code: data.subscription.subscription_code,
    amount: data.amount / 100,
    due_date: data.due_date
  });

  // You can send payment reminders here if needed
  return { success: true, message: 'Monthly invoice noted' };
}

/**
 * Cancel recurring subscription
 */
async cancelRecurringSubscription(userId: string): Promise<boolean> {
  try {
    // Get subscription code from database
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT subscription_code FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length > 0 && result.rows[0].subscription_code) {
        const subscriptionCode = result.rows[0].subscription_code;
        
        // Cancel with Paystack
        const cancelResult = await paystackService.cancelSubscription(subscriptionCode);
        
        if (cancelResult.success) {
          // Update local subscription record
          await this.cancelSubscription(userId);
          logger.info('Recurring subscription cancelled', { userId, subscriptionCode });
          return true;
        }
      }
      
      // Fallback to local cancellation
      return await this.cancelSubscription(userId);
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to cancel recurring subscription', { error, userId });
    return false;
  }
}

  /**
   * Process expired subscriptions
   */
  async processExpiredSubscriptions(): Promise<void> {
    try {
      const expiredUserIds = await this.getExpiredSubscriptions();
      
      if (expiredUserIds.length === 0) {
        logger.info('No expired subscriptions to process');
        return;
      }
      
      logger.info(`Processing ${expiredUserIds.length} expired subscriptions`);
      
      for (const userId of expiredUserIds) {
        try {
          await this.cancelSubscription(userId);
          logger.info('Expired subscription processed', { userId });
        } catch (error) {
          logger.error('Failed to process expired subscription', { 
            error, 
            userId 
          });
        }
      }
    } catch (error) {
      logger.error('Failed to process expired subscriptions', { error });
    }
  }

  /**
   * Send renewal reminders
   */
  async sendRenewalReminders(): Promise<void> {
    try {
      const expiringUserIds = await this.getExpiringSubscriptions();
      
      if (expiringUserIds.length === 0) {
        logger.info('No subscriptions expiring soon');
        return;
      }
      
      logger.info(`Found ${expiringUserIds.length} subscriptions expiring soon`);
      
      // TODO: Implement email/notification service to send renewal reminders
      for (const userId of expiringUserIds) {
        logger.info('Renewal reminder needed', { userId });
        // await notificationService.sendRenewalReminder(userId);
      }
    } catch (error) {
      logger.error('Failed to send renewal reminders', { error });
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStatistics(): Promise<{
    totalUsers: number;
    premiumUsers: number;
    freemiumUsers: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    expiringSubscriptions: number;
  }> {
    const client = await pool.connect();
    try {
      const [totalResult, premiumResult, freemiumResult, activeResult, expiredResult, expiringResult] = await Promise.all([
        client.query('SELECT COUNT(*) FROM users'),
        client.query("SELECT COUNT(*) FROM subscriptions WHERE tier = 'premium'"),
        client.query("SELECT COUNT(*) FROM subscriptions WHERE tier = 'freemium'"),
        client.query(
          "SELECT COUNT(*) FROM subscriptions WHERE tier = 'premium' AND is_active = true AND end_date > CURRENT_TIMESTAMP"
        ),
        client.query(
          "SELECT COUNT(*) FROM subscriptions WHERE tier = 'premium' AND is_active = true AND end_date <= CURRENT_TIMESTAMP"
        ),
        client.query(
          `SELECT COUNT(*) FROM subscriptions 
           WHERE tier = 'premium' 
           AND is_active = true
           AND end_date <= CURRENT_TIMESTAMP + INTERVAL '7 days' 
           AND end_date > CURRENT_TIMESTAMP`
        )
      ]);
      
      return {
        totalUsers: Number(totalResult.rows[0].count),
        premiumUsers: Number(premiumResult.rows[0].count),
        freemiumUsers: Number(freemiumResult.rows[0].count),
        activeSubscriptions: Number(activeResult.rows[0].count),
        expiredSubscriptions: Number(expiredResult.rows[0].count),
        expiringSubscriptions: Number(expiringResult.rows[0].count)
      };
    } catch (error) {
      logger.error('Failed to get subscription statistics', { error });
      return {
        totalUsers: 0,
        premiumUsers: 0,
        freemiumUsers: 0,
        activeSubscriptions: 0,
        expiredSubscriptions: 0,
        expiringSubscriptions: 0
      };
    } finally {
      client.release();
    }
  }

  /**
   * Start the renewal checker (runs daily)
   */
  private startRenewalChecker(): void {
    // Run every day at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
      logger.info('Running daily subscription renewal check');
      
      try {
        await this.processExpiredSubscriptions();
        await this.sendRenewalReminders();
        
        const stats = await this.getSubscriptionStatistics();
        logger.info('Daily subscription check completed', { stats });
      } catch (error) {
        logger.error('Daily subscription check failed', { error });
      }
    });
    
    logger.info('Subscription renewal checker started (daily at 9:00 AM)');
  }

  /**
   * Stop the renewal checker
   */
  stopRenewalChecker(): void {
    if (this.renewalCheckInterval) {
      clearInterval(this.renewalCheckInterval);
      this.renewalCheckInterval = null;
      logger.info('Subscription renewal checker stopped');
    }
  }

  /**
   * Manual trigger for renewal check (for testing)
   */
  async runRenewalCheck(): Promise<void> {
    logger.info('Manual subscription renewal check triggered');
    
    try {
      await this.processExpiredSubscriptions();
      await this.sendRenewalReminders();
      
      const stats = await this.getSubscriptionStatistics();
      logger.info('Manual subscription check completed', { stats });
    } catch (error) {
      logger.error('Manual subscription check failed', { error });
    }
  }
}

export const subscriptionService = new SubscriptionService();
export default SubscriptionService;