import express, { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import cors from 'cors';
import dotenv from 'dotenv';
import { EnhancedK33PManager } from './k33p-signup-interactions';
import winston from 'winston';

// Import routes
// @ts-ignore
import zkRoutes from './routes/zk';

// Load environment variables
dotenv.config();

// Constants
const PORT = process.env.PORT || 3000;

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'k33p-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Initialize K33P Manager
let k33pManager: EnhancedK33PManager;

async function initializeK33P() {
  try {
    k33pManager = new EnhancedK33PManager();
    await k33pManager.initialize();
    logger.info('K33P Manager initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize K33P Manager:', error);
    throw error;
  }
}

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Register routes
app.use('/api/zk', zkRoutes);

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createResponse(false, undefined, undefined, errors.array()[0].msg));
  }
  next();
};

// Response helper
interface ApiResponse {
  success: boolean;
  data?: any;
  meta?: any;
  message?: string;
  timestamp: string;
}

function createResponse(success: boolean, data?: any, meta?: any, message?: string): ApiResponse {
  return {
    success,
    data,
    meta,
    message,
    timestamp: new Date().toISOString()
  };
}

// Types
interface SignupRequest {
  userAddress: string;
  userId: string;
  phoneNumber: string;
  senderWalletAddress?: string;
  pin?: string;
  biometricData?: string;
  verificationMethod?: 'phone' | 'pin' | 'biometric';
  biometricType?: 'fingerprint' | 'faceid' | 'voice' | 'iris';
}

interface VerificationRequest {
  userAddress: string;
}

interface UserStatus {
  userAddress: string;
  userId: string;
  verified: boolean;
  signupCompleted: boolean;
  refunded: boolean;
  txHash: string;
  amount: string;
  timestamp: string;
  verificationAttempts: number;
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json(createResponse(true, { status: 'ok' }, undefined, 'K33P Backend is running'));
});

// Get deposit address
app.get('/api/deposit-address', async (req: Request, res: Response) => {
  try {
    const address = await k33pManager.getDepositAddress();
    res.json(createResponse(true, { address }, undefined, 'Deposit address retrieved'));
  } catch (error) {
    logger.error('Error getting deposit address:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get deposit address'));
  }
});

// Record signup with verification
app.post('/api/signup', [
  body('userAddress')
    .isLength({ min: 10 })
    .withMessage('User address must be at least 10 characters'),
  body('userId')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('User ID must be 3-50 characters, alphanumeric and underscores only'),
  body('phoneNumber')
    .isLength({ min: 10 })
    .withMessage('Phone number must be at least 10 characters'),
  body('senderWalletAddress')
    .optional() // Make senderWalletAddress optional
    .matches(/^addr_(test|vkh|vk)[a-zA-Z0-9]+$/)
    .withMessage('Invalid sender wallet address format'),
  body('pin')
    .optional()
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('PIN must be exactly 4 digits'),
  body('verificationMethod')
    .optional()
    .isIn(['phone', 'pin', 'biometric'])
    .withMessage('Verification method must be one of: phone, pin, biometric'),
  body('biometricType')
    .optional()
    .isIn(['fingerprint', 'faceid', 'voice', 'iris'])
    .withMessage('Biometric type must be one of: fingerprint, faceid, voice, iris')
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { userAddress, userId, phoneNumber, senderWalletAddress, pin, biometricData, verificationMethod = 'phone', biometricType }: SignupRequest = req.body;
    
    logger.info('Processing signup request', { userId, userAddress, senderWalletAddress, verificationMethod, biometricType });
    
    const result = await k33pManager.recordSignupWithVerification(
      userAddress, 
      userId, 
      phoneNumber, 
      senderWalletAddress, // Using sender wallet address instead of txHash
      pin,
      biometricData,
      verificationMethod,
      biometricType
    );
    
    if (result.success) {
      res.json(createResponse(true, {
        verified: result.verified,
        userId,
        verificationMethod,
        message: result.message,
        depositAddress: result.depositAddress // Include deposit address in response
      }, 'Signup processed successfully'));
    } else {
      res.status(400).json(createResponse(false, undefined, undefined, result.message));
    }
  } catch (error) {
    logger.error('Error processing signup:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Internal server error'));
  }
});

// Retry verification for a user
app.post('/api/retry-verification', [
  body('userAddress')
    .isLength({ min: 50, max: 200 })
    .withMessage('Invalid user address format')
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { userAddress }: VerificationRequest = req.body;
    
    logger.info('Retrying verification', { userAddress });
    
    const result = await k33pManager.retryVerification(userAddress);
    
    if (result.success) {
      res.json(createResponse(true, { verified: true }, result.message));
    } else {
      res.status(400).json(createResponse(false, undefined, undefined, result.message));
    }
  } catch (error) {
    logger.error('Error retrying verification:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to retry verification'));
  }
});

