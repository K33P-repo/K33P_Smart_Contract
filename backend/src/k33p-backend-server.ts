import express, { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { EnhancedK33PManagerDB } from './enhanced-k33p-manager-db.js';
import { dbService } from './database/service.js';
import { autoRefundMonitor } from './services/auto-refund-monitor.js';
import { subscriptionService } from './services/subscription-service.js';
import { MockDatabaseService } from './database/mock-service.js';
import {testConnection } from './database/config.js';
import winston from 'winston';
import { authenticateToken } from './middleware/auth.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { globalErrorHandler } from './middleware/error-handler.js';
import swaggerUi from 'swagger-ui-express';

// Import routes
// @ts-ignore
import zkRoutes from './routes/zk-postgres.js';
// @ts-ignore
import utxoRoutes from './routes/utxo.js';
// @ts-ignore
import authRoutes from './routes/auth.js';
// @ts-ignore
import userManagementRoutes from './routes/user-management.js';
// @ts-ignore
import phoneRoutes from './routes/phone-management.js';
// @ts-ignore
import recoveryRoutes from './routes/account-recovery.js';
// @ts-ignore
import otpRoutes from './routes/otp.js';
// @ts-ignore
import seedPhraseRoutes from './routes/seed-phrase-routes.js';
// @ts-ignore
import userRoutes from './routes/user-routes.js';
// @ts-ignore
import notificationRoutes from './routes/notification-routes.js';

// @ts-ignore
import autoRefundRoutes from './routes/auto-refund-routes.js';
// @ts-ignore
import paymentRoutes from './routes/payment.js';
// @ts-ignore
import subscriptionRoutes from './routes/subscription.js';
// @ts-ignore
import walletFoldersRoutes from './routes/wallet-folders.js';
// @ts-ignore
import imageNumberRoutes from './routes/image-number-routes.js';

import swaggerSpec from './swagger.js';
import { paystackService } from './services/paystack-service.js';

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

// Initialize K33P Manager with Database
let k33pManager: EnhancedK33PManagerDB;
let usingMockDatabase = false;

async function initializeK33P() {
  try {
    console.log('🔧 Initializing database connection to Supabase...');
    
    // Initialize database first
    /* const dbReady = await;
    
    if (!dbReady) {
      logger.warn('Database initialization failed, using mock database...');
      await MockDatabaseService.initialize();
      usingMockDatabase = true;
    } else {
      logger.info('✅ Database connected and schema ready');
      usingMockDatabase = false;
    }
     */
    // Initialize K33P Manager - but skip Cardano if disabled
    k33pManager = new EnhancedK33PManagerDB();
    
    // Only initialize Cardano features if not disabled
    if (process.env.DISABLE_CARDANO !== "true") {
      try {
        await k33pManager.initialize();
        logger.info('✅ Cardano features initialized');
      } catch (cardanoError) {
        if (cardanoError instanceof Error) {
          logger.warn('❌ Cardano initialization failed, continuing without Cardano features:', cardanoError.message);
        } else {
          logger.warn('❌ Cardano initialization failed, continuing without Cardano features:', cardanoError);
        }
      }
      
    } else {
      console.log("🚫 Cardano features disabled via DISABLE_CARDANO");
      // Set a flag or property to indicate Cardano is disabled
      (k33pManager as any).cardanoEnabled = false;
    }
    
    logger.info('K33P Manager initialized successfully');
    
    // Initialize auto-refund monitor only if we have a real database AND Cardano is working
    if (!usingMockDatabase) {
      try {
        // Only start auto-refund if Cardano is enabled and initialized
        if (process.env.DISABLE_CARDANO !== "true" && (k33pManager as any).cardanoEnabled !== false) {
          await autoRefundMonitor.initialize();
          await autoRefundMonitor.start();
          logger.info('🚀 Auto-Refund Monitor started');
        } else {
          logger.info('📝 Auto-Refund Monitor disabled (Cardano features disabled)');
        }
      } catch (error) {
        logger.warn('Auto-Refund Monitor failed to start:', error);
      }
    }
    
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
app.use(morgan('dev'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'K33P API Documentation'
}));

// Optional: Add a JSON endpoint for the swagger spec
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/utxo', utxoRoutes);
app.use('/api/zk', zkRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/phone', phoneRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/seed-phrases', seedPhraseRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/auto-refund', autoRefundRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/wallet-folders', walletFoldersRoutes); 
app.use('/api/image-number', imageNumberRoutes);


// Global error handler (must be last middleware)
app.use(globalErrorHandler);

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

// Rate limiters for system endpoints
const systemEndpointLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for system endpoints
  message: 'Too many requests to system endpoints'
});

