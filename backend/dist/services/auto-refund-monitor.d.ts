/**
 * Automatic Refund Monitor Service
 * Monitors incoming 2 ADA deposits and automatically processes refunds
 * Mobile-optimized for real-time transaction processing
 */
interface IncomingTransaction {
    txHash: string;
    fromAddress: string;
    toAddress: string;
    amount: bigint;
    timestamp: number;
    blockHeight: number;
}
export declare class AutoRefundMonitor {
    private k33pManager;
    private isRunning;
    private intervalId?;
    private depositAddress;
    private processedTransactions;
    private paymentErrorOccurred;
    private lastPaymentError?;
    private lastSeenTxHash?;
    private currentPollingInterval;
    private webhookListeners;
    private stats;
    constructor();
    /**
     * Initialize the auto-refund monitor
     */
    initialize(): Promise<void>;
    /**
     * Start the automatic monitoring service
     */
    start(): Promise<void>;
    /**
     * Stop the monitoring service
     */
    stop(): void;
    /**
     * Main monitoring and processing function
     */
    private monitorAndProcessRefunds;
    /**
     * Get incoming transactions to the deposit address with retry logic
     */
    private getIncomingTransactions;
    /**
     * Utility method for delays
     */
    private delay;
    /**
     * Get detailed transaction information with retry logic
     */
    private getTransactionDetails;
    /**
     * Process an incoming transaction and trigger automatic refund
     */
    private processIncomingTransaction;
    /**
     * Create user record if it doesn't exist for automatic refunds
     */
    private createUserIfNotExists;
    /**
     * Process automatic refund for an incoming transaction
     */
    private processAutomaticRefund;
    /**
     * Load previously processed transactions from database
     */
    private loadProcessedTransactions;
    /**
     * Save last seen transaction hash to prevent re-processing old transactions on restart
     */
    private saveLastSeenTxHash;
    /**
     * Save processed transaction to prevent duplicate processing
     */
    private saveProcessedTransaction;
    /**
     * Adjust polling interval based on activity (adaptive polling)
     */
    private adjustPollingInterval;
    /**
     * Notify webhook listeners about new transactions (push mechanism)
     */
    private notifyWebhookListeners;
    /**
     * Register a webhook listener for push notifications
     */
    registerWebhookListener(listener: (transaction: IncomingTransaction) => void): () => void;
    /**
     * Get comprehensive monitoring status and health information
     */
    getStatus(): {
        isRunning: boolean;
        processedCount: number;
        depositAddress: string;
        currentPollingInterval: number;
        lastSeenTxHash: string | null;
        webhookListenerCount: number;
        statistics: {
            totalPolls: number;
            totalTransactionsProcessed: number;
            blockfrostApiCalls: number;
            lastPollTime: number;
            averagePollingInterval: number;
            uptime: number;
        };
        paymentErrorStatus?: {
            occurred: boolean;
            lastError?: Date;
            inCooldown: boolean;
        };
    };
    /**
     * Manual trigger for testing
     */
    triggerManualCheck(): Promise<void>;
    /**
     * Reset statistics (useful for monitoring)
     */
    resetStatistics(): void;
    /**
     * Get health check information for monitoring endpoints
     */
    getHealthCheck(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        timestamp: number;
        uptime: number;
        lastActivity: number;
        errors: string[];
    };
    /**
     * Trigger immediate webhook notification (for testing)
     */
    triggerWebhookTest(testTransaction?: Partial<IncomingTransaction>): void;
}
export declare const autoRefundMonitor: AutoRefundMonitor;
export {};
//# sourceMappingURL=auto-refund-monitor.d.ts.map