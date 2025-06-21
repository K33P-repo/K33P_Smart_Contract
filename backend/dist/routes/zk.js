// Zero-Knowledge Proof routes for K33P Identity System
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { hashPhone, hashBiometric, hashPasskey, combinedHash } from '../utils/hash.js';
import { poseidonHash, generateZkCommitment, generateZkProof, verifyZkProof } from '../utils/zk.js';
import * as iagon from '../utils/iagon.js';

const router = express.Router();

/**
 * @route POST /api/zk/commitment
 * @desc Generate a ZK commitment from hashed values
 * @access Public
 */
router.post('/commitment', async (req, res) => {
  try {
    const { phone, biometric, passkey } = req.body;
    if (!phone || !biometric || !passkey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Hash user data
    const phoneHash = hashPhone(phone);
    const biometricHash = hashBiometric(biometric);
    const passkeyHash = hashPasskey(passkey);
    // Generate ZK commitment
    const commitment = generateZkCommitment({ phoneHash, biometricHash, passkeyHash });
    res.status(200).json({ commitment, hashes: { phoneHash, biometricHash, passkeyHash } });
  } catch (error) {
    console.error('Generate ZK commitment error:', error);
    res.status(500).json({ error: 'Failed to generate ZK commitment' });
  }
});

/**
 * @route POST /api/zk/proof
 * @desc Generate a ZK proof
 * @access Public
 */
router.post('/proof', async (req, res) => {
  try {
    const { phone, biometric, passkey, commitment } = req.body;
    if (!phone || !biometric || !passkey || !commitment) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Generate ZK proof
    const proof = generateZkProof({ phone, biometric, passkey }, commitment);
    res.status(200).json(proof);
  } catch (error) {
    console.error('Generate ZK proof error:', error);
    res.status(500).json({ error: 'Failed to generate ZK proof' });
  }
});

/**
 * @route POST /api/zk/verify
 * @desc Verify a ZK proof
 * @access Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { proof, commitment } = req.body;
    if (!proof || !commitment) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Verify ZK proof
    const isValid = verifyZkProof(proof, commitment);
    res.status(200).json({ isValid });
  } catch (error) {
    console.error('Verify ZK proof error:', error);
    res.status(500).json({ error: 'Failed to verify ZK proof' });
  }
});

/**
 * @route POST /api/zk/login
 * @desc Login with ZK proof
 * @access Public
 */
router.post('/login', async (req, res) => {
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
    // Verify ZK proof
    const isValid = verifyZkProof(proof, commitment);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid ZK proof' });
    }
    // Check if commitment matches user's commitment
    if (user.zkCommitment !== commitment) {
      return res.status(401).json({ error: 'Commitment mismatch' });
    }
    res.status(200).json({ message: 'ZK login successful', userId: user.id });
  } catch (error) {
    console.error('ZK login error:', error);
    res.status(500).json({ error: 'Failed to login with ZK proof' });
  }
});

/**
 * @route GET /api/zk/user/:userId
 * @desc Get user's ZK commitment
 * @access Private
 */
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    // Check if user is authorized to access this user's commitment
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    // Find user by ID
    const user = await iagon.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ commitment: user.zkCommitment });
  } catch (error) {
    console.error('Get user commitment error:', error);
    res.status(500).json({ error: 'Failed to get user commitment' });
  }
});

export default router;