// Health check endpoint
app.get('/api/health', systemEndpointLimiter, (req: Request, res: Response) => {
  res.json(createResponse(true, { status: 'ok' }, undefined, 'K33P Backend is running'));
});

// API Status endpoint
app.get('/api/status', systemEndpointLimiter, (req: Request, res: Response) => {
  res.json(createResponse(true, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: usingMockDatabase ? 'mock' : 'postgresql'
  }, undefined, 'System status retrieved'));
});

// API Version endpoint
app.get('/api/version', systemEndpointLimiter, (req: Request, res: Response) => {
  res.json(createResponse(true, {
    version: '1.0.0',
    apiVersion: 'v1',
    buildDate: new Date().toISOString(),
    features: ['auth', 'utxo', 'zk', 'users', 'wallet-folders'] // ADD 'wallet-folders' HERE
  }, undefined, 'API version information'));
});

// User Profile endpoints
app.get('/api/user/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json(createResponse(false, undefined, undefined, 'User not authenticated'));
    }

    // Try to find user by user ID
    const deposits = await dbService.getAllDeposits();
    const userDeposit = deposits.find((d: any) => d.user_id === userId);
    
    if (!userDeposit) {
      return res.status(404).json(createResponse(false, undefined, undefined, 'User profile not found'));
    }
    
    const profile = {
      userId: userDeposit.user_id,
      userAddress: userDeposit.user_address,
      verified: userDeposit.verified,
      signupCompleted: userDeposit.signup_completed,
      refunded: userDeposit.refunded,
      amount: (Number(userDeposit.amount) / 1_000_000).toString(),
      createdAt: userDeposit.timestamp?.toISOString() || new Date().toISOString(),
      verificationAttempts: userDeposit.verification_attempts
    };
    
    res.json(createResponse(true, profile, undefined, 'User profile retrieved'));
  } catch (error) {
    logger.error('Error getting user profile:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get user profile'));
  }
});

app.post('/api/user/profile', async (req: Request, res: Response) => {
  try {
    const { walletAddress, userId } = req.body;
    
    if (!walletAddress && !userId) {
      return res.status(400).json(createResponse(false, undefined, undefined, 'Either walletAddress or userId is required'));
    }

    // Try to find user by wallet address or user ID
    let userDeposit;
    if (walletAddress) {
      userDeposit = await dbService.getDepositByUserAddress(walletAddress);
    } else if (userId) {
      // Find by user ID (this would need to be implemented in dbService)
      const deposits = await dbService.getAllDeposits();
      userDeposit = deposits.find((d: any) => d.user_id === userId);
    }
    
    if (!userDeposit) {
      return res.status(404).json(createResponse(false, undefined, undefined, 'User profile not found'));
    }
    
    const profile = {
      userId: userDeposit.user_id,
      userAddress: userDeposit.user_address,
      verified: userDeposit.verified,
      signupCompleted: userDeposit.signup_completed,
      refunded: userDeposit.refunded,
      amount: (Number(userDeposit.amount) / 1_000_000).toString(),
      createdAt: userDeposit.timestamp?.toISOString() || new Date().toISOString(),
      verificationAttempts: userDeposit.verification_attempts
    };
    
    res.json(createResponse(true, profile, undefined, 'User profile retrieved'));
  } catch (error) {
    logger.error('Error getting user profile:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get user profile'));
  }
});

// In your main server file (app.ts or server.ts)

// Paystack webhook endpoint - must be before express.json() middleware
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    
    // For local development, you might want to log the webhook for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('📩 Webhook received:', {
        signature: signature ? 'present' : 'missing',
        body: req.body.toString().substring(0, 500) + '...'
      });
    }

    // Verify webhook signature
    const isValid = paystackService.verifyWebhookSignature(req.body.toString(), signature);
    
    if (!isValid) {
      logger.warn('Invalid webhook signature', { signature });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());
    
    // Log webhook event for debugging
    logger.info('Processing Paystack webhook', { 
      event: event.event,
      reference: event.data?.reference 
    });

    // Process the webhook
    const result = await paystackService.processWebhookEvent(event);
    
    if (result.success) {
      res.status(200).json({ message: 'Webhook processed successfully' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error: any) {
    logger.error('Webhook processing error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json(createResponse(true, {
    message: 'K33P Backend API is running',
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/status', 
      '/api/version',
      '/api/auth/*',
      '/api/utxo/*',
      '/api/zk/*',
      '/api/users/*',
      '/api/phone/*',
      '/api/recovery/*',
      '/api/user/profile',
      '/api/auto-refund/*',
      '/api/wallet-folders/*' // ADD THIS LINE
    ]
  }, undefined, 'Welcome to K33P Backend API'));
});

