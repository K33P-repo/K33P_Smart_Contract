// Authentication routes for K33P Identity System
import express from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken, verifyZkProof, authenticate } from '../middleware/auth.js';
import { hashPhone, hashBiometric, hashPasskey } from '../utils/hash.js';
import { generateZkCommitment, generateZkProof, verifyZkProof as verifyZkProofUtil } from '../utils/zk.js';
import { signupTxBuilder } from '../utils/lucid.js';
import * as iagon from '../utils/iagon.js';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
const router = express.Router();
/**
 * @route POST /api/auth/signup
 * @desc Register a new user
 * @access Public
 */
router.post('/signup', async (req, res) => {
    try {
        const { walletAddress, phone, biometric, passkey } = req.body;
        if (!walletAddress || !phone || !biometric || !passkey) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Hash user data
        const phoneHash = hashPhone(phone);
        const biometricHash = hashBiometric(biometric);
        const passkeyHash = hashPasskey(passkey);
        // Check if user already exists
        const existingUser = await iagon.findUser({ walletAddress }) || await iagon.findUser({ phoneHash });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Generate ZK commitment
        const zkCommitment = generateZkCommitment({ phoneHash, biometricHash, passkeyHash });
        // Simulate ZK proof
        const zkProof = generateZkProof({ phone, biometric, passkey }, zkCommitment);
        if (!zkProof.isValid) {
            return res.status(400).json({ error: 'Invalid ZK proof' });
        }
        // Create signup transaction
        const txHash = await signupTxBuilder(walletAddress, { phoneHash, biometricHash, passkeyHash });
        // Create user in Iagon
        const user = await iagon.createUser({ walletAddress, phoneHash, biometricHash, passkeyHash, zkCommitment, txHash });
        // Generate JWT token
        const token = jwt.sign({ id: user.id, walletAddress: user.walletAddress }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRATION || '24h' });
        // Create session in Iagon
        await iagon.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) });
        res.status(201).json({ message: 'User registered successfully', txHash, token });
    }
    catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to register user' });
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
        if (!walletAddress || !phone || !proof || !commitment) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Find user by wallet address or phone hash
        const user = await iagon.findUser({ walletAddress }) || await iagon.findUser({ phoneHash: hashPhone(phone) });
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
        res.status(200).json({ message: 'Login successful', token });
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
        // Find user by ID in Iagon
        const user = await iagon.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ id: user.id, walletAddress: user.walletAddress, createdAt: user.createdAt, updatedAt: user.updatedAt });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});
/**
 * @route POST /api/auth/verify-wallet
 * @desc Verify wallet address and 2ADA transaction
 * @access Private
 */
// New wallet verification endpoint
router.post('/verify-wallet', authenticate, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        const userId = req.user.userId;
        // Query blockchain for recent transactions
        const isValidTx = await verify2AdaTransaction(walletAddress);
        if (!isValidTx) {
            return res.status(400).json({ message: 'No valid 2 ADA transaction found' });
        }
        // Update user with wallet address
        await User.findByIdAndUpdate(userId, { walletAddress });
        res.json({ message: 'Wallet verified successfully' });
    }
    catch (error) {
        console.error('Wallet verification error:', error);
        res.status(500).json({ message: 'Wallet verification failed', error: error.message });
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
// Wallet connect functionality
router.get('/wallet-connect', authenticate, async (req, res) => {
    try {
        const { userId } = req.user;
        const user = await User.findById(userId);
        if (!user.walletAddress) {
            return res.status(400).json({ message: 'No wallet address found' });
        }
        res.json({ walletAddress: user.walletAddress });
    }
    catch (error) {
        console.error('Wallet connect error:', error);
        res.status(500).json({ message: 'Wallet connect failed', error: error.message });
    }
});
export default router;
// Initialize Blockfrost API
const blockfrost = new BlockFrostAPI({
    projectId: process.env.BLOCKFROST_API_KEY || 'preprodbl7bIxYc2sbEeGAZyo2hpkjJwzOAQNtG', // Fallback to the value in .env
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
// Apply rate limiter to verify-wallet endpoint
router.post('/verify-wallet', authenticate, walletVerifyLimiter, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        const userId = req.user.userId;
        // Query blockchain for recent transactions
        const isValidTx = await verify2AdaTransaction(walletAddress);
        if (!isValidTx) {
            return res.status(400).json({ message: 'No valid 2 ADA transaction found' });
        }
        // Update user with wallet address
        await User.findByIdAndUpdate(userId, { walletAddress });
        res.json({ message: 'Wallet verified successfully' });
    }
    catch (error) {
        console.error('Wallet verification error:', error);
        res.status(500).json({ message: 'Wallet verification failed', error: error.message });
    }
});
//# sourceMappingURL=auth.js.map