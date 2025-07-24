// otp.ts - OTP Authentication Routes
import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { sendOtp, verifyOtp, cancelVerification, verifyFirebaseToken } from '../utils/firebase.js';
import { 
  SendOtpRequest, 
  SendOtpResponse, 
  VerifyOtpRequest, 
  VerifyOtpResponse,
  CancelVerificationRequest,
  CancelVerificationResponse 
} from '../interfaces/otp.js';

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
    return res.status(400).json(createResponse(false, undefined, undefined, 
      `Validation errors: ${errors.array().map((e: any) => e.msg).join(', ')}`
    ));
  }
  next();
};

/**
 * Send OTP to a phone number
 * POST /api/otp/send
 */
router.post('/send', [
  body('phoneNumber')
    .isLength({ min: 10 })
    .withMessage('Phone number must be at least 10 characters')
    .trim()
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { phoneNumber }: SendOtpRequest = req.body;
    
    console.log(`Sending OTP to ${phoneNumber}`);
    const result: SendOtpResponse = await sendOtp(phoneNumber);
    
    if (result.success) {
      res.json(createResponse(true, { requestId: result.requestId }, 'Verification code sent'));
    } else {
      res.status(400).json(createResponse(false, undefined, undefined, result.error));
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to send verification code'));
  }
});

/**
 * Verify OTP code
 * POST /api/otp/verify
 */
router.post('/verify', [
  body('requestId')
    .isString()
    .withMessage('Request ID is required')
    .trim(),
  body('code')
    .isLength({ min: 4, max: 6 })
    .withMessage('Verification code must be 4-6 digits')
    .trim()
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { requestId, code }: VerifyOtpRequest = req.body;
    
    console.log(`Verifying OTP for request ${requestId}`);
    const result: VerifyOtpResponse = await verifyOtp(requestId, code);
    
    if (result.success) {
      res.json(createResponse(true, { verified: true }, 'Phone number verified successfully'));
    } else {
      res.status(400).json(createResponse(false, undefined, undefined, result.error));
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to verify code'));
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
      res.status(400).json(createResponse(false, undefined, undefined, result.error));
    }
  } catch (error) {
    console.error('Error cancelling verification:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to cancel verification'));
  }
});

/**
 * Verify Firebase ID token from mobile app
 * POST /api/otp/verify-token
 */
router.post('/verify-token', [
  body('idToken')
    .isString()
    .withMessage('Firebase ID token is required')
    .trim()
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    
    console.log('Verifying Firebase ID token');
    const decodedToken = await verifyFirebaseToken(idToken);
    
    if (decodedToken) {
      // Token is valid, extract user information
      const { uid, phone_number } = decodedToken;
      
      res.json(createResponse(true, { 
        uid, 
        phoneNumber: phone_number,
        verified: true 
      }, 'Firebase token verified successfully'));
    } else {
      res.status(401).json(createResponse(false, undefined, undefined, 'Invalid Firebase token'));
    }
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to verify Firebase token'));
  }
});

export default router;