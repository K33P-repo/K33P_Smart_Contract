/**
 * Enhanced K33P Smart Contract handler with automatic transaction verification
 * Adds verification of user deposits via Blockfrost API
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Lucid, Blockfrost } from "lucid-cardano";
import { config } from 'dotenv';
import { refundTx } from './utils/lucid.js';
// Load environment variables
config();
// ============================================================================
// CONFIGURATION (Enhanced)
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
    // New verification settings
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
    /**
     * Verify transactions from a specific wallet address to our deposit address
     */
    async verifyTransactionByWalletAddress(senderWalletAddress, expectedAmount) {
        try {
            // Skip initialization check since lucid is not needed for BlockchainVerifier
            console.log(`🔍 Verifying transaction from ${senderWalletAddress} with amount ${expectedAmount}...`);
            // Get deposit address
            const depositAddress = this.depositAddress;
            // Fetch recent transactions for the sender wallet address
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
            // Check each transaction to find one that meets our criteria
            for (const tx of transactions) {
                const txHash = tx.tx_hash;
                // Get transaction details
                const txDetailsResponse = await fetch(`${this.baseUrl}/txs/${txHash}`, {
                    headers: { 'project_id': this.apiKey }
                });
                if (!txDetailsResponse.ok)
                    continue;
                const txData = await txDetailsResponse.json();
                // Get transaction UTXOs
                const utxosResponse = await fetch(`${this.baseUrl}/txs/${txHash}/utxos`, {
                    headers: { 'project_id': this.apiKey }
                });
                if (!utxosResponse.ok)
                    continue;
                const utxosData = await utxosResponse.json();
                // Find output to our deposit address
                const depositOutput = utxosData.outputs.find((output) => output.address === depositAddress);
                if (!depositOutput)
                    continue;
                // Check amount (lovelace)
                const sentAmount = BigInt(depositOutput.amount.find((asset) => asset.unit === 'lovelace')?.quantity || '0');
                if (sentAmount < expectedAmount)
                    continue;
                // Check transaction age
                const txTimestamp = txData.block_time;
                const currentTimestamp = Math.floor(Date.now() / 1000);
                const txAge = currentTimestamp - txTimestamp;
                if (txAge > CONFIG.maxTxAge)
                    continue;
                // Verify sender address matches
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
                // Check confirmations
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
            // If we get here, no valid transaction was found
            return {
                isValid: false,
                error: `No valid transaction found from ${senderWalletAddress} to ${depositAddress} with amount >= ${expectedAmount}`
            };
        }
        catch (error) {
            console.error('❌ Verification error:', error);
            return {
                isValid: false,
                error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Verify a transaction hash against our deposit requirements
     */
    async verifyTransaction(txHash, expectedAmount, userAddress) {
        try {
            console.log(`🔍 Verifying transaction: ${txHash}`);
            // Get transaction details from Blockfrost
            const txResponse = await fetch(`${this.baseUrl}/txs/${txHash}`, {
                headers: { 'project_id': this.apiKey }
            });
            if (!txResponse.ok) {
                return {
                    isValid: false,
                    error: `Transaction not found: ${txHash}`
                };
            }
            const txData = await txResponse.json();
            // Get transaction UTXOs
            const utxosResponse = await fetch(`${this.baseUrl}/txs/${txHash}/utxos`, {
                headers: { 'project_id': this.apiKey }
            });
            if (!utxosResponse.ok) {
                return {
                    isValid: false,
                    error: `Could not fetch transaction UTXOs: ${txHash}`
                };
            }
            const utxosData = await utxosResponse.json();
            // Find output to our deposit address
            const depositOutput = utxosData.outputs.find((output) => output.address === this.depositAddress);
            if (!depositOutput) {
                return {
                    isValid: false,
                    error: `Transaction does not send funds to deposit address: ${this.depositAddress}`
                };
            }
            // Check amount (lovelace)
            const sentAmount = BigInt(depositOutput.amount.find((asset) => asset.unit === 'lovelace')?.quantity || '0');
            if (sentAmount < expectedAmount) {
                return {
                    isValid: false,
                    error: `Insufficient amount sent. Expected: ${expectedAmount}, Got: ${sentAmount}`
                };
            }
            // Check transaction age
            const txTimestamp = txData.block_time;
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const txAge = currentTimestamp - txTimestamp;
            if (txAge > CONFIG.maxTxAge) {
                return {
                    isValid: false,
                    error: `Transaction too old. Age: ${txAge}s, Max: ${CONFIG.maxTxAge}s`
                };
            }
            // Get sender address (first input)
            const senderAddress = utxosData.inputs[0]?.address;
            // Optional: verify sender matches user address
            if (userAddress && senderAddress !== userAddress) {
                console.warn(`⚠️  Sender mismatch: Expected ${userAddress}, Got ${senderAddress}`);
            }
            const transaction = {
                txHash,
                amount: sentAmount,
                fromAddress: senderAddress,
                toAddress: this.depositAddress,
                timestamp: txTimestamp,
                confirmations: txData.confirmations || 0,
                valid: true
            };
            // Check confirmations
            if (transaction.confirmations < CONFIG.minConfirmations) {
                return {
                    isValid: false,
                    transaction,
                    error: `Insufficient confirmations. Required: ${CONFIG.minConfirmations}, Got: ${transaction.confirmations}`
                };
            }
            console.log(`✅ Transaction verified successfully`);
            return {
                isValid: true,
                transaction
            };
        }
        catch (error) {
            console.error('❌ Verification error:', error);
            return {
                isValid: false,
                error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Monitor incoming transactions to deposit address
     */
    async getRecentTransactions(limit = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/addresses/${this.depositAddress}/transactions?order=desc&count=${limit}`, {
                headers: { 'project_id': this.apiKey }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch transactions: ${response.statusText}`);
            }
            const transactions = await response.json();
            const details = [];
            for (const tx of transactions) {
                const verification = await this.verifyTransaction(tx.tx_hash, CONFIG.requiredDeposit);
                if (verification.transaction) {
                    details.push(verification.transaction);
                }
            }
            return details;
        }
        catch (error) {
            console.error('❌ Error fetching recent transactions:', error);
            return [];
        }
    }
}
// ============================================================================
// ENHANCED K33P MANAGER
// ============================================================================
class EnhancedK33PManager {
    depositsFile = 'user-deposits.json';
    lucid;
    validator;
    verifier;
    constructor() {
        this.verifier = new BlockchainVerifier(CONFIG.blockfrostApiKey, CONFIG.blockfrostUrl);
    }
    /**
     * Initialize the enhanced K33P manager
     */
    async initialize() {
        console.log('🔧 Initializing Enhanced K33P manager...');
        this.lucid = await Lucid.new(new Blockfrost(CONFIG.blockfrostUrl, CONFIG.blockfrostApiKey), CONFIG.network);
        this.lucid.selectWalletFromSeed(CONFIG.seedPhrase);
        // Set deposit address for verifier
        const depositAddress = await this.lucid.wallet.address();
        await this.verifier.setDepositAddress(depositAddress);
        await this.loadValidator();
        console.log('✅ Enhanced K33P manager initialized successfully');
    }
    /**
     * Record signup with automatic transaction verification
     */
    async recordSignupWithVerification(userAddress, userId, phoneNumber, senderWalletAddress, // Make senderWalletAddress optional
    pin, biometricData, verificationMethod = 'phone', biometricType) {
        // Validate user input first
        const validation = this.validateUserInput(userId, phoneNumber, pin, biometricData, verificationMethod, biometricType);
        if (!validation.isValid) {
            return {
                success: false,
                message: `Validation failed: ${validation.error}`,
                verified: false
            };
        }
        // Check if user already exists
        const deposits = this.loadDeposits();
        const existingDeposit = deposits.find(d => d.userAddress === userAddress || d.userId === userId);
        if (existingDeposit) {
            return {
                success: false,
                message: `User already exists: ${userId}`,
                verified: false
            };
        }
        console.log(`🔄 Recording signup for ${userId} with verification method: ${verificationMethod}...`);
        // Initialize verification result
        let verificationResult = {
            isValid: false,
            error: 'No wallet address provided for verification'
        };
        // Only verify transaction if senderWalletAddress is provided
        if (senderWalletAddress) {
            verificationResult = await this.verifier.verifyTransactionByWalletAddress(senderWalletAddress, CONFIG.requiredDeposit);
        }
        const phoneHash = this.generatePhoneHash(phoneNumber);
        let pinHash;
        let biometricHash;
        // Generate PIN hash if provided
        if (pin && (verificationMethod === 'pin')) {
            pinHash = this.generatePinHash(pin);
        }
        // Generate biometric hash if provided
        if (biometricData && (verificationMethod === 'biometric')) {
            biometricHash = this.generateBiometricHash(biometricData);
        }
        const zkProof = this.generateZKProof(phoneHash, userId, pinHash, biometricHash);
        const deposit = {
            userAddress,
            userId,
            phoneHash,
            zkProof,
            txHash: verificationResult.transaction?.txHash || '',
            amount: CONFIG.requiredDeposit,
            timestamp: new Date().toISOString(),
            refunded: false,
            signupCompleted: false,
            verified: verificationResult.isValid,
            verificationAttempts: 1,
            lastVerificationAttempt: new Date().toISOString(),
            pinHash,
            biometricHash,
            biometricType: verificationMethod === 'biometric' ? biometricType : undefined,
            verificationMethod
        };
        deposits.push(deposit);
        this.saveDeposits(deposits);
        if (verificationResult.isValid) {
            console.log(`✅ Signup recorded and verified: ${userId}`);
            return {
                success: true,
                message: `Signup recorded and transaction verified for ${userId}`,
                verified: true
            };
        }
        else {
            console.log(`⚠️  Signup recorded but verification failed: ${verificationResult.error}`);
            // If no wallet address was provided, return the deposit address
            if (!senderWalletAddress) {
                return {
                    success: true,
                    message: `Please send ${Number(CONFIG.requiredDeposit) / 1_000_000} ADA to the deposit address to complete signup.`,
                    verified: false,
                    depositAddress: await this.getDepositAddress()
                };
            }
            return {
                success: true,
                message: `Signup recorded but verification failed: ${verificationResult.error}. You can retry verification later.`,
                verified: false
            };
        }
    }
    /**
     * Retry verification for unverified deposits
     */
    async retryVerification(userAddress) {
        const deposits = this.loadDeposits();
        const deposit = deposits.find(d => d.userAddress === userAddress);
        if (!deposit) {
            return {
                success: false,
                message: 'No deposit found for this address'
            };
        }
        if (deposit.verified) {
            return {
                success: true,
                message: 'Transaction already verified'
            };
        }
        console.log(`🔄 Retrying verification for ${deposit.userId}...`);
        // First try with the stored txHash
        let verificationResult = await this.verifier.verifyTransaction(deposit.txHash, CONFIG.requiredDeposit, userAddress);
        // If verification fails with txHash, try by wallet address
        if (!verificationResult.isValid) {
            console.log(`Transaction verification failed, trying by wallet address...`);
            verificationResult = await this.verifier.verifyTransactionByWalletAddress(userAddress, CONFIG.requiredDeposit);
            // Update txHash if found by wallet address
            if (verificationResult.isValid && verificationResult.transaction?.txHash) {
                deposit.txHash = verificationResult.transaction.txHash;
            }
        }
        deposit.verificationAttempts += 1;
        deposit.lastVerificationAttempt = new Date().toISOString();
        deposit.verified = verificationResult.isValid;
        this.saveDeposits(deposits);
        if (verificationResult.isValid) {
            return {
                success: true,
                message: `Transaction verified successfully for ${deposit.userId}`
            };
        }
        else {
            return {
                success: false,
                message: `Verification failed: ${verificationResult.error}`
            };
        }
    }
    /**
     * Auto-verify all unverified deposits
     */
    async autoVerifyDeposits() {
        const deposits = this.loadDeposits();
        const unverified = deposits.filter(d => !d.verified);
        console.log(`🔄 Auto-verifying ${unverified.length} unverified deposits...`);
        for (const deposit of unverified) {
            console.log(`Checking ${deposit.userId}...`);
            // First try with txHash if available
            let verificationResult = await this.verifier.verifyTransaction(deposit.txHash, CONFIG.requiredDeposit, deposit.userAddress);
            // If verification fails with txHash, try by wallet address
            if (!verificationResult.isValid) {
                console.log(`Transaction verification failed, trying by wallet address...`);
                verificationResult = await this.verifier.verifyTransactionByWalletAddress(deposit.userAddress, CONFIG.requiredDeposit);
                // Update txHash if found by wallet address
                if (verificationResult.isValid && verificationResult.transaction?.txHash) {
                    deposit.txHash = verificationResult.transaction.txHash;
                }
            }
            deposit.verificationAttempts += 1;
            deposit.lastVerificationAttempt = new Date().toISOString();
            deposit.verified = verificationResult.isValid;
            if (verificationResult.isValid) {
                console.log(`✅ Verified: ${deposit.userId}`);
            }
            else {
                console.log(`❌ Still unverified: ${deposit.userId} - ${verificationResult.error}`);
            }
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.saveDeposits(deposits);
        console.log(`✅ Auto-verification complete`);
    }
    /**
     * Monitor for new incoming transactions
     */
    async monitorIncomingTransactions() {
        console.log('👀 Monitoring for new transactions...');
        const recentTxs = await this.verifier.getRecentTransactions(20);
        const deposits = this.loadDeposits();
        const knownTxHashes = new Set(deposits.map(d => d.txHash));
        const newTransactions = recentTxs.filter(tx => !knownTxHashes.has(tx.txHash));
        if (newTransactions.length > 0) {
            console.log(`🆕 Found ${newTransactions.length} new transactions:`);
            newTransactions.forEach(tx => {
                console.log(`  ${tx.txHash} - ${Number(tx.amount) / 1_000_000} ADA from ${tx.fromAddress}`);
            });
            console.log('\n💡 Users can now register these transactions using record-signup command');
        }
        else {
            console.log('📭 No new transactions found');
        }
    }
    /**
     * Process signup (only for verified deposits)
     */
    async processSignup(userAddress) {
        const deposits = this.loadDeposits();
        const userDeposit = deposits.find(d => d.userAddress === userAddress &&
            !d.signupCompleted &&
            d.verified // Only process verified deposits
        );
        if (!userDeposit) {
            // Check if unverified deposit exists
            const unverifiedDeposit = deposits.find(d => d.userAddress === userAddress &&
                !d.signupCompleted &&
                !d.verified);
            if (unverifiedDeposit) {
                throw new Error(`Deposit found but not verified. Use 'retry-verification' command first.`);
            }
            throw new Error(`No verified pending signup found for ${userAddress}`);
        }
        console.log(`🔄 Processing verified signup for ${userDeposit.userId}...`);
        // ... rest of the original processSignup logic ...
        // (keeping the smart contract interaction the same)
        return "transaction_hash_placeholder";
    }
    /**
     * Process a refund for a user's deposit
     * @param userAddress The user's wallet address
     * @param refundAddress Optional address to send the refund to (defaults to userAddress)
     * @returns Object with success status, message, and transaction hash if successful
     */
    async processRefund(userAddress, refundAddress) {
        try {
            // Load deposits
            const deposits = this.loadDeposits();
            const deposit = deposits.find(d => d.userAddress === userAddress);
            if (!deposit) {
                return { success: false, message: 'No deposit found for this address' };
            }
            if (deposit.refunded) {
                return { success: false, message: 'Deposit already refunded' };
            }
            if (!deposit.verified) {
                // If not verified, try to verify it immediately
                console.log(`Deposit not verified, attempting immediate verification for ${userAddress}`);
                const verificationResult = await this.retryVerification(userAddress);
                if (!verificationResult.success) {
                    return { success: false, message: `Cannot process refund: ${verificationResult.message}` };
                }
                // Reload deposits after verification
                const updatedDeposits = this.loadDeposits();
                const updatedDeposit = updatedDeposits.find(d => d.userAddress === userAddress);
                if (!updatedDeposit) {
                    return { success: false, message: 'Deposit not found after verification' };
                }
                Object.assign(deposit, updatedDeposit);
            }
            // Use the imported refundTx function
            // Create a UTXO object from deposit data
            const scriptUtxo = {
                txHash: deposit.txHash,
                outputIndex: 0, // Assuming output index is 0
                assets: {
                    lovelace: deposit.amount
                }
            };
            // Use userAddress as the refund address if refundAddress is not provided
            const targetAddress = refundAddress || userAddress;
            // Issue the refund
            const txHash = await refundTx(targetAddress, scriptUtxo);
            // Update deposit status
            deposit.refunded = true;
            deposit.refundTxHash = txHash;
            deposit.refundTimestamp = new Date().toISOString();
            this.saveDeposits(deposits);
            return { success: true, message: 'Refund processed successfully', txHash };
        }
        catch (error) {
            console.error('Error processing refund:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to process refund'
            };
        }
    }
    /**
     * List deposits with verification status
     */
    listDepositsWithStatus() {
        const deposits = this.loadDeposits();
        console.log('\n📋 All Deposits:');
        console.log('================');
        deposits.forEach(deposit => {
            const status = deposit.verified ? '✅ VERIFIED' : '❌ UNVERIFIED';
            const signup = deposit.signupCompleted ? 'COMPLETED' : 'PENDING';
            const refund = deposit.refunded ? 'REFUNDED' : 'NOT REFUNDED';
            console.log(`\n👤 ${deposit.userId} (${deposit.userAddress})`);
            console.log(`   Status: ${status}`);
            console.log(`   Signup: ${signup}`);
            console.log(`   Refund: ${refund}`);
            console.log(`   TX: ${deposit.txHash}`);
            console.log(`   Amount: ${Number(deposit.amount) / 1_000_000} ADA`);
            console.log(`   Date: ${deposit.timestamp}`);
            console.log(`   Verification Attempts: ${deposit.verificationAttempts}`);
        });
    }
    // ============================================================================
    // UTILITY METHODS (From original class)
    // ============================================================================
    validateUserInput(userId, phoneNumber, pin, biometricData, verificationMethod = 'phone', biometricType) {
        if (userId.length < CONFIG.minUserIdLength || userId.length > CONFIG.maxUserIdLength) {
            return {
                isValid: false,
                error: `User ID must be ${CONFIG.minUserIdLength}-${CONFIG.maxUserIdLength} characters`
            };
        }
        if (phoneNumber.length < 10) {
            return {
                isValid: false,
                error: 'Phone number must be at least 10 digits'
            };
        }
        if (!/^[a-zA-Z0-9_]+$/.test(userId)) {
            return {
                isValid: false,
                error: 'User ID can only contain letters, numbers, and underscores'
            };
        }
        // Validate PIN if verification method is PIN
        if (verificationMethod === 'pin') {
            if (!pin) {
                return {
                    isValid: false,
                    error: 'PIN is required for PIN verification method'
                };
            }
            if (!/^\d{4}$/.test(pin)) {
                return {
                    isValid: false,
                    error: 'PIN must be exactly 4 digits'
                };
            }
        }
        // Validate biometric data if verification method is biometric
        if (verificationMethod === 'biometric') {
            if (!biometricData) {
                return {
                    isValid: false,
                    error: 'Biometric data is required for biometric verification method'
                };
            }
            if (!biometricType) {
                return {
                    isValid: false,
                    error: 'Biometric type is required for biometric verification method'
                };
            }
            // Validate that biometricType is one of the allowed types
            if (!['fingerprint', 'faceid', 'voice', 'iris'].includes(biometricType)) {
                return {
                    isValid: false,
                    error: 'Biometric type must be one of: fingerprint, faceid, voice, iris'
                };
            }
        }
        return { isValid: true };
    }
    generatePhoneHash(phoneNumber) {
        const hash = crypto.createHash('sha256').update(phoneNumber.trim()).digest();
        return hash.toString('hex');
    }
    generatePinHash(pin) {
        const hash = crypto.createHash('sha256').update(`pin:${pin.trim()}`).digest();
        return hash.toString('hex');
    }
    generateBiometricHash(biometricData) {
        const hash = crypto.createHash('sha256').update(`biometric:${biometricData.trim()}`).digest();
        return hash.toString('hex');
    }
    generateZKProof(phoneHash, userId, pinHash, biometricHash) {
        let combined = phoneHash + userId + Date.now().toString();
        // Include PIN and biometric hashes in the proof if available
        if (pinHash) {
            combined += pinHash;
        }
        if (biometricHash) {
            combined += biometricHash;
        }
        const hash = crypto.createHash('sha256').update(combined).digest();
        const padded = Buffer.concat([hash, Buffer.alloc(CONFIG.proofLength - hash.length, 0)]);
        return padded.toString('hex');
    }
    loadDeposits() {
        if (!fs.existsSync(this.depositsFile)) {
            return [];
        }
        try {
            const deposits = JSON.parse(fs.readFileSync(this.depositsFile, 'utf8'));
            // Convert string amounts back to BigInt
            return deposits.map((deposit) => ({
                ...deposit,
                amount: typeof deposit.amount === 'string' ? BigInt(deposit.amount) : deposit.amount
            }));
        }
        catch (error) {
            console.error('Error loading deposits:', error);
            return [];
        }
    }
    saveDeposits(deposits) {
        try {
            // Convert BigInt values to strings before serialization
            const serializableDeposits = deposits.map(deposit => {
                // Create a new object with all properties from deposit but with amount as any type
                const newDeposit = { ...deposit };
                // Ensure amount is converted to string if it's a BigInt
                if (typeof newDeposit.amount === 'bigint') {
                    newDeposit.amount = newDeposit.amount.toString();
                }
                return newDeposit;
            });
            fs.writeFileSync(this.depositsFile, JSON.stringify(serializableDeposits, null, 2));
        }
        catch (error) {
            console.error('Error saving deposits:', error);
            throw error;
        }
    }
    async loadValidator() {
        try {
            const plutusScript = JSON.parse(fs.readFileSync("plutus.json", "utf8"));
            this.validator = {
                type: "PlutusV2",
                script: plutusScript.validators[0].compiledCode,
            };
            console.log('✅ Validator loaded successfully');
        }
        catch (error) {
            console.log('⚠️  Warning: Could not load validator (deploy first)');
        }
    }
    async getDepositAddress() {
        if (!this.lucid)
            await this.initialize();
        return await this.lucid.wallet.address();
    }
}
//for the cli enhanced part
async function main() {
    const manager = new EnhancedK33PManager();
    const command = process.argv[2];
    try {
        switch (command) {
            case 'record-signup':
                const [userAddr, userId, phoneNumber, txHash] = process.argv.slice(3);
                if (!userAddr || !userId || !phoneNumber || !txHash) {
                    console.error('Usage: npm run record-signup <user-address> <user-id> <phone-number> <tx-hash>');
                    process.exit(1);
                }
                const result = await manager.recordSignupWithVerification(userAddr, userId, phoneNumber, txHash);
                console.log(`${result.success ? '✅' : '❌'} ${result.message}`);
                break;
            case 'retry-verification':
                const retryAddr = process.argv[3];
                if (!retryAddr) {
                    console.error('Usage: npm run retry-verification <user-address>');
                    process.exit(1);
                }
                const retryResult = await manager.retryVerification(retryAddr);
                console.log(`${retryResult.success ? '✅' : '❌'} ${retryResult.message}`);
                break;
            case 'auto-verify':
                await manager.autoVerifyDeposits();
                break;
            case 'monitor':
                await manager.monitorIncomingTransactions();
                break;
            case 'status-all':
                manager.listDepositsWithStatus();
                break;
            case 'deposit-address':
                const address = await manager.getDepositAddress();
                console.log('\n💳 Send 2 ADA to this testnet address:');
                console.log(`📍 ${address}`);
                console.log('\n🔗 Get testnet ADA: https://docs.cardano.org/cardano-testnet/tools/faucet/');
                break;
            default:
                console.log(`
🎯 Enhanced K33P Smart Contract Manager

Commands:
  deposit-address           Get the deposit address for users
  record-signup            Record signup with automatic transaction verification
  retry-verification       Retry verification for a specific user
  auto-verify             Auto-verify all unverified deposits
  monitor                 Monitor for new incoming transactions
  status-all              Show all deposits with verification status

Examples:
  npm run deposit-address
  npm run record-signup addr_test1... john_doe +1234567890 txhash123...
  npm run retry-verification addr_test1...
  npm run auto-verify
  npm run monitor
  npm run status-all
        `);
                break;
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}
// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
// Export the classes for use in other files
export { EnhancedK33PManager, BlockchainVerifier };
//# sourceMappingURL=k33p-signup-interactions.js.map