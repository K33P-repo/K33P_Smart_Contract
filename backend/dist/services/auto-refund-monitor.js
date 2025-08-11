/**
 * Automatic Refund Monitor Service
 * Monitors incoming 2 ADA deposits and automatically processes refunds
 * Mobile-optimized for real-time transaction processing
 */
import { EnhancedK33PManagerDB } from '../enhanced-k33p-manager-db.js';
import { dbService } from '../database/service.js';
import winston from 'winston';
import { config } from 'dotenv';
config();
// Configuration
const CONFIG = {
    pollingInterval: parseInt(process.env.AUTO_REFUND_POLLING_INTERVAL || '30000'), // Read from env or default to 30 seconds
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    requiredAmount: 2000000n, // 2 ADA in lovelace
    blockfrostApiKey: process.env.BLOCKFROST_API_KEY || (() => {
        throw new Error('BLOCKFROST_API_KEY environment variable is required');
    })(),
    blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
    autoRefundEnabled: process.env.AUTO_REFUND_ENABLED === 'true',
    maxTransactionAge: 3600, // 1 hour - only process recent transactions
    disableOnPaymentError: true, // Disable monitoring when payment is required
    paymentErrorCooldown: 300000, // 5 minutes cooldown after payment error
    // Limit number of tx hashes fetched per poll to reduce API usage
    txFetchCount: parseInt(process.env.AUTO_REFUND_TX_FETCH_COUNT || '5'),
    // Adaptive polling to reduce API usage when idle
    adaptivePollingEnabled: process.env.AUTO_REFUND_ADAPTIVE === 'true',
    minPollingInterval: parseInt(process.env.AUTO_REFUND_MIN_INTERVAL || '30000'),
    maxPollingInterval: parseInt(process.env.AUTO_REFUND_MAX_INTERVAL || '300000'),
};
// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    defaultMeta: { service: 'auto-refund-monitor' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        }),
        new winston.transports.File({ filename: 'logs/auto-refund.log' })
    ]
});
export class AutoRefundMonitor {
    k33pManager;
    isRunning = false;
    intervalId;
    depositAddress = '';
    processedTransactions = new Set();
    paymentErrorOccurred = false;
    lastPaymentError;
    // Track the most recent seen tx hash to avoid redundant per-tx lookups
    lastSeenTxHash;
    // Adaptive polling: current interval that can back off when idle
    currentPollingInterval = CONFIG.pollingInterval;
    // Webhook/event listeners for push notifications
    webhookListeners = new Set();
    // Monitoring statistics
    stats = {
        totalPolls: 0,
        totalTransactionsProcessed: 0,
        blockfrostApiCalls: 0,
        lastPollTime: 0,
        averagePollingInterval: CONFIG.pollingInterval
    };
    constructor() {
        this.k33pManager = new EnhancedK33PManagerDB();
    }
    /**
     * Initialize the auto-refund monitor
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing Auto-Refund Monitor...');
            await this.k33pManager.initialize();
            this.depositAddress = await this.k33pManager.getDepositAddress();
            // Load previously processed transactions from database
            await this.loadProcessedTransactions();
            logger.info(`✅ Auto-Refund Monitor initialized. Deposit address: ${this.depositAddress}`);
            logger.info(`📱 Mobile-optimized polling interval: ${CONFIG.pollingInterval}ms`);
        }
        catch (error) {
            logger.error('❌ Failed to initialize Auto-Refund Monitor:', error);
            throw error;
        }
    }
    /**
     * Start the automatic monitoring service
     */
    async start() {
        if (this.isRunning) {
            logger.warn('⚠️  Auto-Refund Monitor is already running');
            return;
        }
        if (!CONFIG.autoRefundEnabled) {
            logger.info('🔒 Auto-refund is disabled via configuration');
            return;
        }
        logger.info('🎯 Starting Auto-Refund Monitor...');
        this.isRunning = true;
        // Start the monitoring loop
        this.intervalId = setInterval(async () => {
            try {
                await this.monitorAndProcessRefunds();
            }
            catch (error) {
                logger.error('❌ Error in monitoring loop:', error);
            }
        }, this.currentPollingInterval);
        logger.info(`✅ Auto-Refund Monitor started with ${this.currentPollingInterval}ms interval`);
    }
    /**
     * Stop the monitoring service
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('⚠️  Auto-Refund Monitor is not running');
            return;
        }
        logger.info('🛑 Stopping Auto-Refund Monitor...');
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        this.isRunning = false;
        logger.info('✅ Auto-Refund Monitor stopped');
    }
    /**
     * Main monitoring and processing function
     */
    async monitorAndProcessRefunds() {
        try {
            // Check if we're in payment error cooldown
            if (this.paymentErrorOccurred && CONFIG.disableOnPaymentError) {
                logger.debug('⏸️ Monitoring paused due to payment error. Waiting for cooldown.');
                return;
            }
            logger.debug('🔍 Checking for new incoming transactions...');
            // Get recent transactions to deposit address
            const incomingTransactions = await this.getIncomingTransactions();
            if (incomingTransactions.length === 0) {
                logger.debug('📭 No new transactions found');
                // Adjust polling interval for idle period
                this.adjustPollingInterval(false);
                return;
            }
            logger.info(`📨 Found ${incomingTransactions.length} new incoming transactions`);
            // Process each transaction
            for (const transaction of incomingTransactions) {
                await this.processIncomingTransaction(transaction);
                this.stats.totalTransactionsProcessed++;
                // Trigger webhook listeners for push notifications
                this.notifyWebhookListeners(transaction);
                // Small delay between processing to avoid overwhelming the system
                await this.delay(1000);
            }
            // Activity detected: reset/backoff accordingly
            this.adjustPollingInterval(true);
        }
        catch (error) {
            logger.error('❌ Error in monitor and process refunds:', error);
        }
    }
    /**
     * Get incoming transactions to the deposit address with retry logic
     */
    async getIncomingTransactions() {
        const maxRetries = 3;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                const response = await fetch(`${CONFIG.blockfrostUrl}/addresses/${this.depositAddress}/transactions?order=desc&count=${CONFIG.txFetchCount}`, {
                    headers: { 'project_id': CONFIG.blockfrostApiKey }
                });
                if (!response.ok) {
                    // Handle Payment Required error specifically
                    if (response.status === 402) {
                        this.paymentErrorOccurred = true;
                        this.lastPaymentError = new Date();
                        logger.warn('⚠️ Blockfrost API quota exceeded or payment required. Auto-refund monitoring temporarily disabled.');
                        if (CONFIG.disableOnPaymentError) {
                            logger.info('🔒 Auto-refund monitoring disabled due to payment error. Will retry after cooldown period.');
                            setTimeout(() => {
                                this.paymentErrorOccurred = false;
                                logger.info('🔄 Payment error cooldown expired. Resuming auto-refund monitoring.');
                            }, CONFIG.paymentErrorCooldown);
                        }
                        return [];
                    }
                    throw new Error(`Blockfrost API error: ${response.statusText}`);
                }
                const transactions = await response.json();
                const incomingTxs = [];
                const currentTime = Math.floor(Date.now() / 1000);
                // If no new head tx since last poll, skip further work
                if (this.lastSeenTxHash && transactions.length > 0 && transactions[0].tx_hash === this.lastSeenTxHash) {
                    return [];
                }
                // Increment API call counter
                this.stats.blockfrostApiCalls++;
                for (const tx of transactions) {
                    // Stop when we reach already-seen tx
                    if (this.lastSeenTxHash && tx.tx_hash === this.lastSeenTxHash) {
                        break;
                    }
                    // Skip if already processed
                    if (this.processedTransactions.has(tx.tx_hash)) {
                        continue;
                    }
                    // Get transaction details using only UTXOs; pass known block metadata when available to avoid extra call
                    const txDetails = await this.getTransactionDetails(tx.tx_hash, tx.block_time, tx.block_height);
                    if (!txDetails)
                        continue;
                    // Check if transaction is recent enough
                    if (currentTime - txDetails.timestamp > CONFIG.maxTransactionAge) {
                        continue;
                    }
                    // Check if transaction sends required amount to our deposit address
                    if (txDetails.amount >= CONFIG.requiredAmount && txDetails.toAddress === this.depositAddress) {
                        incomingTxs.push(txDetails);
                    }
                }
                // Update last seen head tx for next poll (even if no qualifying tx found)
                if (transactions.length > 0) {
                    const newLastSeenTxHash = transactions[0].tx_hash;
                    this.lastSeenTxHash = newLastSeenTxHash;
                    // persist to DB to resume on restart
                    await this.saveLastSeenTxHash(newLastSeenTxHash);
                }
                // Update polling statistics
                this.stats.totalPolls++;
                this.stats.lastPollTime = Date.now();
                return incomingTxs;
            }
            catch (error) {
                retryCount++;
                const isLastRetry = retryCount >= maxRetries;
                if (isLastRetry) {
                    logger.error('❌ Error fetching incoming transactions after all retries:', error);
                    return [];
                }
                // Exponential backoff: 2^retryCount * 1000ms (1s, 2s, 4s)
                const backoffDelay = Math.pow(2, retryCount) * 1000;
                logger.warn(`⚠️ Fetch failed (attempt ${retryCount}/${maxRetries}), retrying in ${backoffDelay}ms...`);
                await this.delay(backoffDelay);
            }
        }
        return [];
    }
    /**
     * Utility method for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get detailed transaction information with retry logic
     */
    async getTransactionDetails(txHash, knownBlockTime, knownBlockHeight) {
        const maxRetries = 3;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                // Avoid extra /txs call: if time/height unknown, default to now and 0 respectively
                const blockTime = (knownBlockTime == null) ? Math.floor(Date.now() / 1000) : knownBlockTime;
                const blockHeight = (knownBlockHeight == null) ? 0 : knownBlockHeight;
                // Get UTXOs (single call per tx)
                const utxosResponse = await fetch(`${CONFIG.blockfrostUrl}/txs/${txHash}/utxos`, {
                    headers: { 'project_id': CONFIG.blockfrostApiKey }
                });
                if (!utxosResponse.ok) {
                    if (utxosResponse.status === 402) {
                        this.paymentErrorOccurred = true;
                        this.lastPaymentError = new Date();
                        logger.warn('⚠️ Blockfrost API quota exceeded for UTXO details.');
                        return null;
                    }
                    throw new Error(`UTXOs API error: ${utxosResponse.statusText}`);
                }
                const utxosData = await utxosResponse.json();
                // Find output to our deposit address
                const depositOutput = utxosData.outputs.find((output) => output.address === this.depositAddress);
                if (!depositOutput)
                    return null;
                // Get sender address (first input)
                const senderAddress = utxosData.inputs[0]?.address;
                if (!senderAddress)
                    return null;
                // Get amount in lovelace
                const amount = BigInt(depositOutput.amount.find((asset) => asset.unit === 'lovelace')?.quantity || '0');
                return {
                    txHash,
                    fromAddress: senderAddress,
                    toAddress: this.depositAddress,
                    amount,
                    timestamp: blockTime,
                    blockHeight: blockHeight
                };
            }
            catch (error) {
                retryCount++;
                const isLastRetry = retryCount >= maxRetries;
                if (isLastRetry) {
                    logger.error(`❌ Error getting transaction details for ${txHash} after all retries:`, error);
                    return null;
                }
                // Exponential backoff: 2^retryCount * 1000ms
                const backoffDelay = Math.pow(2, retryCount) * 1000;
                logger.warn(`⚠️ Transaction details fetch failed for ${txHash} (attempt ${retryCount}/${maxRetries}), retrying in ${backoffDelay}ms...`);
                await this.delay(backoffDelay);
            }
        }
        return null;
    }
    /**
     * Process an incoming transaction and trigger automatic refund
     */
    async processIncomingTransaction(transaction) {
        try {
            logger.info(`💰 Processing incoming transaction: ${transaction.txHash}`);
            logger.info(`📍 From: ${transaction.fromAddress}`);
            logger.info(`💵 Amount: ${Number(transaction.amount) / 1_000_000} ADA`);
            // Mark as processed to avoid duplicate processing
            this.processedTransactions.add(transaction.txHash);
            await this.saveProcessedTransaction(transaction.txHash);
            // Check if this address already has a deposit record
            const existingDeposit = await dbService.getDepositByUserAddress(transaction.fromAddress);
            if (existingDeposit && existingDeposit.refunded) {
                logger.info(`⚠️  Address ${transaction.fromAddress} already has a refunded deposit. Skipping.`);
                return;
            }
            // Process automatic refund
            const refundResult = await this.processAutomaticRefund(transaction);
            if (refundResult.success) {
                logger.info(`✅ Automatic refund processed successfully: ${refundResult.txHash}`);
                // Log the refund transaction (check for duplicates first)
                try {
                    await dbService.createTransaction({
                        txHash: refundResult.txHash,
                        fromAddress: this.depositAddress,
                        toAddress: transaction.fromAddress,
                        amount: CONFIG.requiredAmount,
                        confirmations: 0,
                        transactionType: 'refund',
                        status: 'pending'
                    });
                }
                catch (dbError) {
                    // Handle duplicate key constraint violation
                    if (dbError.code === '23505' && dbError.constraint === 'transactions_tx_hash_key') {
                        logger.warn(`⚠️ Transaction ${refundResult.txHash} already exists in database, skipping duplicate insert`);
                    }
                    else {
                        throw dbError; // Re-throw if it's a different error
                    }
                }
            }
            else if (refundResult.alreadyProcessed) {
                logger.info(`ℹ️  Refund already processed for ${transaction.fromAddress}`);
            }
            else {
                logger.error(`❌ Failed to process automatic refund: ${refundResult.error}`);
            }
        }
        catch (error) {
            logger.error(`❌ Error processing transaction ${transaction.txHash}:`, error);
        }
    }
    /**
     * Create user record if it doesn't exist for automatic refunds
     */
    async createUserIfNotExists(userId, walletAddress) {
        try {
            const existingUser = await dbService.getUserById(userId);
            if (!existingUser) {
                await dbService.createUser({
                    userId: userId,
                    walletAddress: walletAddress,
                    name: 'Auto Refund User',
                    email: undefined,
                    phoneHash: undefined,
                    zkCommitment: undefined
                });
                logger.info(`✅ Created user record for automatic refund: ${userId}`);
            }
        }
        catch (error) {
            logger.error(`❌ Error creating user record for ${userId}:`, error);
            throw error;
        }
    }
    /**
     * Process automatic refund for an incoming transaction
     */
    async processAutomaticRefund(transaction) {
        try {
            // Create or update deposit record
            const existingDeposit = await dbService.getDepositByUserAddress(transaction.fromAddress);
            if (!existingDeposit) {
                const userId = `auto_${Date.now()}`; // Auto-generated user ID
                // Create user record first to avoid foreign key constraint error
                await this.createUserIfNotExists(userId, transaction.fromAddress);
                // Create new deposit record for tracking
                await dbService.createDeposit({
                    userAddress: transaction.fromAddress,
                    userId: userId,
                    phoneHash: '', // Empty for automatic deposits
                    zkProof: '', // Empty for automatic deposits
                    txHash: transaction.txHash,
                    amount: transaction.amount,
                    senderWalletAddress: transaction.fromAddress,
                    verificationMethod: 'phone'
                });
            }
            // Process the refund using the K33P manager
            const refundResult = await this.k33pManager.processRefund(transaction.fromAddress, transaction.fromAddress // Refund to the same address that sent the deposit
            );
            return {
                success: refundResult.success,
                txHash: refundResult.txHash,
                error: refundResult.message,
                alreadyProcessed: refundResult.message?.includes('already been refunded')
            };
        }
        catch (error) {
            logger.error('❌ Error in automatic refund processing:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Load previously processed transactions from database
     */
    async loadProcessedTransactions() {
        try {
            // Get all refund transactions from database
            // Get all transactions and filter for refunds
            const allTransactions = await dbService.getAllTransactions();
            const refundTransactions = allTransactions.filter((tx) => tx.transactionType === 'refund');
            // Add their corresponding deposit transaction hashes to processed set
            for (const refundTx of refundTransactions) {
                // Find the original deposit transaction that triggered this refund
                const deposit = await dbService.getDepositByUserAddress(refundTx.to_address);
                if (deposit && deposit.tx_hash) {
                    this.processedTransactions.add(deposit.tx_hash);
                }
            }
            // Load the last seen transaction hash from database to resume from where we left off
            const lastSeenRecord = allTransactions.find((tx) => tx.from_address === 'auto_refund_monitor_state' && tx.to_address === 'last_seen_tx');
            if (lastSeenRecord) {
                // stored as last_seen_${hash} to avoid unique collisions with real tx records
                this.lastSeenTxHash = String(lastSeenRecord.tx_hash).replace(/^last_seen_/, '');
                logger.info(`🔄 Resuming monitoring from last seen transaction: ${this.lastSeenTxHash.substring(0, 16)}...`);
            }
            logger.info(`📚 Loaded ${this.processedTransactions.size} previously processed transactions`);
        }
        catch (error) {
            logger.error('❌ Error loading processed transactions:', error);
        }
    }
    /**
     * Save last seen transaction hash to prevent re-processing old transactions on restart
     */
    async saveLastSeenTxHash(txHash) {
        try {
            // Create/update state record with the latest seen tx hash
            await dbService.createTransaction({
                txHash: `last_seen_${txHash}`,
                fromAddress: 'auto_refund_monitor_state',
                toAddress: 'last_seen_tx',
                amount: 0n,
                confirmations: 1,
                transactionType: 'refund',
                status: 'confirmed'
            });
        }
        catch (error) {
            logger.debug('Note: Could not save last seen tx hash:', error);
        }
    }
    /**
     * Save processed transaction to prevent duplicate processing
     */
    async saveProcessedTransaction(txHash) {
        try {
            // Create a record in the database to track processed transactions
            await dbService.createTransaction({
                txHash: `processed_${txHash}`,
                fromAddress: 'system',
                toAddress: 'system',
                amount: 0n,
                confirmations: 1,
                transactionType: 'refund',
                status: 'confirmed'
            });
        }
        catch (error) {
            logger.debug('Note: Could not save processed transaction marker:', error);
        }
    }
    /**
     * Adjust polling interval based on activity (adaptive polling)
     */
    adjustPollingInterval(activityDetected) {
        if (!CONFIG.adaptivePollingEnabled) {
            return;
        }
        const oldInterval = this.currentPollingInterval;
        if (activityDetected) {
            // Reset to minimum interval when activity is detected
            this.currentPollingInterval = CONFIG.minPollingInterval;
        }
        else {
            // Gradually increase interval when idle (exponential backoff)
            this.currentPollingInterval = Math.min(this.currentPollingInterval * 1.5, CONFIG.maxPollingInterval);
        }
        // Update average polling interval for statistics
        this.stats.averagePollingInterval =
            (this.stats.averagePollingInterval + this.currentPollingInterval) / 2;
        // Restart interval if it changed significantly
        if (Math.abs(oldInterval - this.currentPollingInterval) > 5000 && this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(async () => {
                try {
                    await this.monitorAndProcessRefunds();
                }
                catch (error) {
                    logger.error('❌ Error in monitoring loop:', error);
                }
            }, this.currentPollingInterval);
            logger.debug(`🔄 Polling interval adjusted: ${oldInterval}ms → ${this.currentPollingInterval}ms`);
        }
    }
    /**
     * Notify webhook listeners about new transactions (push mechanism)
     */
    notifyWebhookListeners(transaction) {
        this.webhookListeners.forEach(listener => {
            try {
                listener(transaction);
            }
            catch (error) {
                logger.error('❌ Error in webhook listener:', error);
            }
        });
    }
    /**
     * Register a webhook listener for push notifications
     */
    registerWebhookListener(listener) {
        this.webhookListeners.add(listener);
        logger.info('📡 Webhook listener registered');
        // Return unsubscribe function
        return () => {
            this.webhookListeners.delete(listener);
            logger.info('📡 Webhook listener unregistered');
        };
    }
    /**
     * Get comprehensive monitoring status and health information
     */
    getStatus() {
        const inCooldown = !!(this.paymentErrorOccurred && this.lastPaymentError &&
            (Date.now() - this.lastPaymentError.getTime()) < CONFIG.paymentErrorCooldown);
        return {
            isRunning: this.isRunning,
            processedCount: this.processedTransactions.size,
            depositAddress: this.depositAddress,
            currentPollingInterval: this.currentPollingInterval,
            lastSeenTxHash: this.lastSeenTxHash || null,
            webhookListenerCount: this.webhookListeners.size,
            statistics: {
                ...this.stats,
                uptime: this.isRunning ? Date.now() - (this.stats.lastPollTime || Date.now()) : 0
            },
            paymentErrorStatus: {
                occurred: this.paymentErrorOccurred,
                lastError: this.lastPaymentError,
                inCooldown
            }
        };
    }
    /**
     * Manual trigger for testing
     */
    async triggerManualCheck() {
        logger.info('🔧 Manual trigger activated');
        await this.monitorAndProcessRefunds();
    }
    /**
     * Reset statistics (useful for monitoring)
     */
    resetStatistics() {
        this.stats = {
            totalPolls: 0,
            totalTransactionsProcessed: 0,
            blockfrostApiCalls: 0,
            lastPollTime: 0,
            averagePollingInterval: CONFIG.pollingInterval
        };
        logger.info('📊 Statistics reset');
    }
    /**
     * Get health check information for monitoring endpoints
     */
    getHealthCheck() {
        const now = Date.now();
        const timeSinceLastPoll = now - this.stats.lastPollTime;
        const errors = [];
        let status = 'healthy';
        // Check if monitoring is running
        if (!this.isRunning) {
            errors.push('Monitor is not running');
            status = 'unhealthy';
        }
        // Check if there are payment errors
        if (this.paymentErrorOccurred) {
            errors.push('Blockfrost API payment error occurred');
            status = 'degraded';
        }
        // Check if polling is stalled (no polls in last 10 minutes)
        if (this.isRunning && timeSinceLastPoll > 600000) {
            errors.push('Polling appears to be stalled');
            status = 'unhealthy';
        }
        return {
            status,
            timestamp: now,
            uptime: this.isRunning ? timeSinceLastPoll : 0,
            lastActivity: this.stats.lastPollTime,
            errors
        };
    }
    /**
     * Trigger immediate webhook notification (for testing)
     */
    triggerWebhookTest(testTransaction) {
        const mockTransaction = {
            txHash: testTransaction?.txHash || 'test_tx_hash_' + Date.now(),
            fromAddress: testTransaction?.fromAddress || 'test_sender_address',
            toAddress: testTransaction?.toAddress || this.depositAddress,
            amount: testTransaction?.amount || CONFIG.requiredAmount,
            timestamp: testTransaction?.timestamp || Math.floor(Date.now() / 1000),
            blockHeight: testTransaction?.blockHeight || 0
        };
        logger.info('🧪 Triggering webhook test with mock transaction');
        this.notifyWebhookListeners(mockTransaction);
    }
}
// Export singleton instance
export const autoRefundMonitor = new AutoRefundMonitor();
//# sourceMappingURL=auto-refund-monitor.js.map