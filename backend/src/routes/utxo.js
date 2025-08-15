// UTXO management routes for K33P Identity System
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { hashPhone } from '../utils/hash.js';
import { fetchUtxos, refundTx } from '../utils/lucid.js';
import * as iagon from '../utils/iagon.js';
import { K33PError, ErrorCodes, asyncHandler } from '../middleware/error-handler.js';
import { ResponseUtils } from '../utils/response-helpers.js';

const router = express.Router();

/**
 * @route GET /api/utxo/fetch/:phoneHash
 * @desc Fetch UTXOs at script address by phone hash
 * @access Private
 */
router.get('/fetch/:phoneHash', verifyToken, async (req, res) => {
  try {
    const { phoneHash } = req.params;
    if (!phoneHash) {
      return res.status(400).json({ error: 'Missing phone hash' });
    }
    // Fetch UTXOs at script address
    const utxos = await fetchUtxos(phoneHash);
    res.status(200).json(utxos);
  } catch (error) {
    console.error('Fetch UTXOs error:', error);
    res.status(500).json({ error: 'Failed to fetch UTXOs' });
  }
});

/**
 * @route POST /api/utxo/refund
 * @desc Issue a refund for a UTXO
 * @access Private
 */
router.post('/refund', verifyToken, asyncHandler(async (req, res) => {
  const { utxo, ownerAddress, zkProof } = req.body;
  
  if (!utxo || !ownerAddress) {
    throw new K33PError(ErrorCodes.VALIDATION_ERROR, 'Missing required fields: utxo and ownerAddress');
  }
  
  // Check if user is authorized to refund this UTXO
  const user = await iagon.findUserById(req.user.id);
  if (!user) {
    throw new K33PError(ErrorCodes.USER_NOT_FOUND, 'User not found');
  }
  
  // Verify that the UTXO belongs to the user
  const scriptUtxo = await iagon.findScriptUtxo({ txHash: utxo.txHash, outputIndex: utxo.outputIndex });
  if (!scriptUtxo || scriptUtxo.userId !== user.id) {
    throw new K33PError(ErrorCodes.UNAUTHORIZED, 'Unauthorized to refund this UTXO');
  }
  
  // Require ZK proof for refund
  if (!zkProof) {
    throw new K33PError(ErrorCodes.VALIDATION_ERROR, 'Missing ZK proof');
  }
  if (!zkProof.isValid) {
    throw new K33PError(ErrorCodes.INVALID_ZK_PROOF, 'Invalid ZK proof');
  }
  
  try {
    // Issue refund
    const txHash = await refundTx(ownerAddress, utxo);
    // Update UTXO status in Iagon
    await iagon.updateScriptUtxo(scriptUtxo.id, { refunded: true, refundTxHash: txHash });
    
    ResponseUtils.success(res, { txHash }, 'Refund issued successfully');
  } catch (error) {
    console.error('Refund transaction error:', error);
    throw new K33PError(ErrorCodes.REFUND_FAILED, 'Failed to process refund transaction');
  }
}));

/**
 * @route POST /api/utxo/track
 * @desc Track a new UTXO in the database
 * @access Private
 */
router.post('/track', verifyToken, async (req, res) => {
  try {
    const { txHash, outputIndex, datum } = req.body;
    if (!txHash || outputIndex === undefined || !datum) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Check if UTXO already exists
    const existingUtxo = await iagon.findScriptUtxo({ txHash, outputIndex });
    if (existingUtxo) {
      return res.status(409).json({ error: 'UTXO already tracked' });
    }
    // Create UTXO in Iagon
    const scriptUtxo = await iagon.createScriptUtxo({ txHash, outputIndex, datum: JSON.stringify(datum), userId: req.user.id, refunded: false });
    res.status(201).json({ message: 'UTXO tracked successfully', scriptUtxo });
  } catch (error) {
    console.error('Track UTXO error:', error);
    res.status(500).json({ error: 'Failed to track UTXO' });
  }
});

/**
 * @route GET /api/utxo/user
 * @desc Get all UTXOs for the current user
 * @access Private
 */
router.get('/user', verifyToken, async (req, res) => {
  try {
    // Get all UTXOs for the current user
    const utxos = await iagon.findScriptUtxos({ userId: req.user.id });
    res.status(200).json(utxos);
  } catch (error) {
    console.error('Get user UTXOs error:', error);
    res.status(500).json({ error: 'Failed to get user UTXOs' });
  }
});

