/**
 * Response Helper Utilities for K33P Backend
 * Provides consistent response formatting and validation error handling
 */
import { validationResult } from 'express-validator';
import { ResponseUtils, ErrorCodes, K33PError } from '../middleware/error-handler.js';
/**
 * Handle validation errors from express-validator
 */
export const handleValidationErrorsMiddleware = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return ResponseUtils.validationError(res, errors.array());
    }
    next();
};
/**
 * Wrapper for async route handlers to catch errors
 */
export const asyncRoute = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
// Validation error handler
export function handleValidationErrors(errors) {
    const errorMessage = errors.map(err => err.msg || err.message).join(', ');
    throw new K33PError(ErrorCodes.VALIDATION_ERROR, errorMessage);
}
// Success response creator
export function createSuccessResponse(data, message) {
    return ResponseUtils.legacySuccess(data, message);
}
// Error response creator
export function createErrorResponse(code, message, details) {
    throw new K33PError(code, message, details);
}
// Specific scenario handlers
export function handleUserAlreadyExists(details) {
    throw new K33PError(ErrorCodes.USER_ALREADY_EXISTS, undefined, details);
}
export function handlePhoneAlreadyExists(details) {
    throw new K33PError(ErrorCodes.PHONE_ALREADY_EXISTS, undefined, details);
}
export function handleWalletAlreadyExists(details) {
    throw new K33PError(ErrorCodes.WALLET_ALREADY_EXISTS, undefined, details);
}
export function handleRefundFailed(details) {
    throw new K33PError(ErrorCodes.REFUND_FAILED, undefined, details);
}
/**
 * Check if user exists and handle common user-related errors
 */
export const checkUserExists = async (userLookupFn, identifier, identifierType = 'userId') => {
    try {
        const user = await userLookupFn(identifier);
        if (!user) {
            throw new K33PError(ErrorCodes.USER_NOT_FOUND);
        }
        return user;
    }
    catch (error) {
        if (error instanceof K33PError) {
            throw error;
        }
        throw new K33PError(ErrorCodes.DATABASE_ERROR, error);
    }
};
/**
 * Check for duplicate user registration
 */
export const checkDuplicateUser = async (userLookupFn, phoneNumber, walletAddress) => {
    try {
        // Check phone number
        if (phoneNumber) {
            const existingUserByPhone = await userLookupFn({ phoneNumber });
            if (existingUserByPhone) {
                throw new K33PError(ErrorCodes.PHONE_ALREADY_EXISTS);
            }
        }
        // Check wallet address
        if (walletAddress) {
            const existingUserByWallet = await userLookupFn({ walletAddress });
            if (existingUserByWallet) {
                throw new K33PError(ErrorCodes.WALLET_ADDRESS_IN_USE);
            }
        }
    }
    catch (error) {
        if (error instanceof K33PError) {
            throw error;
        }
        throw new K33PError(ErrorCodes.DATABASE_ERROR, error);
    }
};
/**
 * Check user signup and refund status
 */
export const checkUserStatus = async (user, checkRefundStatus = true) => {
    // Check if user already signed up
    if (user.signupCompleted || user.status === 'completed') {
        if (user.refundIssued || user.refundStatus === 'completed') {
            throw new K33PError(ErrorCodes.USER_ALREADY_SIGNED_UP);
        }
        else {
            throw new K33PError(ErrorCodes.USER_ALREADY_EXISTS);
        }
    }
    // Check if user is using account for second time
    if (user.loginCount && user.loginCount > 1) {
        throw new K33PError(ErrorCodes.USER_SECOND_TIME_USE);
    }
    // Check ADA deposit status
    if (checkRefundStatus && !user.adaDeposited && !user.depositVerified) {
        throw new K33PError(ErrorCodes.USER_NO_ADA_SENT);
    }
    // Check if refund already processed
    if (checkRefundStatus && user.refundIssued) {
        throw new K33PError(ErrorCodes.USER_ALREADY_REFUNDED);
    }
};
/**
 * Validate wallet address format
 */
