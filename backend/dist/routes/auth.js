// Authentication routes for K33P Identity System
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyToken, verifyZkProof, authenticate } from '../middleware/auth.js';
import { hashPhone, hashBiometric, hashPasskey } from '../utils/hash.js';
import { generateZkCommitment, generateZkProof, verifyZkProof as verifyZkProofUtil } from '../utils/zk.js';
import { signupTxBuilder } from '../utils/lucid.js';
import * as iagon from '../utils/iagon.js';
import { storageService } from '../services/storage-abstraction.js';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
const router = express.Router();
/**
 * @route POST /api/auth/signup
 * @desc Register a new user with verification
 * @access Public
 */
router.post('/signup', async (req, res) => {
    try {
        console.log('=== SIGNUP DEBUG START ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Environment variables check:');
        console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
        console.log('- JWT_EXPIRATION:', process.env.JWT_EXPIRATION || 'NOT SET (using default)');
        console.log('- BLOCKFROST_API_KEY:', process.env.BLOCKFROST_API_KEY ? 'SET' : 'NOT SET');
        const { userAddress, userId, phoneNumber, senderWalletAddress, pin, biometricData, verificationMethod = 'phone', biometricType, 
        // Legacy fields for backward compatibility
        walletAddress, phone, biometric, passkey } = req.body;
        console.log('Extracted fields:', {
            userAddress,
            userId,
            phoneNumber,
            senderWalletAddress,
            verificationMethod,
            biometricType,
            walletAddress,
            phone,
            hasPasskey: !!passkey,
            hasBiometric: !!biometric,
            hasBiometricData: !!biometricData
        });
        // Support both new and legacy request formats
        const finalUserAddress = userAddress || walletAddress;
        const finalPhoneNumber = phoneNumber || phone;
        const finalBiometricData = biometricData || biometric;
        console.log('Final processed fields:', {
            finalUserAddress,
            finalPhoneNumber,
            hasFinalBiometricData: !!finalBiometricData
        });
        // Validate required fields
        if (!finalPhoneNumber) {
            console.log('Validation failed: Phone number is required');
            return res.status(400).json({ error: 'Phone number is required' });
        }
        if (!userId && !passkey) {
            console.log('Validation failed: User ID or passkey is required');
            return res.status(400).json({ error: 'User ID or passkey is required' });
        }
        console.log('Step 1: Hashing phone...');
        const phoneHash = hashPhone(finalPhoneNumber);
        console.log('Phone hash created successfully');
        console.log('Step 2: Hashing biometric data...');
        const biometricHash = finalBiometricData ? hashBiometric(finalBiometricData) : null;
        console.log('Biometric hash created:', !!biometricHash);
        console.log('Step 3: Hashing passkey...');
        const passkeyHash = passkey ? hashPasskey(passkey) : null;
        console.log('Passkey hash created:', !!passkeyHash);
        console.log('Step 4: Checking existing user by phone...');
        const existingUserResult = await storageService.findUser({ phoneHash });
        console.log('Existing user check completed, found:', !!existingUserResult.data);
        if (existingUserResult.success && existingUserResult.data) {
            console.log('User already exists with this phone number');
            return res.status(400).json({ error: 'User already exists with this phone number' });
        }
        // If user address is provided, check if it's already in use
        if (finalUserAddress) {
            console.log('Step 5: Checking existing user by wallet address...');
            const existingWalletUserResult = await storageService.findUser({ walletAddress: finalUserAddress });
            console.log('Existing wallet user check completed, found:', !!existingWalletUserResult.data);
            if (existingWalletUserResult.success && existingWalletUserResult.data) {
                console.log('User already exists with this wallet address');
                return res.status(400).json({ error: 'User already exists with this wallet address' });
            }
        }
        console.log('Step 6: Generating ZK commitment...');
        const commitmentData = { phoneHash };
        if (biometricHash)
            commitmentData.biometricHash = biometricHash;
        if (passkeyHash)
            commitmentData.passkeyHash = passkeyHash;
        const zkCommitment = generateZkCommitment(commitmentData);
        console.log('ZK commitment generated successfully');
        console.log('Step 7: Generating ZK proof...');
        const proofData = { phone: finalPhoneNumber };
        if (finalBiometricData)
            proofData.biometric = finalBiometricData;
        if (passkey)
            proofData.passkey = passkey;
        const zkProof = generateZkProof(proofData, zkCommitment);
        console.log('ZK proof generated, valid:', zkProof.isValid);
        if (!zkProof.isValid) {
            console.log('ZK proof validation failed');
            return res.status(400).json({ error: 'Invalid ZK proof' });
        }
        // Note: Transaction creation happens later when user sends 2 ADA for verification
        // No transaction is created during initial signup
        console.log('Step 8: Creating user in storage...');
        const userData = {
            walletAddress: finalUserAddress || null,
            phoneHash,
            zkCommitment,
            userId: userId || crypto.randomUUID(),
            verificationMethod,
            biometricType: biometricType || null,
            senderWalletAddress: senderWalletAddress || null
        };
        if (biometricHash)
            userData.biometricHash = biometricHash;
        if (passkeyHash)
            userData.passkeyHash = passkeyHash;
        if (pin)
            userData.pin = pin;
        const userResult = await storageService.storeUser(userData);
        if (!userResult.success) {
            console.log('Failed to create user:', userResult.error);
            return res.status(500).json({ error: 'Failed to create user: ' + userResult.error });
        }
        const user = { id: userResult.data.id, ...userData };
        console.log('User created successfully, ID:', user.id, 'Storage:', userResult.storageUsed);
        console.log('Step 9: Generating JWT token...');
        const token = jwt.sign({ id: user.id, walletAddress: user.walletAddress }, process.env.JWT_SECRET || 'default-secret', { expiresIn: process.env.JWT_EXPIRATION || '24h' });
        console.log('JWT token generated successfully');
        console.log('Step 10: Creating session...');
        await iagon.createSession({
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000)
        });
        console.log('Session created successfully');
        console.log('Step 11: Building response...');
        const response = {
            success: true,
            data: {
                verified: verificationMethod === 'phone' ? false : true,
                userId: userId || user.id,
                verificationMethod,
                message: 'Signup processed successfully',
                depositAddress: finalUserAddress
            },
            message: 'Signup processed successfully',
            token
        };
        console.log('Response built successfully');
        console.log('=== SIGNUP DEBUG END ===');
        res.status(201).json(response);
    }
    catch (error) {
        console.error('=== SIGNUP ERROR ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('=== END SIGNUP ERROR ===');
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            debug: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * @route POST /api/auth/login
 * @desc Login a user with ZK proof
 * @access Public
 */
router.post('/login', verifyZkProof, async (req, res) => {
    try {
        const { walletAddress, phone, proof, commitment } = req.body;
        if (!phone || !proof || !commitment) {
            return res.status(400).json({ error: 'Missing required fields: phone, proof, and commitment are required' });
        }
        // Find user by phone hash first (primary identifier), then by wallet address if provided
        let userResult = await storageService.findUser({ phoneHash: hashPhone(phone) });
        let user = userResult.success ? userResult.data : null;
        if (!user && walletAddress) {
            userResult = await storageService.findUser({ walletAddress });
            user = userResult.success ? userResult.data : null;
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Verify ZK proof (simulated)
        if (user.zkCommitment !== commitment) {
            return res.status(401).json({ error: 'Invalid ZK proof' });
        }
        // Generate JWT token
        const token = jwt.sign({ id: user.id, walletAddress: user.walletAddress }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRATION || '24h' });
        // Create session in Iagon
        await iagon.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) });
        res.status(200).json({ message: 'Login successful', token, hasWallet: !!user.walletAddress });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});
/**
 * @route POST /api/auth/logout
 * @desc Logout a user
 * @access Private
 */
router.post('/logout', verifyToken, async (req, res) => {
    try {
        // Delete session in Iagon
        await iagon.deleteSessions({ userId: req.user.id });
        res.status(200).json({ message: 'Logout successful' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});
/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', verifyToken, async (req, res) => {
    try {
        // Find user by ID using storage abstraction
        const userResult = await storageService.findUser({ userId: req.user.id });
        if (!userResult.success || !userResult.data) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.data;
        res.status(200).json({
            id: user.id,
            walletAddress: user.walletAddress,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            storageUsed: userResult.storageUsed
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});
// Initialize Blockfrost API
const blockfrost = new BlockFrostAPI({
    projectId: process.env.BLOCKFROST_API_KEY || 'preprod3W1XBWtJSpHSjqlHcrxuPo3uv2Q5BOFM',
    network: 'preprod'
});
// Initialize cache with 5 minute TTL
const walletCache = new NodeCache({ stdTTL: 300 });
// Rate limiter for wallet verification (5 requests per minute)
const walletVerifyLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many wallet verification requests, please try again later'
});
/**
 * @route POST /api/auth/verify-wallet
 * @desc Verify wallet address and 2ADA transaction
 * @access Private
 */
router.post('/verify-wallet', authenticate, walletVerifyLimiter, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        const userId = req.user.id;
        if (!walletAddress) {
            return res.status(400).json({ message: 'Wallet address is required' });
        }
        // Check if wallet address is already in use by another user
        const existingUserResult = await storageService.findUser({ walletAddress });
        if (existingUserResult.success && existingUserResult.data && existingUserResult.data.userId !== userId) {
            return res.status(400).json({ message: 'Wallet address already in use by another user' });
        }
        // Query blockchain for recent transactions
        const isValidTx = await verify2AdaTransaction(walletAddress);
        if (!isValidTx) {
            return res.status(400).json({ message: 'No valid 2 ADA transaction found' });
        }
        // Update user with wallet address using storage abstraction
        const updateResult = await storageService.updateUser(userId, { walletAddress });
        if (!updateResult.success) {
            return res.status(500).json({ message: 'Failed to update user wallet address: ' + updateResult.error });
        }
        res.json({ message: 'Wallet verified successfully' });
    }
    catch (error) {
        console.error('Wallet verification error:', error);
        res.status(500).json({ message: 'Wallet verification failed', error: error.message });
    }
});
/**
 * @route GET /api/auth/wallet-connect
 * @desc Get user's connected wallet address
 * @access Private
 */
router.get('/wallet-connect', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const userResult = await storageService.findUser({ userId });
        if (!userResult.success || !userResult.data) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = userResult.data;
        if (!user.walletAddress) {
            return res.status(400).json({ message: 'No wallet address found' });
        }
        res.json({
            walletAddress: user.walletAddress,
            storageUsed: userResult.storageUsed
        });
    }
    catch (error) {
        console.error('Wallet connect error:', error);
        res.status(500).json({ message: 'Wallet connect failed', error: error.message });
    }
});
async function verify2AdaTransaction(walletAddress) {
    // Check cache first
    const cachedResult = walletCache.get(walletAddress);
    if (cachedResult !== undefined) {
        return cachedResult;
    }
    try {
        // Query recent transactions for this address
        const transactions = await blockfrost.addressesTransactions(walletAddress, {
            count: 10, // Check last 10 transactions
            order: 'desc'
        });
        // Check each transaction for 2 ADA pattern
        for (const tx of transactions) {
            const txDetails = await blockfrost.txs(tx.tx_hash);
            // Verify inputs contain at least 2 ADA from this wallet
            const hasSufficientInput = txDetails.inputs.some(input => input.address === walletAddress &&
                BigInt(input.amount[0].quantity) >= 2000000n // 2 ADA in lovelace
            );
            // Verify outputs contain exactly 2 ADA back to this wallet
            const hasExactOutput = txDetails.outputs.some(output => output.address === walletAddress &&
                BigInt(output.amount[0].quantity) === 2000000n);
            if (hasSufficientInput && hasExactOutput) {
                // Cache positive result
                walletCache.set(walletAddress, true);
                return true;
            }
        }
        // Cache negative result
        walletCache.set(walletAddress, false);
        return false;
    }
    catch (error) {
        console.error('Blockchain query error:', error);
        return false;
    }
}
async function verify2AdaDeposit(senderWalletAddress) {
    // Check cache first
    const cacheKey = `deposit_${senderWalletAddress}`;
    const cachedResult = walletCache.get(cacheKey);
    if (cachedResult !== undefined) {
        return cachedResult;
    }
    try {
        const scriptAddress = process.env.SCRIPT_ADDRESS;
        if (!scriptAddress) {
            console.error('SCRIPT_ADDRESS not configured');
            return false;
        }
        console.log('Checking transactions from:', senderWalletAddress);
        console.log('To script address:', scriptAddress);
        // Query recent transactions from the sender wallet
        const transactions = await blockfrost.addressesTransactions(senderWalletAddress, {
            count: 20, // Check last 20 transactions
            order: 'desc'
        });
        console.log(`Found ${transactions.length} transactions to check`);
        // Check each transaction for 2 ADA deposit to script address
        for (const tx of transactions) {
            const txDetails = await blockfrost.txs(tx.tx_hash);
            // Check if this transaction has an input from sender wallet
            const hasInputFromSender = txDetails.inputs.some(input => input.address === senderWalletAddress);
            // Check if this transaction has exactly 2 ADA output to script address
            const hasOutputToScript = txDetails.outputs.some(output => output.address === scriptAddress &&
                output.amount.some(asset => asset.unit === 'lovelace' &&
                    BigInt(asset.quantity) === 2000000n // 2 ADA in lovelace
                ));
            if (hasInputFromSender && hasOutputToScript) {
                console.log('Valid 2 ADA deposit found, tx hash:', tx.tx_hash);
                // Cache positive result for 10 minutes
                walletCache.set(cacheKey, true, 600);
                return true;
            }
        }
        console.log('No valid 2 ADA deposit found');
        // Cache negative result for 2 minutes (shorter cache for negative results)
        walletCache.set(cacheKey, false, 120);
        return false;
    }
    catch (error) {
        console.error('Blockchain query error for deposit verification:', error);
        return false;
    }
}
/**
 * @route POST /api/auth/verify-deposit
 * @desc Verify 2 ADA deposit and initiate refund
 * @access Private
 */