// Get deposit address
app.get('/api/deposit-address', 
  createRateLimiter({ windowMs: 60 * 1000, max: 20 }), // 20 requests per minute
  async (req: Request, res: Response) => {
  try {
    const address = await k33pManager.getDepositAddress();
    res.json(createResponse(true, { address }, undefined, 'Deposit address retrieved'));
  } catch (error) {
    logger.error('Error getting deposit address:', error);
    res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get deposit address'));
  }
});

// Signup route removed - use /api/auth/signup instead

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
    
    const userDeposit = await dbService.getDepositByUserAddress(userAddress);
    
    if (!userDeposit) {
      return res.status(404).json(createResponse(false, undefined, undefined, 'User not found'));
    }
    
    const status: UserStatus = {
      userAddress: userDeposit.user_address,
      userId: userDeposit.user_id,
      verified: userDeposit.verified,
      signupCompleted: userDeposit.signup_completed,
      refunded: userDeposit.refunded,
      txHash: userDeposit.tx_hash || '',
      amount: (Number(userDeposit.amount) / 1_000_000).toString(),
      timestamp: userDeposit.timestamp?.toISOString() || new Date().toISOString(),
      verificationAttempts: userDeposit.verification_attempts
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
    
    const deposits = await dbService.getAllDeposits();
    const users = deposits.map((d: any) => ({
      userAddress: d.user_address,
      userId: d.user_id,
      verified: d.verified,
      signupCompleted: d.signup_completed,
      refunded: d.refunded,
      txHash: d.tx_hash || '',
      amount: (Number(d.amount) / 1_000_000).toString(),
      timestamp: d.timestamp?.toISOString() || new Date().toISOString(),
      verificationAttempts: d.verification_attempts
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
    
    logger.info('🔄 Processing immediate refund request', { 
      userAddress, 
      walletAddress,
      requestBody: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });
    
    // Validate input parameters
    if (!userAddress || typeof userAddress !== 'string') {
      logger.error('❌ Invalid userAddress provided', { userAddress });
      return res.status(400).json(createResponse(false, undefined, undefined, 'Invalid or missing userAddress'));
    }
    
    if (walletAddress && typeof walletAddress !== 'string') {
      logger.error('❌ Invalid walletAddress provided', { walletAddress });
      return res.status(400).json(createResponse(false, undefined, undefined, 'Invalid walletAddress format'));
    }
    
    // Check if user exists in database
    try {
      const userDeposit = await dbService.getDepositByUserAddress(userAddress);
      logger.info('📊 User deposit lookup result', { 
        userAddress, 
        depositFound: !!userDeposit,
        depositRefunded: userDeposit?.refunded,
        depositVerified: userDeposit?.verified
      });
    } catch (dbError) {
      logger.error('❌ Database lookup error during refund', { userAddress, error: dbError });
    }
    
    // Process the refund using the K33P manager
    logger.info('🔄 Calling k33pManager.processRefund', { userAddress, walletAddress });
    const result = await k33pManager.processRefund(userAddress, walletAddress);
    
    logger.info('📊 Refund processing result', { 
      userAddress, 
      success: result.success, 
      message: result.message,
      txHash: result.txHash
    });
    
    if (!result.success) {
      logger.error('❌ Refund processing failed', { 
        userAddress, 
        walletAddress, 
        message: result.message 
      });
      return res.status(400).json(createResponse(false, undefined, undefined, result.message));
    }
    
    const txHash = result.txHash;
    logger.info('✅ Refund processed successfully', { userAddress, txHash });
    
    res.json(createResponse(true, { txHash }, 'Refund processed successfully'));
  } catch (error) {
    logger.error('❌ Unexpected error processing refund:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userAddress: req.body?.userAddress,
      walletAddress: req.body?.walletAddress
    });
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
      
      // Use environment-aware URL for health check
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL || `https://${process.env.RENDER_EXTERNAL_URL || 'your-app.onrender.com'}` 
        : `http://localhost:${PORT}`;
      
      logger.info(`Health check: ${baseUrl}/api/health`);
      logger.info(`Wallet folders API: ${baseUrl}/api/wallet-folders`); // ADD THIS LINE
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await autoRefundMonitor.stop();
      logger.info('Auto-Refund Monitor stopped');
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await autoRefundMonitor.stop();
      logger.info('Auto-Refund Monitor stopped');
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