/**
 * @route POST /api/utxo/deposit
 * @desc Create a new UTXO deposit
 * @access Private
 */
router.post('/deposit', verifyToken, async (req, res) => {
  try {
    const { amount, walletAddress, txHash, outputIndex } = req.body;
    
    if (!amount || !walletAddress) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: amount and walletAddress are required' 
      });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid amount: must be a positive number' 
      });
    }

    // Get user information
    const user = await iagon.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Create deposit record
    const deposit = {
      userId: req.user.id,
      amount: parseFloat(amount),
      walletAddress,
      txHash: txHash || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      outputIndex: outputIndex || 0,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Store deposit in Iagon (simulated)
    const depositRecord = await iagon.createScriptUtxo({
      txHash: deposit.txHash,
      outputIndex: deposit.outputIndex,
      datum: JSON.stringify(deposit),
      userId: req.user.id,
      refunded: false
    });

    res.status(201).json({ 
      success: true,
      message: 'Deposit created successfully',
      data: {
        depositId: depositRecord.id,
        txHash: deposit.txHash,
        amount: deposit.amount,
        status: deposit.status
      }
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create deposit' 
    });
  }
});

/**
 * @route GET /api/utxo/balance
 * @desc Get user's UTXO balance
 * @access Private
 */
router.get('/balance', verifyToken, async (req, res) => {
  try {
    // Get all UTXOs for the current user
    const utxos = await iagon.findScriptUtxos({ userId: req.user.id });
    
    // Calculate total balance
    let totalBalance = 0;
    let availableBalance = 0;
    let pendingBalance = 0;
    
    utxos.forEach(utxo => {
      try {
        const datum = JSON.parse(utxo.datum || '{}');
        const amount = parseFloat(datum.amount || 0);
        
        totalBalance += amount;
        
        if (utxo.refunded) {
          // Already refunded, don't count as available
        } else if (datum.status === 'pending') {
          pendingBalance += amount;
        } else {
          availableBalance += amount;
        }
      } catch (parseError) {
        console.warn('Failed to parse UTXO datum:', parseError);
      }
    });

    res.status(200).json({ 
      success: true,
      data: {
        totalBalance: totalBalance.toFixed(6),
        availableBalance: availableBalance.toFixed(6),
        pendingBalance: pendingBalance.toFixed(6),
        utxoCount: utxos.length
      }
    });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get balance' 
    });
  }
});

/**
 * @route POST /api/utxo/history
 * @desc Get UTXO transaction history
 * @access Private
 */
router.post('/history', verifyToken, async (req, res) => {
  try {
    const { walletAddress, limit = 10, offset = 0 } = req.body;
    
    // Get user's UTXOs
    const utxos = await iagon.findScriptUtxos({ userId: req.user.id });
    
    // Filter by wallet address if provided
    let filteredUtxos = utxos;
    if (walletAddress) {
      filteredUtxos = utxos.filter(utxo => {
        try {
          const datum = JSON.parse(utxo.datum || '{}');
          return datum.walletAddress === walletAddress;
        } catch {
          return false;
        }
      });
    }
    
    // Sort by creation date (newest first)
    filteredUtxos.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    
    // Apply pagination
    const paginatedUtxos = filteredUtxos.slice(offset, offset + limit);
    
    // Format response
    const history = paginatedUtxos.map(utxo => {
      try {
        const datum = JSON.parse(utxo.datum || '{}');
        return {
          id: utxo.id,
          txHash: utxo.txHash,
          outputIndex: utxo.outputIndex,
          amount: datum.amount || 0,
          walletAddress: datum.walletAddress,
          status: datum.status || 'unknown',
          refunded: utxo.refunded,
          refundTxHash: utxo.refundTxHash,
          createdAt: utxo.createdAt,
          updatedAt: utxo.updatedAt
        };
      } catch {
        return {
          id: utxo.id,
          txHash: utxo.txHash,
          outputIndex: utxo.outputIndex,
          amount: 0,
          status: 'unknown',
          refunded: utxo.refunded,
          createdAt: utxo.createdAt
        };
      }
    });

    res.status(200).json({ 
      success: true,
      data: {
        history,
        pagination: {
          total: filteredUtxos.length,
          limit,
          offset,
          hasMore: offset + limit < filteredUtxos.length
        }
      }
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get transaction history' 
    });
  }
});

export default router;