/**
 * Automatic Refund Monitor Service
 * Monitors incoming 2 ADA deposits and automatically processes refunds
 * Mobile-optimized for real-time transaction processing
 */
export declare class AutoRefundMonitor {
    private k33pManager;
    private isRunning;
    private intervalId?;
    private depositAddress;
    private processedTransactions;
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
     * Process automatic refund for an incoming transaction
     */
    private processAutomaticRefund;
    /**
     * Load previously processed transactions from database
     */
    private loadProcessedTransactions;
    /**
     * Save processed transaction to prevent duplicate processing
     */
    private saveProcessedTransaction;
    /**
     * Get monitoring status
     */
    getStatus(): {
        isRunning: boolean;
        processedCount: number;
        depositAddress: string;
    };
    /**
     * Manual trigger for testing
     */
    triggerManualCheck(): Promise<void>;
}
export declare const autoRefundMonitor: AutoRefundMonitor;
//# sourceMappingURL=auto-refund-monitor.d.ts.map