/**
 * Phone Number Management Routes for K33P Backend
 * Handles phone number changes and account recovery strategies
 * Supports both onchain and offchain verification methods
 */
import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Pool } from 'pg';
import { EnhancedK33PManagerDB } from '../enhanced-k33p-manager-db';
import crypto from 'crypto';
import { dbService } from '../database/service';
const router = express.Router();
const pool = new Pool();
const k33pManager = new EnhancedK33PManagerDB();
// ============================================================================
// IN-MEMORY STORAGE (Replace with Redis in production)
// ============================================================================
const phoneChangeRequests = new Map();
const recoveryRequests = new Map();
const otpStorage = new Map();
// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================
const validatePhoneChange = [
    body('newPhoneNumber')
        .isMobilePhone('any')
        .withMessage('Valid phone number is required'),
    body('verificationMethod')
        .isIn(['onchain', 'offchain'])
        .withMessage('Verification method must be onchain or offchain'),
    body('currentPin')
        .isLength({ min: 4, max: 6 })
        .isNumeric()
        .withMessage('Current PIN must be 4-6 digits')
];
const validateRecovery = [
    body('newPhoneNumber')
        .isMobilePhone('any')
        .withMessage('Valid phone number is required'),
    body('recoveryMethod')
        .isIn(['emergency_contact', 'backup_phrase', 'onchain_proof', 'multi_factor'])
        .withMessage('Invalid recovery method'),
    body('verificationData')
        .isObject()
        .withMessage('Verification data is required')
];
const validateOTP = [
    body('otp')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('OTP must be 6 digits'),
    body('requestId')
        .isUUID()
        .withMessage('Valid request ID is required')
];
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
const generateRequestId = () => {
    return crypto.randomUUID();
};
const hashPhone = (phoneNumber) => {
    return crypto.createHash('sha256').update(phoneNumber + process.env.PHONE_SALT || 'default-salt').digest('hex');
};
const verifyPin = async (userId, pin) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT auth_hash FROM auth_data WHERE user_id = $1 AND auth_type = $2 AND is_active = true', [userId, 'pin']);
        client.release();
        if (result.rows.length === 0)
            return false;
        const hashedPin = crypto.createHash('sha256').update(pin + process.env.PIN_SALT || 'default-salt').digest('hex');
        return result.rows[0].auth_hash === hashedPin;
    }
    catch (error) {
        logger.error('Error verifying PIN:', error);
        return false;
    }
};
const sendOTPSMS = async (phoneNumber, otp) => {
    // TODO: Implement SMS service integration (Twilio, AWS SNS, etc.)
    logger.info(`Sending OTP ${otp} to ${phoneNumber}`);
    return true;
};
const sendRecoveryEmail = async (email, recoveryData) => {
    // TODO: Implement email service integration
    logger.info(`Sending recovery email to ${email}`);
    return true;
};
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            error: 'VALIDATION_ERROR',
            details: errors.array()
        });
    }
    next();
};
const handleAsyncRoute = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
// ============================================================================
// PHONE NUMBER CHANGE ROUTES
// ============================================================================
/**
 * POST /api/phone/change/request
 * Request phone number change with verification method selection
 */
