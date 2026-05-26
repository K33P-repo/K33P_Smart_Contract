import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { ResponseUtils, ErrorCodes } from '../middleware/error-handler.js';
import { redisClient } from '../utils/redis.js';
import { logger } from '../utils/logger.js';
import { infobipService } from '../services/infobip-service.js';

const router = express.Router();

// Generate 5-digit OTP
const generateOTP = (): string => Math.floor(10000 + Math.random() * 90000).toString();

/**
 * Send OTP
 * POST /api/otp/send
 */
router.post('/send',
  [
    body('phone')
      .isString()
      .matches(/^234[0-9]{9,10}$/)
      .withMessage('Phone must be in format: 234XXXXXXXXXX')
      .trim(),
  ],
  async (req: Request, res: Response) => {
    const { phone } = req.body;

    logger.info(`📨 OTP Send Request received for phone: ${phone}`);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`❌ Validation failed for ${phone}`, errors.array());
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null,
        errors.array().map(e => e.msg).join(', '));
    }

    try {
      logger.info(`🔍 Starting OTP process for ${phone}`);

      // ==================== RATE LIMITING ====================
      logger.info(`⏱️ Checking rate limit for ${phone}`);
      const rateKey = `rate:otp:${phone}`;
      const rateLimit = await redisClient.get(rateKey);
      const currentCount = rateLimit ? parseInt(rateLimit) : 0;

      if (currentCount >= 3) {
        logger.warn(`🚫 Rate limit exceeded for ${phone} (${currentCount} requests)`);
        return ResponseUtils.error(
          res,
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          null,
          'Too many OTP requests. Please try again in 10 minutes.'
        );
      }

      await redisClient.incr(rateKey);
      if (currentCount === 0) {
        await redisClient.expire(rateKey, 10 * 60);
      }
      logger.info(`✅ Rate limit updated for ${phone}`);

      // ==================== COOLDOWN CHECK ====================
      logger.info(`🔍 Checking if OTP already exists for ${phone}`);
      const existingOTP = await redisClient.get(`otp:${phone}`);

      if (existingOTP) {
        const ttl = await redisClient.ttl(`otp:${phone}`);
        const minutesLeft = Math.ceil(ttl / 60);
        logger.warn(`⏳ Active OTP found for ${phone}, expires in ${minutesLeft} minutes`);

        return ResponseUtils.error(
          res,
          ErrorCodes.OTP_ALREADY_SENT,
          null,
          `An OTP has already been sent. Please wait ${minutesLeft} minutes before requesting a new one.`
        );
      }

      // ==================== GENERATE & SEND OTP ====================
      const otp = generateOTP();
      const expiresIn = 30 * 60;

      logger.info(`🔑 Generated OTP for ${phone}: ${otp}`);

      // Store OTP
      await redisClient.set(`otp:${phone}`, otp, { EX: expiresIn });
      logger.info(`💾 OTP saved to Redis for ${phone}`);

      // Send via Infobip
      logger.info(`📤 Sending OTP to Infobip for ${phone}`);
      const result = await infobipService.sendOTP(phone, otp);

      if (result.success) {
        logger.info(`🎉 OTP successfully sent to ${phone}`);
        return res.json({
          success: true,
          message: 'OTP sent successfully',
          expiresIn: '30 minutes'
        });
      } else {
        logger.error(`❌ Infobip failed to send OTP to ${phone}`, result.error);
        await redisClient.del(`otp:${phone}`);
        return ResponseUtils.error(res, ErrorCodes.OTP_SEND_FAILED, null, result.error || 'Failed to send OTP');
      }

    } catch (error: any) {
      logger.error(`💥 Unexpected error in OTP send for ${phone}`, {
        error: error.message,
        stack: error.stack
      });
      return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Failed to send OTP');
    }
  }
);

/**
 * Verify OTP
 * POST /api/otp/verify
 */
router.post('/verify',
  [
    body('phone').isString().trim(),
    body('otp').isString().isLength({ min: 5, max: 5 }).trim(),
  ],
  async (req: Request, res: Response) => {
    const { phone, otp } = req.body;
    logger.info(`🔐 OTP Verification attempt for ${phone}`);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ResponseUtils.error(res, ErrorCodes.VALIDATION_ERROR, null, 'Invalid input');
    }

    try {
      const storedOtp = await redisClient.get(`otp:${phone}`);

      if (!storedOtp) {
        logger.warn(`⏰ OTP expired or not found for ${phone}`);
        return ResponseUtils.error(res, ErrorCodes.OTP_EXPIRED, null, 'OTP has expired or does not exist');
      }

      if (storedOtp !== otp) {
        logger.warn(`❌ Invalid OTP entered for ${phone}`);
        return ResponseUtils.error(res, ErrorCodes.OTP_INVALID, null, 'Invalid OTP code');
      }

      await redisClient.del(`otp:${phone}`);
      logger.info(`✅ OTP verified successfully for ${phone}`);

      return res.json({
        success: true,
        message: 'OTP verified successfully'
      });
    } catch (error) {
      logger.error(`💥 OTP Verify Error for ${phone}`, error);
      return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Verification failed');
    }
  }
);

export default router;