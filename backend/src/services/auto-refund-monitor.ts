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
  requiredAmount: 2_000_000n, // 2 ADA in lovelace
  blockfrostApiKey: process.env.BLOCKFROST_API_KEY || (() => {
      throw new Error('BLOCKFROST_API_KEY environment variable is required');
    })(),
  blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
  autoRefundEnabled: process.env.AUTO_REFUND_ENABLED === 'true',
  maxTransactionAge: 3600, // 1 hour - only process recent transactions
  disableOnPaymentError: true, // Disable monitoring when payment is required
  paymentErrorCooldown: 300000, // 5 minutes cooldown after payment error
};

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auto-refund-monitor' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/auto-refund.log' })
  ]
});

interface IncomingTransaction {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: bigint;
  timestamp: number;
  blockHeight: number;
}

interface RefundProcessingResult {
  success: boolean;
  txHash?: string;
  error?: string;
  alreadyProcessed?: boolean;
}

export class AutoRefundMonitor {
  private k33pManager: EnhancedK33PManagerDB;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private depositAddress: string = '';
  private processedTransactions: Set<string> = new Set();
  private paymentErrorOccurred: boolean = false;
  private lastPaymentError?: Date;

  constructor() {
    this.k33pManager = new EnhancedK33PManagerDB();
  }

