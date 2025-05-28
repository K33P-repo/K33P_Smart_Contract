// Authentication routes for K33P Identity System
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyToken, verifyZkProof } = require('../middleware/auth');
const { hashPhone, hashBiometric, hashPasskey } = require('../utils/hash');
const { generateZkCommitment, generateZkProof, verifyZkProof } = require('../utils/zk');
const { signupTxBuilder } = require('../utils/lucid');
const iagon = require('../utils/iagon');

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
    const token = jwt.sign(
      { id: user.id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    // Create session in Iagon
    await iagon.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) });
    res.status(201).json({ message: 'User registered successfully', txHash, token });
  } catch (error) {
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
    const token = jwt.sign(
      { id: user.id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
    // Create session in Iagon
    await iagon.createSession({ userId: user.id, token, expiresAt: new Date(Date.now() + parseInt(process.env.JWT_EXPIRATION || 86400) * 1000) });
    res.status(200).json({ message: 'Login successful', token });
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

module.exports = router;