export const validateWalletAddress = (walletAddress) => {
    // Basic Cardano address validation
    const cardanoAddressRegex = /^addr1[a-z0-9]{98}$|^addr_test1[a-z0-9]{98}$/;
    return cardanoAddressRegex.test(walletAddress);
};
/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phoneNumber) => {
    // International phone number format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
};
/**
 * Handle refund-specific errors
 */
export const handleRefundError = (error, user) => {
    if (error.message?.includes('insufficient funds')) {
        throw new K33PError(ErrorCodes.REFUND_FAILED, error, 'Insufficient funds in refund wallet. Our team has been notified.');
    }
    if (error.message?.includes('transaction failed')) {
        throw new K33PError(ErrorCodes.TRANSACTION_FAILED, error, 'Refund transaction failed. Please try again or contact support.');
    }
    if (error.message?.includes('already refunded')) {
        throw new K33PError(ErrorCodes.REFUND_ALREADY_PROCESSED);
    }
    // Generic refund error
    throw new K33PError(ErrorCodes.REFUND_FAILED, error, 'Refund processing failed. Our team has been notified and will resolve this issue.');
};
/**
 * Handle transaction verification errors
 */
export const handleTransactionError = (error) => {
    if (error.message?.includes('not found')) {
        throw new K33PError(ErrorCodes.DEPOSIT_VERIFICATION_FAILED, error, 'Transaction not found. Please ensure the transaction is confirmed on the blockchain.');
    }
    if (error.message?.includes('insufficient amount')) {
        throw new K33PError(ErrorCodes.DEPOSIT_VERIFICATION_FAILED, error, 'Insufficient deposit amount. Please send the required 2 ADA.');
    }
    throw new K33PError(ErrorCodes.DEPOSIT_VERIFICATION_FAILED, error, 'Could not verify your ADA deposit. Please ensure the transaction is confirmed.');
};
/**
 * Log user action for audit trail
 */
export const logUserAction = (userId, action, details, success = true) => {
    const logData = {
        userId,
        action,
        success,
        details,
        timestamp: new Date().toISOString(),
        ip: details?.ip,
        userAgent: details?.userAgent
    };
    if (success) {
        console.log(`✅ User Action: ${action}`, logData);
    }
    else {
        console.error(`❌ User Action Failed: ${action}`, logData);
    }
};
/**
 * Rate limiting error handler
 */
export const handleRateLimitError = (req, res) => {
    return ResponseUtils.error(res, ErrorCodes.RATE_LIMIT_EXCEEDED, {
        ip: req.ip,
        endpoint: req.path,
        method: req.method
    }, 'Too many requests. Please wait a moment and try again.');
};
/**
 * Database connection error handler
 */
export const handleDatabaseError = (error) => {
    console.error('🔴 Database Error:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    if (error.code === 'ECONNREFUSED') {
        throw new K33PError(ErrorCodes.DATABASE_ERROR, error, 'Database connection failed. Please try again later.');
    }
    if (error.code?.startsWith('23')) { // PostgreSQL constraint violations
        if (error.code === '23505') {
            throw new K33PError(ErrorCodes.USER_ALREADY_EXISTS, error, 'This information is already registered.');
        }
    }
    throw new K33PError(ErrorCodes.DATABASE_ERROR, error);
};
/**
 * External service error handler
 */
export const handleExternalServiceError = (serviceName, error) => {
    console.error(`🔴 ${serviceName} Service Error:`, {
        message: error.message,
        status: error.status,
        response: error.response?.data,
        timestamp: new Date().toISOString()
    });
    throw new K33PError(ErrorCodes.EXTERNAL_SERVICE_ERROR, error, `${serviceName} service is temporarily unavailable. Please try again later.`);
};
export default {
    handleValidationErrorsMiddleware,
    handleValidationErrors,
    createSuccessResponse,
    createErrorResponse,
    asyncRoute,
    checkUserExists,
    checkDuplicateUser,
    checkUserStatus,
    validateWalletAddress,
    validatePhoneNumber,
    handleRefundError,
    handleTransactionError,
    logUserAction,
    handleRateLimitError,
    handleDatabaseError,
    handleExternalServiceError,
    handleUserAlreadyExists,
    handlePhoneAlreadyExists,
    handleWalletAlreadyExists,
    handleRefundFailed
};
//# sourceMappingURL=response-helpers.js.map