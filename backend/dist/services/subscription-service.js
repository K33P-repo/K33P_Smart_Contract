import pool from '../database/config.js';
import { logger } from '../utils/logger.js';
import cron from 'node-cron';
class SubscriptionService {
    renewalCheckInterval = null;
    constructor() {
        this.startRenewalChecker();
    }
    /**
     * Get subscription status for a user
     */
    async getSubscriptionStatus(userId) {
        const client = await pool.connect();
        try {
            const result = await client.query(`SELECT subscription_tier, subscription_start_date, subscription_end_date 
         FROM users WHERE user_id = $1`, [userId]);
            if (result.rows.length === 0) {
                return null;
            }
            const subscription = result.rows[0];
            const now = new Date();
            const endDate = subscription.subscription_end_date ? new Date(subscription.subscription_end_date) : null;
            const isActive = subscription.subscription_tier === 'premium' &&
                endDate &&
                endDate > now;
            const daysRemaining = isActive && endDate ?
                Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            return {
                userId,
                tier: subscription.subscription_tier || 'freemium',
                isActive: isActive || false,
                startDate: subscription.subscription_start_date ? new Date(subscription.subscription_start_date) : null,
                endDate: endDate,
                daysRemaining: Math.max(0, daysRemaining),
                autoRenew: false // TODO: Add auto_renew column to users table
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Update subscription for a user
     */
    async updateSubscription(userId, updates) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const updateFields = [];
            const values = [];
            let paramIndex = 1;
            if (updates.tier) {
                updateFields.push(`subscription_tier = $${paramIndex++}`);
                values.push(updates.tier);
            }
            if (updates.startDate) {
                updateFields.push(`subscription_start_date = $${paramIndex++}`);
                values.push(updates.startDate);
            }
            if (updates.endDate) {
                updateFields.push(`subscription_end_date = $${paramIndex++}`);
                values.push(updates.endDate);
            }
            if (updateFields.length > 0) {
                values.push(userId);
                await client.query(`UPDATE users SET ${updateFields.join(', ')} WHERE user_id = $${paramIndex}`, values);
            }
            await client.query('COMMIT');
            logger.info('Subscription updated successfully', {
                userId,
                updates
            });
            return true;
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to update subscription', {
                error,
                userId,
                updates
            });
            return false;
        }
        finally {
            client.release();
        }
    }
    /**
     * Activate premium subscription
     */
    async activatePremiumSubscription(userId, durationMonths = 1) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + durationMonths);
        return await this.updateSubscription(userId, {
            tier: 'premium',
            startDate,
            endDate
        });
    }
    /**
     * Cancel premium subscription
     */
    async cancelSubscription(userId) {
        return await this.updateSubscription(userId, {
            tier: 'freemium',
            endDate: new Date() // Set end date to now
        });
    }
    /**
     * Check if subscription is expired
     */
    async isSubscriptionExpired(userId) {
        const status = await this.getSubscriptionStatus(userId);
        if (!status)
            return true;
        return status.tier === 'premium' && !status.isActive;
    }
    /**
     * Get users with expiring subscriptions (within next 3 days)
     */
    async getExpiringSubscriptions() {
        const client = await pool.connect();
        try {
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            const result = await client.query(`SELECT user_id FROM users 
         WHERE subscription_tier = 'premium' 
         AND subscription_end_date <= $1 
         AND subscription_end_date > CURRENT_TIMESTAMP`, [threeDaysFromNow]);
            return result.rows.map(row => row.user_id);
        }
        finally {
            client.release();
        }
    }
    /**
     * Get expired subscriptions
     */
    async getExpiredSubscriptions() {
        const client = await pool.connect();
        try {
            const result = await client.query(`SELECT user_id FROM users 
         WHERE subscription_tier = 'premium' 
         AND subscription_end_date <= CURRENT_TIMESTAMP`);
            return result.rows.map(row => row.user_id);
        }
        finally {
            client.release();
        }
    }
    /**
     * Process expired subscriptions
     */
    async processExpiredSubscriptions() {
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
                }
                catch (error) {
                    logger.error('Failed to process expired subscription', {
                        error,
                        userId
                    });
                }
            }
        }
        catch (error) {
            logger.error('Failed to process expired subscriptions', { error });
        }
    }
    /**
     * Send renewal reminders
     */
    async sendRenewalReminders() {
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
        }
        catch (error) {
            logger.error('Failed to send renewal reminders', { error });
        }
    }
    /**
     * Get subscription statistics
     */
    async getSubscriptionStatistics() {
        const client = await pool.connect();
        try {
            const [totalResult, premiumResult, freemiumResult, activeResult, expiredResult, expiringResult] = await Promise.all([
                client.query('SELECT COUNT(*) FROM users'),
                client.query("SELECT COUNT(*) FROM users WHERE subscription_tier = 'premium'"),
                client.query("SELECT COUNT(*) FROM users WHERE subscription_tier = 'freemium'"),
                client.query("SELECT COUNT(*) FROM users WHERE subscription_tier = 'premium' AND subscription_end_date > CURRENT_TIMESTAMP"),
                client.query("SELECT COUNT(*) FROM users WHERE subscription_tier = 'premium' AND subscription_end_date <= CURRENT_TIMESTAMP"),
                client.query(`SELECT COUNT(*) FROM users 
           WHERE subscription_tier = 'premium' 
           AND subscription_end_date <= CURRENT_TIMESTAMP + INTERVAL '3 days' 
           AND subscription_end_date > CURRENT_TIMESTAMP`)
            ]);
            return {
                totalUsers: Number(totalResult.rows[0].count),
                premiumUsers: Number(premiumResult.rows[0].count),
                freemiumUsers: Number(freemiumResult.rows[0].count),
                activeSubscriptions: Number(activeResult.rows[0].count),
                expiredSubscriptions: Number(expiredResult.rows[0].count),
                expiringSubscriptions: Number(expiringResult.rows[0].count)
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Start the renewal checker (runs daily)
     */
    startRenewalChecker() {
        // Run every day at 9:00 AM
        cron.schedule('0 9 * * *', async () => {
            logger.info('Running daily subscription renewal check');
            try {
                await this.processExpiredSubscriptions();
                await this.sendRenewalReminders();
                const stats = await this.getSubscriptionStatistics();
                logger.info('Daily subscription check completed', { stats });
            }
            catch (error) {
                logger.error('Daily subscription check failed', { error });
            }
        });
        logger.info('Subscription renewal checker started (daily at 9:00 AM)');
    }
    /**
     * Stop the renewal checker
     */
    stopRenewalChecker() {
        if (this.renewalCheckInterval) {
            clearInterval(this.renewalCheckInterval);
            this.renewalCheckInterval = null;
            logger.info('Subscription renewal checker stopped');
        }
    }
    /**
     * Manual trigger for renewal check (for testing)
     */
    async runRenewalCheck() {
        logger.info('Manual subscription renewal check triggered');
        try {
            await this.processExpiredSubscriptions();
            await this.sendRenewalReminders();
            const stats = await this.getSubscriptionStatistics();
            logger.info('Manual subscription check completed', { stats });
        }
        catch (error) {
            logger.error('Manual subscription check failed', { error });
        }
    }
}
export const subscriptionService = new SubscriptionService();
export default SubscriptionService;
//# sourceMappingURL=subscription-service.js.map