router.post('/verify-deposit', verifyToken, async (req, res) => {
    try {
        const { senderWalletAddress } = req.body;
        const userId = req.user.id;
        console.log('=== DEPOSIT VERIFICATION START ===');
        console.log('User ID:', userId);
        console.log('Sender wallet address:', senderWalletAddress);
        if (!senderWalletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Sender wallet address is required'
            });
        }
        // Get user data
        const userResult = await storageService.findUser({ userId });
        if (!userResult.success || !userResult.data) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        const user = userResult.data;
        console.log('Step 1: Verifying 2 ADA transaction from sender wallet...');
        // Verify 2 ADA transaction from the sender wallet to the script address
        const hasValidDeposit = await verify2AdaDeposit(senderWalletAddress);
        if (!hasValidDeposit) {
            console.log('No valid 2 ADA deposit found');
            return res.status(400).json({
                success: false,
                error: 'No valid 2 ADA deposit found from this wallet address'
            });
        }
        console.log('Step 2: Creating signup transaction with user data...');
        // Create the signup transaction with user's commitment data
        const commitmentData = {
            phoneHash: user.phoneHash,
            biometricHash: user.biometricHash || null,
            passkeyHash: user.passkeyHash || null
        };
        const txHash = await signupTxBuilder(senderWalletAddress, commitmentData);
        console.log('Signup transaction created, txHash:', txHash);
        console.log('Step 3: Updating user with transaction details...');
        // Update user with sender wallet and transaction hash
        const updateResult = await storageService.updateUser(userId, {
            senderWalletAddress,
            txHash,
            verified: true
        });
        if (!updateResult.success) {
            console.log('Failed to update user:', updateResult.error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update user: ' + updateResult.error
            });
        }
        console.log('User updated successfully, storage used:', updateResult.storageUsed);
        console.log('Step 4: Initiating refund process...');
        // Note: The actual refund will be handled by the auto-refund monitor
        // which detects the UTXO and processes the refund automatically
        console.log('=== DEPOSIT VERIFICATION SUCCESS ===');
        res.status(200).json({
            success: true,
            message: 'Deposit verified successfully. Refund will be processed automatically.',
            txHash,
            senderWalletAddress
        });
    }
    catch (error) {
        console.error('=== DEPOSIT VERIFICATION ERROR ===');
        console.error('Error:', error);
        console.error('=== END DEPOSIT VERIFICATION ERROR ===');
        res.status(500).json({
            success: false,
            error: 'Failed to verify deposit',
            message: error.message
        });
    }
});
/**
 * @route POST /api/auth/verify
 * @desc Verify JWT token
 * @access Public
 */
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }
        // Verify JWT token
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Check if user exists
            const userResult = await storageService.findUser({ userId: decoded.id });
            if (!userResult.success || !userResult.data) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            const user = userResult.data;
            // Check if session exists in Iagon
            const session = await iagon.findSession({ userId: decoded.id, token });
            if (!session) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid session'
                });
            }
            res.status(200).json({
                success: true,
                message: 'Token is valid',
                user: {
                    id: user.id,
                    walletAddress: user.walletAddress,
                    createdAt: user.createdAt
                }
            });
        }
        catch (jwtError) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
    }
    catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify token'
        });
    }
});
export default router;
//# sourceMappingURL=auth.js.map