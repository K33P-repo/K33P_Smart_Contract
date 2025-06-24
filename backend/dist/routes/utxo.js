// UTXO management routes for K33P Identity System
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { hashPhone } from '../utils/hash.js';
import { fetchUtxos, refundTx } from '../utils/lucid.js';
import * as iagon from '../utils/iagon.js';
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
    }
    catch (error) {
        console.error('Fetch UTXOs error:', error);
        res.status(500).json({ error: 'Failed to fetch UTXOs' });
    }
});
/**
 * @route POST /api/utxo/refund
 * @desc Issue a refund for a UTXO
 * @access Private
 */
router.post('/refund', verifyToken, async (req, res) => {
    try {
        const { utxo, ownerAddress, zkProof } = req.body;
        if (!utxo || !ownerAddress) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check if user is authorized to refund this UTXO
        const user = await iagon.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Verify that the UTXO belongs to the user
        const scriptUtxo = await iagon.findScriptUtxo({ txHash: utxo.txHash, outputIndex: utxo.outputIndex });
        if (!scriptUtxo || scriptUtxo.userId !== user.id) {
            return res.status(403).json({ error: 'Unauthorized to refund this UTXO' });
        }
        // Require ZK proof for refund
        if (!zkProof) {
            return res.status(400).json({ error: 'Missing ZK proof' });
        }
        if (!zkProof.isValid) {
            return res.status(400).json({ error: 'Invalid ZK proof' });
        }
        // Issue refund
        const txHash = await refundTx(ownerAddress, utxo);
        // Update UTXO status in Iagon
        await iagon.updateScriptUtxo(scriptUtxo.id, { refunded: true, refundTxHash: txHash });
        res.status(200).json({ message: 'Refund issued successfully', txHash });
    }
    catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ error: 'Failed to issue refund' });
    }
});
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('Get user UTXOs error:', error);
        res.status(500).json({ error: 'Failed to get user UTXOs' });
    }
});
export default router;
//# sourceMappingURL=utxo.js.map