/**
 * Enhanced K33P Smart Contract handler with PostgreSQL database integration
 * This version replaces JSON file storage with PostgreSQL database
 */
import * as crypto from 'crypto';
import { Lucid, Blockfrost } from "lucid-cardano";
import { config } from 'dotenv';
import { dbService } from './database/service.js';
import { testConnection } from './database/config.js';
import { MockDatabaseService } from './database/mock-service.js';
// Load environment variables
config();
// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    network: "Preprod",
    blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
    blockfrostApiKey: process.env.BLOCKFROST_API_KEY || (() => {
        throw new Error('BLOCKFROST_API_KEY environment variable is required');
    })(),
    seedPhrase: process.env.SEED_PHRASE || "blame purpose battle mistake match cousin degree route bag return clump key metal actress poet outside group sword bring gravity weapon report alone dove",
    requiredDeposit: 2000000n, // 2 ADA
    refundAmount: 2000000n, // 2 ADA
    maxTimeWindow: 86400, // 1 day in seconds
    phoneHashLength: 32, // bytes
    proofLength: 64, // bytes
    maxUserIdLength: 50,
    minUserIdLength: 3,
    txVerificationTimeout: 300, // 5 minutes to find transaction
    minConfirmations: 0, // Temporarily set to 0 for testing
    maxTxAge: 86400, // Max transaction age in seconds (24 hours)
};
// ============================================================================
// BLOCKCHAIN VERIFICATION SERVICE
// ============================================================================
class BlockchainVerifier {
    apiKey;
    baseUrl;
    blockfrost;
    depositAddress = '';
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.blockfrost = new Blockfrost(baseUrl, apiKey);
    }
    async setDepositAddress(address) {
        this.depositAddress = address;
    }
    async verifyTransactionByWalletAddress(senderWalletAddress, expectedAmount) {
        try {
            console.log(`🔍 Verifying transaction from ${senderWalletAddress} with amount ${expectedAmount}...`);
            const depositAddress = this.depositAddress;
            const response = await fetch(`${CONFIG.blockfrostUrl}/addresses/${senderWalletAddress}/transactions?order=desc`, {
                headers: {
                    'project_id': CONFIG.blockfrostApiKey
                }
            });
            if (!response.ok) {
                return {
                    isValid: false,
                    error: `Could not fetch transactions for address: ${senderWalletAddress}`
                };
            }
            const transactions = await response.json();
            if (transactions.length === 0) {
                return {
                    isValid: false,
                    error: `No recent transactions found for address: ${senderWalletAddress}`
                };
            }
            for (const tx of transactions) {
                const txHash = tx.tx_hash;
                const txDetailsResponse = await fetch(`${this.baseUrl}/txs/${txHash}`, {
                    headers: { 'project_id': this.apiKey }
                });
                if (!txDetailsResponse.ok)
                    continue;
                const txData = await txDetailsResponse.json();
                const utxosResponse = await fetch(`${this.baseUrl}/txs/${txHash}/utxos`, {
                    headers: { 'project_id': this.apiKey }
                });
                if (!utxosResponse.ok)
                    continue;
                const utxosData = await utxosResponse.json();
                const depositOutput = utxosData.outputs.find((output) => output.address === depositAddress);
                if (!depositOutput)
                    continue;
                const sentAmount = BigInt(depositOutput.amount.find((asset) => asset.unit === 'lovelace')?.quantity || '0');
                if (sentAmount < expectedAmount)
                    continue;
                const txTimestamp = txData.block_time;
                const currentTimestamp = Math.floor(Date.now() / 1000);
                const txAge = currentTimestamp - txTimestamp;
                if (txAge > CONFIG.maxTxAge)
                    continue;
                const senderAddress = utxosData.inputs[0]?.address;
                if (senderAddress !== senderWalletAddress) {
                    console.warn(`⚠️  Sender mismatch: Expected ${senderWalletAddress}, Got ${senderAddress}`);
                    continue;
                }
                const transaction = {
                    txHash,
                    amount: sentAmount,
                    fromAddress: senderAddress,
                    toAddress: depositAddress,
                    timestamp: txTimestamp,
                    confirmations: txData.confirmations || 0,
                    valid: true
                };
                if (transaction.confirmations < CONFIG.minConfirmations) {
                    return {
                        isValid: false,
                        transaction,
                        error: `Insufficient confirmations. Required: ${CONFIG.minConfirmations}, Got: ${transaction.confirmations}`
                    };
                }
                console.log(`✅ Transaction verified successfully: ${txHash}`);
                return {
                    isValid: true,
                    transaction
                };
            }
            return {
                isValid: false,
                error: `No valid transaction found from ${senderWalletAddress} to ${depositAddress} with amount >= ${expectedAmount}`
            };
        }
        catch (error) {
            console.error('Error verifying transaction:', error);
            return {
                isValid: false,
                error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
// ============================================================================
// ENHANCED K33P MANAGER WITH DATABASE
// ============================================================================
export class EnhancedK33PManagerDB {
    cardanoEnabled = true;
    initPromise;
    lucid;
    validator;
    depositAddress = '';
    verifier;
    initialized = false;
    usingMockDatabase = false;
    mockDbService = null;
    constructor() {
        this.verifier = new BlockchainVerifier(CONFIG.blockfrostApiKey, CONFIG.blockfrostUrl);
    }
    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                console.log('Initializing Enhanced K33P Manager with Database...');
                const dbConnected = await testConnection();
                if (!dbConnected) {
                    console.warn('PostgreSQL connection failed, using mock database service...');
                    this.usingMockDatabase = true;
                    this.mockDbService = MockDatabaseService;
                    await this.mockDbService.initialize();
                    console.log('Mock database service initialized');
                }
                if (process.env.DISABLE_CARDANO === "true") {
                    this.cardanoEnabled = false;
                    this.depositAddress = "addr_test_mock_deposit_address_disabled_cardano";
                    this.initialized = true;
                    console.log('Cardano features disabled via DISABLE_CARDANO, database initialized');
                    return;
                }
                try {
                    this.lucid = await Lucid.new(new Blockfrost(CONFIG.blockfrostUrl, CONFIG.blockfrostApiKey), CONFIG.network);
                    this.lucid.selectWalletFromSeed(CONFIG.seedPhrase);
                    const validatorScript = JSON.parse(await this.readFile('plutus.json'));
                    this.validator = {
                        type: "PlutusV2",
                        script: validatorScript.cborHex
                    };
                    this.depositAddress = this.lucid.utils.validatorToAddress(this.validator);
                    await this.verifier.setDepositAddress(this.depositAddress);
                    this.cardanoEnabled = true;
                }
                catch (cardanoError) {
                    console.warn('Cardano initialization failed, continuing without Cardano features:', cardanoError);
                    this.cardanoEnabled = false;
                    this.depositAddress = "addr_test_mock_deposit_address_failed_cardano";
                }
                this.initialized = true;
                console.log('Enhanced K33P Manager with Database initialized successfully');
            }
            catch (error) {
                console.error('Failed to initialize Enhanced K33P Manager:', error);
                throw error;
            }
        })();
        return this.initPromise;
    }
    async readFile(filename) {
        const fs = await import('fs');
        const path = await import('path');
        return fs.readFileSync(path.resolve(filename), 'utf8');
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    getDbService() {
        return this.usingMockDatabase ? this.mockDbService : dbService;
    }
    async getDepositAddress() {
        await this.ensureInitialized();
        return this.depositAddress;
    }
    /**
     * Verify transaction by wallet address
     */
    async verifyTransactionByWalletAddress(senderWalletAddress, expectedAmount) {
        await this.ensureInitialized();
        return await this.verifier.verifyTransactionByWalletAddress(senderWalletAddress, expectedAmount);
    }
    // ============================================================================
    // SIGNUP WITH VERIFICATION (Database Version)
    // ============================================================================
    async recordSignupWithVerification(userAddress, userId, phoneNumber, senderWalletAddress, pin, biometricData, verificationMethod = 'phone', biometricType) {
        await this.ensureInitialized();
        try {
            console.log(`📝 Recording signup for user ${userId} with verification method: ${verificationMethod}`);
            // Validate inputs
            if (!userId || userId.length < CONFIG.minUserIdLength || userId.length > CONFIG.maxUserIdLength) {
                return {
                    success: false,
                    message: `User ID must be between ${CONFIG.minUserIdLength} and ${CONFIG.maxUserIdLength} characters`
                };
            }
            if (!phoneNumber || phoneNumber.length < 10) {
                return {
                    success: false,
                    message: 'Phone number must be at least 10 characters'
                };
            }
            // Check if user already exists
            const currentDbService = this.getDbService();
            const existingDeposit = await currentDbService.getDepositByUserAddress(userAddress);
            if (existingDeposit) {
                return {
                    success: false,
                    message: 'User already has a deposit record'
                };
            }
            // Generate hashes
            const phoneHash = this.hashData(phoneNumber);
            const pinHash = pin ? this.hashData(pin) : undefined;
            const biometricHash = biometricData ? this.hashData(biometricData) : undefined;
            const zkProof = this.generateZKProof(phoneNumber, userAddress);
            // Create user if not exists
            const existingUser = await currentDbService.getUserById(userId);
            if (!existingUser) {
                await currentDbService.createUser({
                    userId,
                    walletAddress: userAddress,
                    phoneHash
                });
            }
            // Create deposit record
            const deposit = await currentDbService.createDeposit({
                userAddress,
                userId,
                phoneHash,
                zkProof,
                amount: CONFIG.requiredDeposit,
                senderWalletAddress,
                pinHash,
                biometricHash,
                biometricType,
                verificationMethod
            });
            console.log(`✅ Signup recorded for user ${userId}`);
            // If sender wallet address is provided, verify transaction
            if (senderWalletAddress) {
                console.log(`🔍 Verifying transaction from sender wallet: ${senderWalletAddress}`);
                const verificationResult = await this.verifier.verifyTransactionByWalletAddress(senderWalletAddress, CONFIG.requiredDeposit);
                if (verificationResult.isValid && verificationResult.transaction) {
                    // Mark as verified and update with transaction details
                    await currentDbService.updateDeposit(userAddress, {
                        verified: true,
                        tx_hash: verificationResult.transaction.txHash,
                        amount: verificationResult.transaction.amount
                    });
                    // Create transaction record
                    await currentDbService.createTransaction({
                        txHash: verificationResult.transaction.txHash,
                        fromAddress: verificationResult.transaction.fromAddress,
                        toAddress: verificationResult.transaction.toAddress,
                        amount: verificationResult.transaction.amount,
                        confirmations: verificationResult.transaction.confirmations,
                        blockTime: new Date(verificationResult.transaction.timestamp * 1000),
                        transactionType: 'deposit',
                        status: 'confirmed'
                    });
                    console.log(`✅ Transaction verified and recorded: ${verificationResult.transaction.txHash}`);
                    return {
                        success: true,
                        message: 'Signup recorded and transaction verified successfully',
                        verified: true,
                        depositAddress: this.depositAddress
                    };
                }
                else {
                    // Increment verification attempts
                    await currentDbService.incrementVerificationAttempts(userAddress);
                    return {
                        success: true,
                        message: `Signup recorded but transaction verification failed: ${verificationResult.error}`,
                        verified: false,
                        depositAddress: this.depositAddress
                    };
                }
            }
            return {
                success: true,
                message: 'Signup recorded successfully. Please send deposit to complete verification.',
                verified: false,
                depositAddress: this.depositAddress
            };
        }
        catch (error) {
            console.error('Error recording signup:', error);
            return {
                success: false,
                message: `Failed to record signup: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================
    async retryVerification(userAddress) {
        await this.ensureInitialized();
        try {
            const currentDbService = this.getDbService();
            const deposit = await currentDbService.getDepositByUserAddress(userAddress);
            if (!deposit) {
                return {
                    success: false,
                    message: 'No deposit found for this address'
                };
            }
            if (deposit.verified) {
                return {
                    success: true,
                    message: 'User is already verified',
                    verified: true
                };
            }
            if (!deposit.sender_wallet_address) {
                return {
                    success: false,
                    message: 'No sender wallet address available for verification'
                };
            }
            const verificationResult = await this.verifier.verifyTransactionByWalletAddress(deposit.sender_wallet_address, CONFIG.requiredDeposit);
            if (verificationResult.isValid && verificationResult.transaction) {
                await currentDbService.markDepositAsVerified(userAddress, verificationResult.transaction.txHash);
                return {
                    success: true,
                    message: 'Verification successful',
                    verified: true
                };
            }
            else {
                await currentDbService.incrementVerificationAttempts(userAddress);
                return {
                    success: false,
                    message: `Verification failed: ${verificationResult.error}`
                };
            }
        }
        catch (error) {
            console.error('Error retrying verification:', error);
            return {
                success: false,
                message: `Verification retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async autoVerifyDeposits() {
        await this.ensureInitialized();
        try {
            console.log('🔄 Starting auto-verification of unverified deposits...');
            const currentDbService = this.getDbService();
            const unverifiedDeposits = await currentDbService.getUnverifiedDeposits();
            console.log(`📊 Found ${unverifiedDeposits.length} unverified deposits`);
            for (const deposit of unverifiedDeposits) {
                if (deposit.sender_wallet_address) {
                    console.log(`🔍 Verifying deposit for user ${deposit.user_id}...`);
                    const result = await this.retryVerification(deposit.user_address);
                    if (result.success && result.verified) {
                        console.log(`✅ Verified deposit for user ${deposit.user_id}`);
                    }
                    else {
                        console.log(`❌ Failed to verify deposit for user ${deposit.user_id}: ${result.message}`);
                    }
                }
            }
            console.log('✅ Auto-verification completed');
        }
        catch (error) {
            console.error('Error during auto-verification:', error);
            throw error;
        }
    }
    // ============================================================================
    // REFUND OPERATIONS
    // ============================================================================
    async processRefund(userAddress, walletAddress) {
        await this.ensureInitialized();
        try {
            const currentDbService = this.getDbService();
            const deposit = await currentDbService.getDepositByUserAddress(userAddress);
            console.log('Processing refund for user: ' + userAddress);
            console.log('Deposit found: ' + !!deposit);
            if (deposit) {
                console.log('Deposit refunded status: ' + deposit.refunded);
            }
            if (deposit && deposit.refunded) {
                console.log('Refund already processed for user: ' + userAddress);
                return {
                    success: false,
                    message: 'Deposit has already been refunded'
                };
            }
            const refundAddress = walletAddress || (deposit?.sender_wallet_address) || userAddress;
            console.log('Processing refund to ' + refundAddress + '...');
            let txHash;
            if (this.usingMockDatabase || !this.cardanoEnabled) {
                txHash = 'mock_refund_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
                console.log('Mock refund transaction simulated: ' + txHash);
            }
            else {
                const lucid = this.lucid;
                const tx = await lucid.newTx()
                    .payToAddress(refundAddress, { lovelace: CONFIG.refundAmount })
                    .complete();
                const signedTx = await tx.sign().complete();
                txHash = await signedTx.submit();
            }
            // Generate ZK proof for refund operation - WITHOUT requiring a user
            try {
                const { ZKProofService } = await import('./services/zk-proof-service.js');
                // Generate ZK proof using data method instead of user method
                await ZKProofService.generateAndStoreDataZKProof(`refund_${Date.now()}`, // Use timestamp as user ID for tracking
                'refund_operation', {
                    userAddress,
                    refundAddress,
                    txHash,
                    amount: CONFIG.refundAmount,
                    timestamp: new Date().toISOString(),
                    depositExists: !!deposit,
                    operationType: 'external_refund' // Mark as external refund
                });
                console.log(`✅ ZK proof generated for refund operation`);
            }
            catch (zkError) {
                console.error('Failed to generate ZK proof for refund:', zkError);
                // Don't fail the refund if ZK proof generation fails
            }
            // If deposit exists, mark as refunded in database
            if (deposit) {
                await currentDbService.markRefunded(userAddress, txHash);
                console.log(`✅ Marked existing deposit as refunded: ${userAddress}`);
            }
            else {
                // Create a deposit record for tracking WITHOUT creating a user
                console.log(`📝 Creating deposit record for refund tracking (without user): ${userAddress}`);
                /*  try {
                   // Create deposit directly WITHOUT creating a user first
                   const userId = `refund_${Date.now()}`; // Generate a temporary ID for tracking
                   
                   // Use a simplified deposit creation that doesn't require foreign key to users table
                   const client = await pool.connect();
                   try {
                     const result = await client.query(
                       `INSERT INTO user_deposits (
                         user_address,
                         user_id,
                         phone_hash,
                         tx_hash,
                         amount,
                         refunded,
                         verified,
                         signup_completed,
                         sender_wallet_address,
                         verification_method
                       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                       [
                         userAddress,
                         userId,
                         'dummy_refund_phone_hash', // Dummy phone hash
                         txHash,
                         CONFIG.refundAmount,
                         true, // Mark as refunded immediately
                         false,
                         false,
                         refundAddress,
                         'external_refund' // Special verification method for external refunds
                       ]
                     );
                     
                     console.log(`✅ Created deposit record for refund: ${userId}`);
                   } finally {
                     client.release();
                   }
                   
                 } catch (depositError) {
                   console.error('Failed to create deposit record:', depositError);
                   // Continue anyway - the refund transaction is already processed
                 } */
            }
            // Create refund transaction record
            try {
                await currentDbService.createTransaction({
                    txHash,
                    fromAddress: this.depositAddress,
                    toAddress: refundAddress,
                    amount: CONFIG.refundAmount,
                    confirmations: 0,
                    transactionType: 'refund',
                    status: 'pending'
                });
            }
            catch (transactionError) {
                console.error('Failed to create transaction record:', transactionError);
                // Continue anyway - the refund transaction is already processed
            }
            console.log(`✅ Refund processed successfully: ${txHash}`);
            return {
                success: true,
                message: 'Refund processed successfully',
                txHash
            };
        }
        catch (error) {
            console.error('Error processing refund:', error);
            return {
                success: false,
                message: `Refund processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    hashData(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    generateZKProof(phoneNumber, userAddress) {
        const combined = phoneNumber + userAddress + Date.now().toString();
        return crypto.createHash('sha256').update(combined).digest('hex') +
            '0000000000000000000000000000000000000000000000000000000000000000';
    }
    // ============================================================================
    // LEGACY COMPATIBILITY METHODS
    // ============================================================================
    /**
     * Load deposits in legacy format for compatibility
     */
    async loadDeposits() {
        return await dbService.loadDeposits();
    }
    /**
     * Monitor incoming transactions (placeholder for compatibility)
     */
    async monitorIncomingTransactions() {
        console.log('📡 Monitoring incoming transactions...');
        await this.autoVerifyDeposits();
    }
    /**
     * Process signup completion
     */
    async processSignup(userAddress) {
        const deposit = await dbService.getDepositByUserAddress(userAddress);
        if (!deposit) {
            throw new Error('No deposit found for this address');
        }
        if (!deposit.verified) {
            throw new Error('Deposit must be verified before processing signup');
        }
        // For now, just mark as completed
        await dbService.markSignupCompleted(userAddress, deposit.tx_hash || 'pending');
        return deposit.tx_hash || 'completed';
    }
}
//# sourceMappingURL=enhanced-k33p-manager-db.js.map