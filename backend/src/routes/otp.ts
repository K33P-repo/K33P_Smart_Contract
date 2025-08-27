// otp.ts - OTP Authentication Routes
import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { sendOtp, verifyOtp, cancelVerification } from '../utils/twilio.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { 
  SendOtpRequest, 
  SendOtpResponse, 
  VerifyOtpRequest, 
  VerifyOtpResponse,
  CancelVerificationRequest,
  CancelVerificationResponse 
} from '../interfaces/otp.js';
import { ResponseUtils, ErrorCodes } from '../middleware/error-handler.js';

const router = express.Router();

// Helper function to create standardized API responses
const createResponse = <T>(success: boolean, data?: T, message?: string, error?: string) => {
  return {
    success,
    data,
    message,
    error,
    timestamp: new Date().toISOString()
  };
};

// Middleware to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 
      `Validation errors: ${errors.array().map((e: any) => e.msg).join(', ')}`
    );
  }
  next();
};

/**
 * Send OTP to a phone number
 * POST /api/otp/send
 */
router.post('/send', 
  createRateLimiter({ windowMs: 5 * 60 * 1000, max: 3 }), // 3 requests per 5 minutes
  [
    body('phoneNumber')
      .isLength({ min: 10 })
      .withMessage('Phone number must be at least 10 characters')
      .trim()
  ], 
  handleValidationErrors, 
  async (req: Request, res: Response) => {
  try {
    const { phoneNumber }: SendOtpRequest = req.body;
    
    console.log(`Sending OTP to ${phoneNumber}`);
    const result: SendOtpResponse = await sendOtp(phoneNumber);
    
    if (result.success) {
      res.json(createResponse(true, { requestId: result.requestId }, 'Verification code sent'));
    } else {
      return ResponseUtils.error(res, ErrorCodes.OTP_SEND_FAILED, null, result.error);
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to send verification code');
  }
});

/**
 * Verify OTP code
 * POST /api/otp/verify
 */
router.post('/verify', 
  createRateLimiter({ windowMs: 5 * 60 * 1000, max: 10 }), // 10 requests per 5 minutes
  [
    body('requestId')
      .isString()
      .withMessage('Request ID is required')
      .trim(),
    body('code')
      .isLength({ min: 4, max: 6 })
      .withMessage('Verification code must be 4-6 digits')
      .trim()
  ], 
  handleValidationErrors, 
  async (req: Request, res: Response) => {
  try {
    const { requestId, code }: VerifyOtpRequest = req.body;
    
    console.log(`Verifying OTP for request ${requestId}`);
    const result: VerifyOtpResponse = await verifyOtp(requestId, code);
    
    if (result.success) {
      res.json(createResponse(true, { verified: true }, 'Phone number verified successfully'));
    } else {
      return ResponseUtils.error(res, ErrorCodes.OTP_VERIFICATION_FAILED, null, result.error);
    }
  } catch (error) {
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
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { requestId }: CancelVerificationRequest = req.body;
    
    console.log(`Cancelling OTP request ${requestId}`);
    const result: CancelVerificationResponse = await cancelVerification(requestId);
    
    if (result.success) {
      res.json(createResponse(true, undefined, 'Verification cancelled successfully'));
    } else {
      return ResponseUtils.error(res, ErrorCodes.OTP_CANCELLATION_FAILED, null, result.error);
    }
  } catch (error) {
    console.error('Error cancelling verification:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to cancel verification');
  }
});



export default router;