// Get user status
app.get('/api/user/:address/status', [
  param('address')
    .isLength({ min: 50, max: 200 })
    .withMessage('Invalid user address format')
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userAddress = req.params.address;
    
    // This would need to be implemented in the K33P manager
    const deposits = (k33pManager as any).loadDeposits(); // Access private method for demo
    const userDeposit = deposits.find((d: any) => d.userAddress === userAddress);
    
    if (!userDeposit) {
      return res.status(404).json(createResponse(false, undefined, undefined, 'User not found'));
    }
    
    const status: UserStatus = {
      userAddress: userDeposit.userAddress,
      userId: userDeposit.userId,
      verified: userDeposit.verified,
      signupCompleted: userDeposit.signupCompleted,
      refunded: userDeposit.refunded,
      txHash: userDeposit.txHash,
      amount: (Number(userDeposit.amount) / 1_000_000).toString(),
      timestamp: userDeposit.timestamp,
      verificationAttempts: userDeposit.verificationAttempts
    };
    
    res.json(createResponse(true, status, 'User status retrieved'));
  } catch (error) {
    logger.error('Error getting user status:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get user status'));
  }
});

// Get all users (admin endpoint)
app.get('/api/admin/users', async (req: Request, res: Response) => {
  try {
    // Add admin authentication here in production
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json(createResponse(false, undefined, undefined, 'Unauthorized'));
    }
    
    const deposits = (k33pManager as any).loadDeposits();
    const users = deposits.map((d: any) => ({
      userAddress: d.userAddress,
      userId: d.userId,
      verified: d.verified,
      signupCompleted: d.signupCompleted,
      refunded: d.refunded,
      txHash: d.txHash,
      amount: (Number(d.amount) / 1_000_000).toString(),
      timestamp: d.timestamp,
      verificationAttempts: d.verificationAttempts
    }));
    
    res.json(createResponse(true, { users, total: users.length }, 'Users retrieved'));
  } catch (error) {
    logger.error('Error getting all users:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get users'));
  }
});

// Auto-verify all unverified deposits (admin endpoint)
app.post('/api/admin/auto-verify', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json(createResponse(false, undefined, undefined, 'Unauthorized'));
    }
    
    logger.info('Starting auto-verification process');
    await k33pManager.autoVerifyDeposits();
    
    res.json(createResponse(true, undefined, 'Auto-verification completed'));
  } catch (error) {
    logger.error('Error during auto-verification:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Auto-verification failed'));
  }
});

// Monitor incoming transactions (admin endpoint)
app.get('/api/admin/monitor', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json(createResponse(false, undefined, undefined, 'Unauthorized'));
    }
    
    await k33pManager.monitorIncomingTransactions();
    res.json(createResponse(true, undefined, 'Transaction monitoring completed'));
  } catch (error) {
    logger.error('Error monitoring transactions:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Transaction monitoring failed'));
  }
});

// Process signup completion (admin endpoint)
app.post('/api/admin/process-signup', [
  body('userAddress')
    .isLength({ min: 50, max: 200 })
    .withMessage('Invalid user address format')
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json(createResponse(false, undefined, undefined, 'Unauthorized'));
    }
    
    const { userAddress } = req.body;
    
    logger.info('Processing signup completion', { userAddress });
    const txHash = await k33pManager.processSignup(userAddress);
    
    res.json(createResponse(true, { txHash }, 'Signup processed successfully'));
  } catch (error) {
    logger.error('Error processing signup:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 
      error instanceof Error ? error.message : 'Failed to process signup'
    ));
  }
});

// NEW: Immediate refund endpoint
app.post('/api/refund', [
  body('userAddress')
    .isLength({ min: 50, max: 200 })
    .withMessage('Invalid user address format'),
  body('walletAddress')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Wallet address must be at least 10 characters')
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { userAddress, walletAddress } = req.body;
    
    logger.info('Processing immediate refund request', { userAddress, walletAddress });
    
    // Process the refund using the K33P manager
    const result = await k33pManager.processRefund(userAddress, walletAddress);
    
    if (!result.success) {
      return res.status(400).json(createResponse(false, undefined, undefined, result.message));
    }
    
    const txHash = result.txHash;
    
    res.json(createResponse(true, { txHash }, 'Refund processed successfully'));
  } catch (error) {
    logger.error('Error processing refund:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 
      error instanceof Error ? error.message : 'Failed to process refund'
    ));
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json(createResponse(false, undefined, undefined, 'Internal server error'));
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json(createResponse(false, undefined, undefined, 'Endpoint not found'));
});

// ============================================================================
// SERVER STARTUP
// ============================================================================
async function startServer() {
  try {
    await initializeK33P();
    
    app.listen(PORT, () => {
      logger.info(`K33P Backend Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export { app };