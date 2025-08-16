/**
 * Centralized Error Handling Middleware for K33P Backend
 * Provides consistent error responses and logging across all endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Success codes enum for consistent success responses
export enum SuccessCodes {
  // Authentication & Authorization
  AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGOUT_SUCCESS = 'AUTH_LOGOUT_SUCCESS',
  AUTH_TOKEN_VERIFIED = 'AUTH_TOKEN_VERIFIED',
  TOKEN_VERIFIED = 'TOKEN_VERIFIED',
  
  // User Management
  USER_CREATED = 'USER_CREATED',
  USER_RETRIEVED = 'USER_RETRIEVED',
  USER_UPDATED = 'USER_UPDATED',
  
  // Phone & Wallet
  PHONE_VERIFIED = 'PHONE_VERIFIED',
  WALLET_CONNECTED = 'WALLET_CONNECTED',
  WALLET_VERIFIED = 'WALLET_VERIFIED',
  WALLET_RETRIEVED = 'WALLET_RETRIEVED',
  
  // OTP & Verification
  OTP_SENT = 'OTP_SENT',
  OTP_VERIFIED = 'OTP_VERIFIED',
  
  // Biometric & PIN
  PIN_SETUP_SUCCESS = 'PIN_SETUP_SUCCESS',
  PIN_VERIFIED = 'PIN_VERIFIED',
  BIOMETRIC_SETUP_SUCCESS = 'BIOMETRIC_SETUP_SUCCESS',
  BIOMETRIC_VERIFIED = 'BIOMETRIC_VERIFIED',
  
  // Username & Session
  USERNAME_SET = 'USERNAME_SET',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_RETRIEVED = 'SESSION_RETRIEVED',
  
  // Zero-Knowledge Proof
  ZK_PROOF_VERIFIED = 'ZK_PROOF_VERIFIED',
  ZK_COMMITMENT_CREATED = 'ZK_COMMITMENT_CREATED',
  
  // Transaction & Refund
  TRANSACTION_SUCCESS = 'TRANSACTION_SUCCESS',
  DEPOSIT_VERIFIED = 'DEPOSIT_VERIFIED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  
  // General Operations
  OPERATION_SUCCESS = 'OPERATION_SUCCESS',
  DATA_RETRIEVED = 'DATA_RETRIEVED',
  DATA_CREATED = 'DATA_CREATED',
  DATA_UPDATED = 'DATA_UPDATED'
}

// Error codes enum for consistency
export enum ErrorCodes {
  // Authentication & Authorization
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  TOKEN_REQUIRED = 'TOKEN_REQUIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INVALID_TOKEN = 'INVALID_TOKEN',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // User Management
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_ALREADY_SIGNED_UP = 'USER_ALREADY_SIGNED_UP',
  USER_ALREADY_REFUNDED = 'USER_ALREADY_REFUNDED',
  USER_NO_ADA_SENT = 'USER_NO_ADA_SENT',
  USER_SECOND_TIME_USE = 'USER_SECOND_TIME_USE',
  USER_CREATION_FAILED = 'USER_CREATION_FAILED',
  
  // Phone & Wallet
  PHONE_ALREADY_EXISTS = 'PHONE_ALREADY_EXISTS',
  PHONE_INVALID_FORMAT = 'PHONE_INVALID_FORMAT',
  PHONE_REQUIRED = 'PHONE_REQUIRED',
  WALLET_ALREADY_EXISTS = 'WALLET_ALREADY_EXISTS',
  WALLET_ADDRESS_IN_USE = 'WALLET_ADDRESS_IN_USE',
  WALLET_ADDRESS_INVALID = 'WALLET_ADDRESS_INVALID',
  WALLET_ADDRESS_REQUIRED = 'WALLET_ADDRESS_REQUIRED',
  WALLET_ADDRESS_NOT_FOUND = 'WALLET_ADDRESS_NOT_FOUND',
  WALLET_IN_USE = 'WALLET_IN_USE',
  
  // OTP & Verification
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_INVALID = 'OTP_INVALID',
  OTP_SEND_FAILED = 'OTP_SEND_FAILED',
  OTP_VERIFICATION_FAILED = 'OTP_VERIFICATION_FAILED',
  OTP_CANCELLATION_FAILED = 'OTP_CANCELLATION_FAILED',
  OTP_REQUEST_ID_REQUIRED = 'OTP_REQUEST_ID_REQUIRED',
  OTP_CODE_REQUIRED = 'OTP_CODE_REQUIRED',
  OTP_CODE_INVALID_FORMAT = 'OTP_CODE_INVALID_FORMAT',
  
  // Biometric & PIN
  BIOMETRIC_VERIFICATION_FAILED = 'BIOMETRIC_VERIFICATION_FAILED',
  BIOMETRIC_NOT_ENROLLED = 'BIOMETRIC_NOT_ENROLLED',
  BIOMETRIC_DATA_REQUIRED = 'BIOMETRIC_DATA_REQUIRED',
  PIN_INVALID = 'PIN_INVALID',
  PIN_SETUP_FAILED = 'PIN_SETUP_FAILED',
  PIN_REQUIRED = 'PIN_REQUIRED',
  PIN_INVALID_FORMAT = 'PIN_INVALID_FORMAT',
  PIN_NOT_FOUND = 'PIN_NOT_FOUND',
  
  // Username & Session
  USERNAME_REQUIRED = 'USERNAME_REQUIRED',
  USERNAME_ALREADY_EXISTS = 'USERNAME_ALREADY_EXISTS',
  USERNAME_INVALID_FORMAT = 'USERNAME_INVALID_FORMAT',
  SESSION_ID_REQUIRED = 'SESSION_ID_REQUIRED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID = 'SESSION_INVALID',
  INVALID_SESSION = 'INVALID_SESSION',
  INVALID_FLOW = 'INVALID_FLOW',
  
  // ZK Proofs
  ZK_PROOF_INVALID = 'ZK_PROOF_INVALID',
  ZK_PROOF_GENERATION_FAILED = 'ZK_PROOF_GENERATION_FAILED',
  ZK_COMMITMENT_INVALID = 'ZK_COMMITMENT_INVALID',
  ZK_PROOF_REQUIRED = 'ZK_PROOF_REQUIRED',
  ZK_COMMITMENT_REQUIRED = 'ZK_COMMITMENT_REQUIRED',
  
  // Transactions & Refunds
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  REFUND_FAILED = 'REFUND_FAILED',
  REFUND_ALREADY_PROCESSED = 'REFUND_ALREADY_PROCESSED',
  REFUND_NOT_ELIGIBLE = 'REFUND_NOT_ELIGIBLE',
  DEPOSIT_VERIFICATION_FAILED = 'DEPOSIT_VERIFICATION_FAILED',
  DEPOSIT_NOT_FOUND = 'DEPOSIT_NOT_FOUND',
  USER_UPDATE_FAILED = 'USER_UPDATE_FAILED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  IDENTIFIER_REQUIRED = 'IDENTIFIER_REQUIRED',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server Errors
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Storage & Seed Phrases
  SEED_PHRASE_NOT_FOUND = 'SEED_PHRASE_NOT_FOUND',
  SEED_PHRASE_ENCRYPTION_FAILED = 'SEED_PHRASE_ENCRYPTION_FAILED',
  STORAGE_SERVICE_ERROR = 'STORAGE_SERVICE_ERROR'
}

// User-friendly error messages
const ERROR_MESSAGES: Record<ErrorCodes, string> = {
  // Authentication & Authorization
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again',
  [ErrorCodes.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCodes.AUTH_TOKEN_MISSING]: 'Authentication required',
  [ErrorCodes.TOKEN_REQUIRED]: 'Authentication token is required',
  [ErrorCodes.TOKEN_INVALID]: 'Invalid or expired token',
  [ErrorCodes.INVALID_TOKEN]: 'Invalid authentication token',
  [ErrorCodes.ACCESS_DENIED]: 'Access denied. Insufficient permissions',
  
  // User Management
  [ErrorCodes.USER_NOT_FOUND]: 'User account not found',
  [ErrorCodes.USER_ALREADY_EXISTS]: 'An account with this information already exists',
  [ErrorCodes.USER_ALREADY_SIGNED_UP]: 'You have already completed the signup process and a refund has been issued',
  [ErrorCodes.USER_ALREADY_REFUNDED]: 'A refund has already been processed for this account',
  [ErrorCodes.USER_NO_ADA_SENT]: 'No ADA deposit found for this account. Please send the required deposit first',
  [ErrorCodes.USER_SECOND_TIME_USE]: 'This account has been used before. Each account can only be used once',
  [ErrorCodes.USER_CREATION_FAILED]: 'Failed to create user account. Please try again',
  
  // Phone & Wallet
  [ErrorCodes.PHONE_ALREADY_EXISTS]: 'This phone number is already registered with another account',
  [ErrorCodes.PHONE_INVALID_FORMAT]: 'Please enter a valid phone number',
  [ErrorCodes.PHONE_REQUIRED]: 'Phone number is required',
  [ErrorCodes.WALLET_ALREADY_EXISTS]: 'This wallet is already registered with another account',
  [ErrorCodes.WALLET_ADDRESS_IN_USE]: 'This wallet address is already associated with another account',
  [ErrorCodes.WALLET_ADDRESS_INVALID]: 'Please enter a valid Cardano wallet address',
  [ErrorCodes.WALLET_ADDRESS_REQUIRED]: 'Wallet address is required',
  [ErrorCodes.WALLET_ADDRESS_NOT_FOUND]: 'No wallet address found for this account',
  [ErrorCodes.WALLET_IN_USE]: 'This wallet address is already in use',
  
  // OTP & Verification
  [ErrorCodes.OTP_EXPIRED]: 'Verification code has expired. Please request a new one',
  [ErrorCodes.OTP_INVALID]: 'Invalid verification code. Please try again',
  [ErrorCodes.OTP_SEND_FAILED]: 'Failed to send verification code. Please try again',
  [ErrorCodes.OTP_VERIFICATION_FAILED]: 'OTP verification failed. Please try again',
  [ErrorCodes.OTP_CANCELLATION_FAILED]: 'Failed to cancel OTP request. Please try again',
  [ErrorCodes.OTP_REQUEST_ID_REQUIRED]: 'OTP request ID is required',
  [ErrorCodes.OTP_CODE_REQUIRED]: 'OTP code is required',
  [ErrorCodes.OTP_CODE_INVALID_FORMAT]: 'OTP code must be exactly 5 digits',
  
  // Biometric & PIN
  [ErrorCodes.BIOMETRIC_VERIFICATION_FAILED]: 'Biometric verification failed. Please try again',
  [ErrorCodes.BIOMETRIC_NOT_ENROLLED]: 'Biometric authentication is not set up for your account',
  [ErrorCodes.BIOMETRIC_DATA_REQUIRED]: 'Biometric data is required for this verification method',
  [ErrorCodes.PIN_INVALID]: 'Incorrect PIN. Please try again',
  [ErrorCodes.PIN_SETUP_FAILED]: 'Failed to set up PIN. Please try again',
  [ErrorCodes.PIN_REQUIRED]: 'PIN is required',
  [ErrorCodes.PIN_INVALID_FORMAT]: 'PIN must be exactly 4 digits',
  [ErrorCodes.PIN_NOT_FOUND]: 'No PIN found for this user. Please contact support',
  
  // Username & Session
  [ErrorCodes.USERNAME_REQUIRED]: 'Username is required',
  [ErrorCodes.USERNAME_ALREADY_EXISTS]: 'This username is already taken. Please choose another',
  [ErrorCodes.USERNAME_INVALID_FORMAT]: 'Username format is invalid',
  [ErrorCodes.SESSION_ID_REQUIRED]: 'Session ID is required',
  [ErrorCodes.SESSION_NOT_FOUND]: 'Session not found or expired',
  [ErrorCodes.SESSION_INVALID]: 'Invalid session',
  [ErrorCodes.INVALID_SESSION]: 'Invalid or expired session',
  [ErrorCodes.INVALID_FLOW]: 'Invalid operation flow. Please follow the correct sequence',
  
  // ZK Proofs
  [ErrorCodes.ZK_PROOF_INVALID]: 'Invalid zero-knowledge proof',
  [ErrorCodes.ZK_PROOF_GENERATION_FAILED]: 'Failed to generate zero-knowledge proof',
  [ErrorCodes.ZK_COMMITMENT_INVALID]: 'Invalid zero-knowledge commitment',
  [ErrorCodes.ZK_PROOF_REQUIRED]: 'Zero-knowledge proof is required',
  [ErrorCodes.ZK_COMMITMENT_REQUIRED]: 'Zero-knowledge commitment is required',
  
  // Transactions & Refunds
  [ErrorCodes.TRANSACTION_FAILED]: 'Transaction failed. Please try again',
  [ErrorCodes.TRANSACTION_NOT_FOUND]: 'No valid transaction found',
  [ErrorCodes.REFUND_FAILED]: 'Refund processing failed. Our team has been notified and will resolve this issue',
  [ErrorCodes.REFUND_ALREADY_PROCESSED]: 'A refund has already been processed for this transaction',
  [ErrorCodes.REFUND_NOT_ELIGIBLE]: 'This transaction is not eligible for a refund',
  [ErrorCodes.DEPOSIT_VERIFICATION_FAILED]: 'Could not verify your ADA deposit. Please ensure the transaction is confirmed',
  [ErrorCodes.DEPOSIT_NOT_FOUND]: 'No valid deposit found',
  [ErrorCodes.USER_UPDATE_FAILED]: 'Failed to update user information',
  
  // Validation
  [ErrorCodes.VALIDATION_ERROR]: 'Please check your input and try again',
  [ErrorCodes.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCodes.MISSING_REQUIRED_FIELDS]: 'Please fill in all required fields',
  [ErrorCodes.IDENTIFIER_REQUIRED]: 'User identifier is required',
  [ErrorCodes.DUPLICATE_ENTRY]: 'This entry already exists',
  
  // Rate Limiting
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment and try again',
  
  // Server Errors
  [ErrorCodes.SERVER_ERROR]: 'Something went wrong on our end. Please try again later',
  [ErrorCodes.DATABASE_ERROR]: 'Database connection error. Please try again later',
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 'External service temporarily unavailable. Please try again later',
  
  // Storage & Seed Phrases
  [ErrorCodes.SEED_PHRASE_NOT_FOUND]: 'Seed phrase not found',
  [ErrorCodes.SEED_PHRASE_ENCRYPTION_FAILED]: 'Failed to encrypt seed phrase',
  [ErrorCodes.STORAGE_SERVICE_ERROR]: 'Storage service error. Please try again later'
};

// Success messages mapping
const SUCCESS_MESSAGES: Record<SuccessCodes, string> = {
  // Authentication & Authorization
  [SuccessCodes.AUTH_LOGIN_SUCCESS]: 'Login successful',
  [SuccessCodes.AUTH_LOGOUT_SUCCESS]: 'Logout successful',
  [SuccessCodes.AUTH_TOKEN_VERIFIED]: 'Token verified successfully',
  [SuccessCodes.TOKEN_VERIFIED]: 'Token verified successfully',
  
  // User Management
  [SuccessCodes.USER_CREATED]: 'User account created successfully',
  [SuccessCodes.USER_RETRIEVED]: 'User information retrieved successfully',
  [SuccessCodes.USER_UPDATED]: 'User information updated successfully',
  
  // Phone & Wallet
  [SuccessCodes.PHONE_VERIFIED]: 'Phone number verified successfully',
  [SuccessCodes.WALLET_CONNECTED]: 'Wallet connected successfully',
  [SuccessCodes.WALLET_VERIFIED]: 'Wallet verified successfully',
  [SuccessCodes.WALLET_RETRIEVED]: 'Wallet information retrieved successfully',
  
  // OTP & Verification
  [SuccessCodes.OTP_SENT]: 'Verification code sent successfully',
  [SuccessCodes.OTP_VERIFIED]: 'Verification code verified successfully',
  
  // Biometric & PIN
  [SuccessCodes.PIN_SETUP_SUCCESS]: 'PIN setup completed successfully',
  [SuccessCodes.PIN_VERIFIED]: 'PIN verified successfully',
  [SuccessCodes.BIOMETRIC_SETUP_SUCCESS]: 'Biometric authentication setup completed successfully',
  [SuccessCodes.BIOMETRIC_VERIFIED]: 'Biometric verification successful',
  
  // Username & Session
  [SuccessCodes.USERNAME_SET]: 'Username set successfully',
  [SuccessCodes.SESSION_CREATED]: 'Session created successfully',
  [SuccessCodes.SESSION_RETRIEVED]: 'Session information retrieved successfully',
  
  // Zero-Knowledge Proof
  [SuccessCodes.ZK_PROOF_VERIFIED]: 'Zero-knowledge proof verified successfully',
  [SuccessCodes.ZK_COMMITMENT_CREATED]: 'Zero-knowledge commitment created successfully',
  
  // Transaction & Refund
  [SuccessCodes.TRANSACTION_SUCCESS]: 'Transaction completed successfully',
  [SuccessCodes.DEPOSIT_VERIFIED]: 'Deposit verified successfully',
  [SuccessCodes.REFUND_PROCESSED]: 'Refund processed successfully',
  
  // General Operations
  [SuccessCodes.OPERATION_SUCCESS]: 'Operation completed successfully',
  [SuccessCodes.DATA_RETRIEVED]: 'Data retrieved successfully',
  [SuccessCodes.DATA_CREATED]: 'Data created successfully',
  [SuccessCodes.DATA_UPDATED]: 'Data updated successfully'
};

// HTTP status codes for different error types
const ERROR_STATUS_CODES: Record<ErrorCodes, number> = {
  // Authentication & Authorization (401, 403)
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.AUTH_TOKEN_INVALID]: 401,
  [ErrorCodes.AUTH_TOKEN_MISSING]: 401,
  [ErrorCodes.TOKEN_REQUIRED]: 400,
  [ErrorCodes.TOKEN_INVALID]: 401,
  [ErrorCodes.INVALID_TOKEN]: 401,
  [ErrorCodes.ACCESS_DENIED]: 403,
  
  // User Management (404, 409, 400)
  [ErrorCodes.USER_NOT_FOUND]: 404,
  [ErrorCodes.USER_ALREADY_EXISTS]: 409,
  [ErrorCodes.USER_ALREADY_SIGNED_UP]: 409,
  [ErrorCodes.USER_ALREADY_REFUNDED]: 409,
  [ErrorCodes.USER_NO_ADA_SENT]: 400,
  [ErrorCodes.USER_SECOND_TIME_USE]: 409,
  [ErrorCodes.USER_CREATION_FAILED]: 500,
  
  // Phone & Wallet (409, 400)
  [ErrorCodes.PHONE_ALREADY_EXISTS]: 409,
  [ErrorCodes.PHONE_INVALID_FORMAT]: 400,
  [ErrorCodes.PHONE_REQUIRED]: 400,
  [ErrorCodes.WALLET_ALREADY_EXISTS]: 409,
  [ErrorCodes.WALLET_ADDRESS_IN_USE]: 409,
  [ErrorCodes.WALLET_ADDRESS_INVALID]: 400,
  [ErrorCodes.WALLET_ADDRESS_REQUIRED]: 400,
  [ErrorCodes.WALLET_ADDRESS_NOT_FOUND]: 404,
  [ErrorCodes.WALLET_IN_USE]: 409,
  
  // OTP & Verification (400, 410)
  [ErrorCodes.OTP_EXPIRED]: 410,
  [ErrorCodes.OTP_INVALID]: 400,
  [ErrorCodes.OTP_SEND_FAILED]: 500,
  [ErrorCodes.OTP_VERIFICATION_FAILED]: 400,
  [ErrorCodes.OTP_CANCELLATION_FAILED]: 500,
  [ErrorCodes.OTP_REQUEST_ID_REQUIRED]: 400,
  [ErrorCodes.OTP_CODE_REQUIRED]: 400,
  [ErrorCodes.OTP_CODE_INVALID_FORMAT]: 400,
  
  // Biometric & PIN (400, 401)
  [ErrorCodes.BIOMETRIC_VERIFICATION_FAILED]: 401,
  [ErrorCodes.BIOMETRIC_NOT_ENROLLED]: 400,
  [ErrorCodes.BIOMETRIC_DATA_REQUIRED]: 400,
  [ErrorCodes.PIN_INVALID]: 401,
  [ErrorCodes.PIN_SETUP_FAILED]: 500,
  [ErrorCodes.PIN_REQUIRED]: 400,
  [ErrorCodes.PIN_INVALID_FORMAT]: 400,
  [ErrorCodes.PIN_NOT_FOUND]: 404,
  
  // Username & Session
  [ErrorCodes.USERNAME_REQUIRED]: 400,
  [ErrorCodes.USERNAME_ALREADY_EXISTS]: 409,
  [ErrorCodes.USERNAME_INVALID_FORMAT]: 400,
  [ErrorCodes.SESSION_ID_REQUIRED]: 400,
  [ErrorCodes.SESSION_NOT_FOUND]: 404,
  [ErrorCodes.SESSION_INVALID]: 401,
  [ErrorCodes.INVALID_SESSION]: 401,
  [ErrorCodes.INVALID_FLOW]: 400,
  
  // ZK Proofs (400)
  [ErrorCodes.ZK_PROOF_INVALID]: 400,
  [ErrorCodes.ZK_PROOF_GENERATION_FAILED]: 500,
  [ErrorCodes.ZK_COMMITMENT_INVALID]: 400,
  [ErrorCodes.ZK_PROOF_REQUIRED]: 400,
  [ErrorCodes.ZK_COMMITMENT_REQUIRED]: 400,
  
  // Transactions & Refunds (400, 409, 500)
  [ErrorCodes.TRANSACTION_FAILED]: 500,
  [ErrorCodes.TRANSACTION_NOT_FOUND]: 404,
  [ErrorCodes.REFUND_FAILED]: 500,
  [ErrorCodes.REFUND_ALREADY_PROCESSED]: 409,
  [ErrorCodes.REFUND_NOT_ELIGIBLE]: 400,
  [ErrorCodes.DEPOSIT_VERIFICATION_FAILED]: 400,
  [ErrorCodes.DEPOSIT_NOT_FOUND]: 404,
  [ErrorCodes.USER_UPDATE_FAILED]: 500,
  
  // Validation (400)
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.INVALID_INPUT]: 400,
  [ErrorCodes.MISSING_REQUIRED_FIELDS]: 400,
  [ErrorCodes.IDENTIFIER_REQUIRED]: 400,
  [ErrorCodes.DUPLICATE_ENTRY]: 409,
  
  // Rate Limiting (429)
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  
  // Server Errors (500)
  [ErrorCodes.SERVER_ERROR]: 500,
  [ErrorCodes.DATABASE_ERROR]: 500,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 503,
  
  // Storage & Seed Phrases (404, 500)
  [ErrorCodes.SEED_PHRASE_NOT_FOUND]: 404,
  [ErrorCodes.SEED_PHRASE_ENCRYPTION_FAILED]: 500,
  [ErrorCodes.STORAGE_SERVICE_ERROR]: 503
};

// Custom error class
export class K33PError extends Error {
  public code: ErrorCodes;
  public statusCode: number;
  public userMessage: string;
  public details?: any;
  public timestamp: string;

  constructor(
    code: ErrorCodes,
    details?: any,
    customMessage?: string
  ) {
    const userMessage = customMessage || ERROR_MESSAGES[code];
    super(userMessage);
    
    this.name = 'K33PError';
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code];
    this.userMessage = userMessage;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Response utilities
export class ResponseUtils {
  /**
   * Send a success response with optional success code
   */
  static success(
    res: Response,
    successCode?: SuccessCodes,
    data?: any,
    customMessage?: string,
    statusCode: number = 200
  ) {
    const message = customMessage || 
                   (successCode ? SUCCESS_MESSAGES[successCode] : 'Operation completed successfully');
    
    const response = {
      success: true,
      code: successCode || SuccessCodes.OPERATION_SUCCESS,
      message,
      data,
      statusCode,
      timestamp: new Date().toISOString()
    };

    // Log success response for debugging
    logger.info('API Success:', {
      statusCode,
      code: successCode || SuccessCodes.OPERATION_SUCCESS,
      message,
      timestamp: response.timestamp
    });

    // Remove data field if undefined
    if (data === undefined) {
      delete response.data;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send a success response (legacy method for backward compatibility)
   */
  static legacySuccess(
    res: Response,
    data?: any,
    message?: string,
    statusCode: number = 200
  ) {
    const response = {
      success: true,
      message: message || 'Operation completed successfully',
      data,
      statusCode,
      timestamp: new Date().toISOString()
    };

    // Log legacy success response for debugging
    logger.info('API Legacy Success:', {
      statusCode,
      message: response.message,
      timestamp: response.timestamp
    });

    // Remove data field if undefined
    if (data === undefined) {
      delete response.data;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send an error response
   */
  static error(
    res: Response,
    error: K33PError | ErrorCodes | string,
    details?: any,
    customMessage?: string
  ) {
    let k33pError: K33PError;

    if (error instanceof K33PError) {
      k33pError = error;
    } else if (typeof error === 'string' && Object.values(ErrorCodes).includes(error as ErrorCodes)) {
      k33pError = new K33PError(error as ErrorCodes, details, customMessage);
    } else {
      // Generic error
      k33pError = new K33PError(ErrorCodes.SERVER_ERROR, details, typeof error === 'string' ? error : 'An unexpected error occurred');
    }

    // Log error for debugging (console output) - now includes error code and status code
    logger.error('API Error:', {
      statusCode: k33pError.statusCode,
      code: k33pError.code,
      message: k33pError.message,
      userMessage: k33pError.userMessage,
      details: k33pError.details,
      stack: k33pError.stack,
      timestamp: k33pError.timestamp
    });

    // Send user-friendly response with error code included
    const response = {
      success: false,
      error: {
        code: k33pError.code,
        message: k33pError.userMessage
      },
      statusCode: k33pError.statusCode,
      timestamp: k33pError.timestamp
    };

    // Add details for development environment
    if (process.env.NODE_ENV === 'development' && k33pError.details) {
      (response.error as any).details = k33pError.details;
    }

    return res.status(k33pError.statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(
    res: Response,
    validationErrors: any[],
    customMessage?: string
  ) {
    const message = customMessage || 'Validation failed';
    const details = validationErrors.map(err => ({
      field: err.param || err.path,
      message: err.msg || err.message,
      value: err.value
    }));

    return ResponseUtils.error(
      res,
      ErrorCodes.VALIDATION_ERROR,
      details,
      message
    );
  }
}

// Global error handling middleware
export const globalErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Handle K33P errors
  if (error instanceof K33PError) {
    return ResponseUtils.error(res, error);
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return ResponseUtils.error(
      res,
      ErrorCodes.VALIDATION_ERROR,
      error.details,
      error.message
    );
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return ResponseUtils.error(res, ErrorCodes.AUTH_TOKEN_INVALID);
  }

  if (error.name === 'TokenExpiredError') {
    return ResponseUtils.error(res, ErrorCodes.AUTH_TOKEN_EXPIRED);
  }

  // Handle database errors
  if (error.code && error.code.startsWith('23')) { // PostgreSQL constraint violations
    if (error.code === '23505') { // Unique constraint violation
      return ResponseUtils.error(
        res,
        ErrorCodes.USER_ALREADY_EXISTS,
        { constraint: error.constraint },
        'This information is already registered'
      );
    }
    return ResponseUtils.error(res, ErrorCodes.DATABASE_ERROR);
  }

  // Log unexpected errors
  logger.error('Unexpected error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // Send generic server error
  return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR);
};

// Async route wrapper to catch errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Export everything
export default {
  SuccessCodes,
  ErrorCodes,
  K33PError,
  ResponseUtils,
  globalErrorHandler,
  asyncHandler
};