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
 * @desc Register a new user with verification
 * @access Public
 */
router.post('/signup', async (req, res) => {
  try {
    const { 
      userAddress, 
      userId, 
      phoneNumber, 
      senderWalletAddress, 
      pin, 
      biometricData, 
      verificationMethod = 'phone', 
      biometricType,
      // Legacy fields for backward compatibility
      walletAddress, 
      phone, 
      biometric, 
      passkey 
    } = req.body;

    // Support both new and legacy request formats
    const finalUserAddress = userAddress || walletAddress;
    const finalPhoneNumber = phoneNumber || phone;
    const finalBiometricData = biometricData || biometric;

    // Validate required fields
    if (!finalPhoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!userId && !passkey) {
      return res.status(400).json({ error: 'User ID or passkey is required' });
    }

    // Hash user data
    const phoneHash = hashPhone(finalPhoneNumber);
    const biometricHash = finalBiometricData ? hashBiometric(finalBiometricData) : null;
    const passkeyHash = passkey ? hashPasskey(passkey) : null;

    // Check if user already exists by phone hash
    const existingUser = await iagon.findUser({ phoneHash });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this phone number' });
    }

    // If user address is provided, check if it's already in use
    if (finalUserAddress) {
      const existingWalletUser = await iagon.findUser({ walletAddress: finalUserAddress });
      if (existingWalletUser) {
        return res.status(400).json({ error: 'User already exists with this wallet address' });
      }
    }

    // Generate ZK commitment
    const commitmentData = { phoneHash };
    if (biometricHash) commitmentData.biometricHash = biometricHash;
    if (passkeyHash) commitmentData.passkeyHash = passkeyHash;
    
    const zkCommitment = generateZkCommitment(commitmentData);

    // Simulate ZK proof
    const proofData = { phone: finalPhoneNumber };
    if (finalBiometricData) proofData.biometric = finalBiometricData;
    if (passkey) proofData.passkey = passkey;
    
    const zkProof = generateZkProof(proofData, zkCommitment);
    if (!zkProof.isValid) {
      return res.status(400).json({ error: 'Invalid ZK proof' });
    }

    // Create signup transaction if user address is provided
    let txHash = null;
    if (finalUserAddress) {
      txHash = await signupTxBuilder(finalUserAddress, commitmentData);
    }

    // Create user in Iagon
    const userData = {
      walletAddress: finalUserAddress || null,
      phoneHash,
      zkCommitment,
      txHash,
      userId: userId || null,
      verificationMethod,
      biometricType: biometricType || null,
      senderWalletAddress: senderWalletAddress || null
    };
    
    if (biometricHash) userData.biometricHash = biometricHash;
    if (passkeyHash) userData.passkeyHash = passkeyHash;
    if (pin) userData.pin = pin;

    const user = await iagon.createUser(userData);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    // Create session in Iagon
    await iagon.createSession({ 
      userId: user.id, 
      token, 
      expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) 
    });

    // Build response in the format expected by the TypeScript server
    const response = {
      success: true,
      data: {
        verified: verificationMethod === 'phone' ? false : true, // Phone verification requires additional step
        userId: userId || user.id,
        verificationMethod,
        message: 'Signup processed successfully',
        depositAddress: finalUserAddress // Include deposit address in response
      },
      message: 'Signup processed successfully',
      token
    };
    
    if (txHash) {
      response.txHash = txHash;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
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
    let user = await iagon.findUser({ phoneHash: hashPhone(phone) });
    if (!user && walletAddress) {
      user = await iagon.findUser({ walletAddress });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Verify ZK proof (simulated)
    if (user.zkCommitment !== commitment) {
      return res.status(401).json({ error: 'Invalid ZK proof' });
    }
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    // Create session in Iagon
    await iagon.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) });
    res.status(200).json({ message: 'Login successful', token, hasWallet: !!user.walletAddress });
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
    const existingUser = await iagon.findUser({ walletAddress });
    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({ message: 'Wallet address already in use by another user' });
    }

    // Query blockchain for recent transactions
    const isValidTx = await verify2AdaTransaction(walletAddress);
    if (!isValidTx) {
      return res.status(400).json({ message: 'No valid 2 ADA transaction found' });
    }

    // Update user with wallet address using iagon
    await iagon.updateUser(userId, { walletAddress });

    res.json({ message: 'Wallet verified successfully' });
  } catch (error) {
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
    const user = await iagon.findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.walletAddress) {
      return res.status(400).json({ message: 'No wallet address found' });
    }
    
    res.json({ walletAddress: user.walletAddress });
  } catch (error) {
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
      const hasSufficientInput = txDetails.inputs.some(
        input => input.address === walletAddress && 
                BigInt(input.amount[0].quantity) >= 2000000n // 2 ADA in lovelace
      );
      
      // Verify outputs contain exactly 2 ADA back to this wallet
      const hasExactOutput = txDetails.outputs.some(
        output => output.address === walletAddress && 
                 BigInt(output.amount[0].quantity) === 2000000n
      );

      if (hasSufficientInput && hasExactOutput) {
        // Cache positive result
        walletCache.set(walletAddress, true);
        return true;
      }
    }
    
    // Cache negative result
    walletCache.set(walletAddress, false);
    return false;
  } catch (error) {
    console.error('Blockchain query error:', error);
    return false;
  }
}

export default router;