router.post('/change/request', authenticateToken, validatePhoneChange, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { newPhoneNumber, verificationMethod, currentPin } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
                error: 'UNAUTHORIZED'
            });
        }
        logger.info(`Phone change request for user: ${userId}`);
        // Verify current PIN
        const pinValid = await verifyPin(userId, currentPin);
        if (!pinValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid current PIN',
                error: 'INVALID_PIN'
            });
        }
        // Get current user data
        const user = await dbService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        // Check if new phone number is already in use
        const newPhoneHash = hashPhone(newPhoneNumber);
        const client = await pool.connect();
        const existingUser = await client.query('SELECT user_id FROM users WHERE phone_hash = $1 AND user_id != $2', [newPhoneHash, userId]);
        client.release();
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already in use',
                error: 'PHONE_EXISTS'
            });
        }
        const requestId = generateRequestId();
        const changeRequest = {
            userId,
            currentPhoneHash: user.phone_hash || '',
            newPhoneNumber,
            verificationMethod,
            timestamp: new Date(),
            status: 'pending'
        };
        phoneChangeRequests.set(requestId, changeRequest);
        if (verificationMethod === 'offchain') {
            // Send OTP to new phone number
            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            otpStorage.set(requestId, { otp, expiresAt, attempts: 0 });
            await sendOTPSMS(newPhoneNumber, otp);
            res.json({
                success: true,
                message: 'OTP sent to new phone number',
                data: {
                    requestId,
                    verificationMethod: 'offchain',
                    expiresAt
                }
            });
        }
        else {
            // Onchain verification - provide deposit address
            const depositAddress = process.env.DEPOSIT_ADDRESS || 'addr_test1...';
            const requiredAmount = '2000000'; // 2 ADA in lovelace
            res.json({
                success: true,
                message: 'Send transaction to verify phone change',
                data: {
                    requestId,
                    verificationMethod: 'onchain',
                    depositAddress,
                    requiredAmount,
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
                }
            });
        }
    }
    catch (error) {
        logger.error('Error requesting phone change:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to request phone change',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/phone/change/verify-otp
 * Verify OTP for offchain phone number change
 */
router.post('/change/verify-otp', authenticateToken, validateOTP, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { otp, requestId } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
                error: 'UNAUTHORIZED'
            });
        }
        const changeRequest = phoneChangeRequests.get(requestId);
        if (!changeRequest || changeRequest.userId !== userId) {
            return res.status(404).json({
                success: false,
                message: 'Invalid request ID',
                error: 'INVALID_REQUEST'
            });
        }
        const storedOTP = otpStorage.get(requestId);
        if (!storedOTP) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired or not found',
                error: 'OTP_EXPIRED'
            });
        }
        if (storedOTP.expiresAt < new Date()) {
            otpStorage.delete(requestId);
            return res.status(400).json({
                success: false,
                message: 'OTP expired',
                error: 'OTP_EXPIRED'
            });
        }
        storedOTP.attempts++;
        if (storedOTP.attempts > 3) {
            otpStorage.delete(requestId);
            phoneChangeRequests.delete(requestId);
            return res.status(400).json({
                success: false,
                message: 'Too many attempts',
                error: 'TOO_MANY_ATTEMPTS'
            });
        }
        if (storedOTP.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP',
                error: 'INVALID_OTP'
            });
        }
        // OTP verified, update phone number
        const newPhoneHash = hashPhone(changeRequest.newPhoneNumber);
        const updatedUser = await dbService.updateUser(userId, {
            phone_hash: newPhoneHash,
            updated_at: new Date()
        });
        if (!updatedUser) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update phone number',
                error: 'UPDATE_FAILED'
            });
        }
        // Clean up
        otpStorage.delete(requestId);
        changeRequest.status = 'completed';
        phoneChangeRequests.set(requestId, changeRequest);
        // Log the change
        logger.info(`Phone number changed successfully for user: ${userId}`);
        res.json({
            success: true,
            message: 'Phone number changed successfully',
            data: {
                userId,
                newPhoneHash,
                timestamp: new Date()
            }
        });
    }
    catch (error) {
        logger.error('Error verifying OTP for phone change:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/phone/change/verify-onchain
 * Verify onchain transaction for phone number change
 */
router.post('/change/verify-onchain', authenticateToken, body('requestId').isUUID().withMessage('Valid request ID is required'), body('txHash').isLength({ min: 64, max: 64 }).withMessage('Valid transaction hash is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { requestId, txHash } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
                error: 'UNAUTHORIZED'
            });
        }
        const changeRequest = phoneChangeRequests.get(requestId);
        if (!changeRequest || changeRequest.userId !== userId) {
            return res.status(404).json({
                success: false,
                message: 'Invalid request ID',
                error: 'INVALID_REQUEST'
            });
        }
        // Get user wallet address for verification
        const user = await dbService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        // Verify transaction using K33P manager
        const verificationResult = await k33pManager.verifyTransactionByWalletAddress(user.wallet_address, 2000000n // 2 ADA
        );
        if (!verificationResult.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Transaction verification failed',
                error: 'INVALID_TRANSACTION',
                details: verificationResult.error
            });
        }
        // Update phone number
        const newPhoneHash = hashPhone(changeRequest.newPhoneNumber);
        const updatedUser = await dbService.updateUser(userId, {
            phone_hash: newPhoneHash,
            updated_at: new Date()
        });
        if (!updatedUser) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update phone number',
                error: 'UPDATE_FAILED'
            });
        }
        // Update request status
        changeRequest.status = 'completed';
        changeRequest.txHash = txHash;
        phoneChangeRequests.set(requestId, changeRequest);
        // Log the change
        logger.info(`Phone number changed successfully via onchain for user: ${userId}`);
        res.json({
            success: true,
            message: 'Phone number changed successfully via blockchain verification',
            data: {
                userId,
                newPhoneHash,
                txHash,
                timestamp: new Date()
            }
        });
    }
    catch (error) {
        logger.error('Error verifying onchain phone change:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify onchain transaction',
            error: 'SERVER_ERROR'
        });
    }
}));
export default router;
//# sourceMappingURL=phone-management.js.map