  /**
   * Initialize the auto-refund monitor
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing Auto-Refund Monitor...');
      
      await this.k33pManager.initialize();
      this.depositAddress = await this.k33pManager.getDepositAddress();
      
      // Load previously processed transactions from database
      await this.loadProcessedTransactions();
      
      logger.info(`✅ Auto-Refund Monitor initialized. Deposit address: ${this.depositAddress}`);
      logger.info(`📱 Mobile-optimized polling interval: ${CONFIG.pollingInterval}ms`);
      
    } catch (error) {
      logger.error('❌ Failed to initialize Auto-Refund Monitor:', error);
      throw error;
    }
  }

  /**
   * Start the automatic monitoring service
   */
  async start(): Promise<void> {
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
      } catch (error) {
        logger.error('❌ Error in monitoring loop:', error);
      }
    }, CONFIG.pollingInterval);

    logger.info(`✅ Auto-Refund Monitor started with ${CONFIG.pollingInterval}ms interval`);
  }

  /**
   * Stop the monitoring service
   */
  stop(): void {
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
  private async monitorAndProcessRefunds(): Promise<void> {
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
        return;
      }

      logger.info(`📨 Found ${incomingTransactions.length} new incoming transactions`);

      // Process each transaction
      for (const transaction of incomingTransactions) {
        await this.processIncomingTransaction(transaction);
        
        // Small delay between processing to avoid overwhelming the system
        await this.delay(1000);
      }
      
    } catch (error) {
      logger.error('❌ Error in monitor and process refunds:', error);
    }
  }

  /**
   * Get incoming transactions to the deposit address with retry logic
   */
  private async getIncomingTransactions(): Promise<IncomingTransaction[]> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const response = await fetch(
           `${CONFIG.blockfrostUrl}/addresses/${this.depositAddress}/transactions?order=desc&count=20`,
           {
             headers: { 'project_id': CONFIG.blockfrostApiKey }
           }
         );

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
        const incomingTxs: IncomingTransaction[] = [];
        const currentTime = Math.floor(Date.now() / 1000);

        for (const tx of transactions) {
          // Skip if already processed
          if (this.processedTransactions.has(tx.tx_hash)) {
            continue;
          }

          // Get transaction details
          const txDetails = await this.getTransactionDetails(tx.tx_hash);
        if (!txDetails) continue;

          // Check if transaction is recent enough
          if (currentTime - txDetails.timestamp > CONFIG.maxTransactionAge) {
            continue;
          }

          // Check if transaction sends required amount to our deposit address
          if (txDetails.amount >= CONFIG.requiredAmount && txDetails.toAddress === this.depositAddress) {
            incomingTxs.push(txDetails);
          }
        }

        return incomingTxs;
        
      } catch (error) {
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
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get detailed transaction information with retry logic
   */
  private async getTransactionDetails(txHash: string): Promise<IncomingTransaction | null> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Get transaction info
        const txResponse = await fetch(
           `${CONFIG.blockfrostUrl}/txs/${txHash}`,
           { 
             headers: { 'project_id': CONFIG.blockfrostApiKey }
           }
         );

        if (!txResponse.ok) {
          if (txResponse.status === 402) {
            this.paymentErrorOccurred = true;
            this.lastPaymentError = new Date();
            logger.warn('⚠️ Blockfrost API quota exceeded for transaction details.');
            return null;
          }
          throw new Error(`Transaction API error: ${txResponse.statusText}`);
        }
        const txData = await txResponse.json();

        // Get UTXOs
        const utxosResponse = await fetch(
           `${CONFIG.blockfrostUrl}/txs/${txHash}/utxos`,
           { 
             headers: { 'project_id': CONFIG.blockfrostApiKey }
           }
         );

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
        const depositOutput = utxosData.outputs.find((output: any) => 
          output.address === this.depositAddress
        );

        if (!depositOutput) return null;

        // Get sender address (first input)
        const senderAddress = utxosData.inputs[0]?.address;
        if (!senderAddress) return null;

        // Get amount in lovelace
        const amount = BigInt(
          depositOutput.amount.find((asset: any) => asset.unit === 'lovelace')?.quantity || '0'
        );

        return {
          txHash,
          fromAddress: senderAddress,
          toAddress: this.depositAddress,
          amount,
          timestamp: txData.block_time,
          blockHeight: txData.block_height
        };
        
      } catch (error) {
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
  private async processIncomingTransaction(transaction: IncomingTransaction): Promise<void> {
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
        
        // Log the refund transaction
        await dbService.createTransaction({
          txHash: refundResult.txHash!,
          fromAddress: this.depositAddress,
          toAddress: transaction.fromAddress,
          amount: CONFIG.requiredAmount,
          confirmations: 0,
          transactionType: 'refund',
          status: 'pending'
        });
        
      } else if (refundResult.alreadyProcessed) {
        logger.info(`ℹ️  Refund already processed for ${transaction.fromAddress}`);
      } else {
        logger.error(`❌ Failed to process automatic refund: ${refundResult.error}`);
      }
      
    } catch (error) {
      logger.error(`❌ Error processing transaction ${transaction.txHash}:`, error);
    }
  }

  /**
   * Create user record if it doesn't exist for automatic refunds
   */
  private async createUserIfNotExists(userId: string, walletAddress: string): Promise<void> {
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
    } catch (error) {
      logger.error(`❌ Error creating user record for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process automatic refund for an incoming transaction
   */
  private async processAutomaticRefund(transaction: IncomingTransaction): Promise<RefundProcessingResult> {
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
      const refundResult = await this.k33pManager.processRefund(
        transaction.fromAddress,
        transaction.fromAddress // Refund to the same address that sent the deposit
      );

      return {
        success: refundResult.success,
        txHash: refundResult.txHash,
        error: refundResult.message,
        alreadyProcessed: refundResult.message?.includes('already been refunded')
      };
      
    } catch (error) {
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
  private async loadProcessedTransactions(): Promise<void> {
    try {
      // Get all refund transactions from database
      // Get all transactions and filter for refunds
      const allTransactions = await dbService.getAllTransactions();
      const refundTransactions = allTransactions.filter((tx: any) => tx.transactionType === 'refund');
      
      // Add their corresponding deposit transaction hashes to processed set
      for (const refundTx of refundTransactions) {
        // Find the original deposit transaction that triggered this refund
        const deposit = await dbService.getDepositByUserAddress(refundTx.to_address);
        if (deposit && deposit.tx_hash) {
          this.processedTransactions.add(deposit.tx_hash);
        }
      }
      
      logger.info(`📚 Loaded ${this.processedTransactions.size} previously processed transactions`);
      
    } catch (error) {
      logger.error('❌ Error loading processed transactions:', error);
    }
  }

  /**
   * Save processed transaction to prevent duplicate processing
   */
  private async saveProcessedTransaction(txHash: string): Promise<void> {
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
    } catch (error) {
      logger.debug('Note: Could not save processed transaction marker:', error);
    }
  }



  /**
   * Get monitoring status
   */
  getStatus(): { isRunning: boolean; processedCount: number; depositAddress: string; paymentErrorStatus?: { occurred: boolean; lastError?: Date; inCooldown: boolean } } {
    const inCooldown: boolean = !!(this.paymentErrorOccurred && this.lastPaymentError && 
      (Date.now() - this.lastPaymentError.getTime()) < CONFIG.paymentErrorCooldown);
    
    return {
      isRunning: this.isRunning,
      processedCount: this.processedTransactions.size,
      depositAddress: this.depositAddress,
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
  async triggerManualCheck(): Promise<void> {
    logger.info('🔧 Manual trigger activated');
    await this.monitorAndProcessRefunds();
  }
}

// Export singleton instance
export const autoRefundMonitor = new AutoRefundMonitor();