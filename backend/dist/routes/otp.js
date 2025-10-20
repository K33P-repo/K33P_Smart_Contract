// otp.ts - OTP Authentication Routes
import express from 'express';
import { body, validationResult } from 'express-validator';
import { sendOtp, verifyOtp, cancelVerification } from '../utils/twilio.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { ResponseUtils, ErrorCodes } from '../middleware/error-handler.js';
import pool from '../database/config.js';
import { hashPhone } from '../utils/hash.js';
const router = express.Router();
// Helper function to create standardized API responses
const createResponse = (success, data, message, error) => {
    return {
        success,
        data,
        message,
        error,
        timestamp: new Date().toISOString()
    };
};
// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, `Validation errors: ${errors.array().map((e) => e.msg).join(', ')}`);
    }
    next();
};
/**
 * Send OTP to a phone number
 * POST /api/otp/send
 */
router.post('/send', createRateLimiter({ windowMs: 5 * 60 * 1000, max: 3 }), // 3 requests per 5 minutes
[
    body('phoneNumber')
        .isLength({ min: 10 })
        .withMessage('Phone number must be at least 10 characters')
        .trim()
], handleValidationErrors, async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        console.log(`Sending OTP to ${phoneNumber}`);
        const result = await sendOtp(phoneNumber);
        if (result.success) {
            res.json(createResponse(true, { requestId: result.requestId }, 'Verification code sent'));
        }
        else {
            return ResponseUtils.error(res, ErrorCodes.OTP_SEND_FAILED, null, result.error);
        }
    }
    catch (error) {
        console.error('Error sending OTP:', error);
        return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to send verification code');
    }
});
/**
 * Verify OTP code
 * POST /api/otp/verify
 */
router.post('/verify', createRateLimiter({ windowMs: 5 * 60 * 1000, max: 10 }), // 10 requests per 5 minutes
[
    body('requestId')
        .isString()
        .withMessage('Request ID is required')
        .trim(),
    body('code')
        .isLength({ min: 4, max: 6 })
        .withMessage('Verification code must be 4-6 digits')
        .trim(),
    body('phoneNumber')
        .optional()
        .isString()
        .withMessage('Phone number must be a string')
        .trim()
], handleValidationErrors, async (req, res) => {
    try {
        const { requestId, code, phoneNumber } = req.body;
        console.log(`Verifying OTP for request ${requestId}`);
        const result = await verifyOtp(requestId, code);
        if (result.success) {
            let authMethod = null;
            // If phone number is provided, try to get user's authentication method
            if (phoneNumber) {
                const client = await pool.connect();
                try {
                    const phoneHash = hashPhone(phoneNumber);
                    const userQuery = await client.query(`SELECT ud.verification_method as "verificationMethod", 
                    ud.biometric_type as "biometricType",
                    u.pin
             FROM users u 
             LEFT JOIN user_deposits ud ON u.user_id = ud.user_id 
             WHERE u.phone_hash = $1`, [phoneHash]);
                    if (userQuery.rows.length > 0) {
                        const user = userQuery.rows[0];
                        authMethod = {
                            verificationMethod: user.verificationMethod,
                            biometricType: user.biometricType,
                            hasPIN: !!user.pin
                        };
                    }
                }
                catch (dbError) {
                    console.error('Error querying user auth method:', dbError);
                    // Don't fail the OTP verification if we can't get auth method
                }
                finally {
                    client.release();
                }
            }
            const responseData = { verified: true };
            if (authMethod) {
                responseData.authMethod = authMethod;
            }
            res.json(createResponse(true, responseData, 'Phone number verified successfully'));
        }
        else {
            return ResponseUtils.error(res, ErrorCodes.OTP_VERIFICATION_FAILED, null, result.error);
        }
    }
    catch (error) {
        console.error('Error verifying OTP:', error);
        return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to verify code');
    }
});
/**
 * Cancel an ongoing verification
 * POST /api/otp/cancel
 */
router.post('/cancel', [
    body('requestId')
        .isString()
        .withMessage('Request ID is required')
        .trim()
], handleValidationErrors, async (req, res) => {
    try {
        const { requestId } = req.body;
        console.log(`Cancelling OTP request ${requestId}`);
        const result = await cancelVerification(requestId);
        if (result.success) {
            res.json(createResponse(true, undefined, 'Verification cancelled successfully'));
        }
        else {
            return ResponseUtils.error(res, ErrorCodes.OTP_CANCELLATION_FAILED, null, result.error);
        }
    }
    catch (error) {
        console.error('Error cancelling verification:', error);
        return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to cancel verification');
    }
});
export default router;
//# sourceMappingURL=otp.js.map