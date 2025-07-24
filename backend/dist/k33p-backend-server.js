import express from 'express';
import { body, param, validationResult } from 'express-validator';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { EnhancedK33PManagerDB } from './enhanced-k33p-manager-db.js';
import { dbService } from './database/service.js';
import { autoRefundMonitor } from './services/auto-refund-monitor.js';
import { MockDatabaseService } from './database/mock-service.js';
import { testConnection } from './database/config.js';
import winston from 'winston';
// Import routes
// @ts-ignore
import zkRoutes from './routes/zk.js';
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
// Load environment variables
dotenv.config();
// Constants
const PORT = process.env.PORT || 3000;
// Initialize logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    defaultMeta: { service: 'k33p-backend' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});
// Initialize K33P Manager with Database
let k33pManager;
let usingMockDatabase = false;
async function initializeK33P() {
    try {
        // Test PostgreSQL connection first
        const dbConnected = await testConnection();
        if (!dbConnected) {
            logger.warn('PostgreSQL connection failed, initializing mock database...');
            await MockDatabaseService.initialize();
            usingMockDatabase = true;
            logger.info('✅ Mock database initialized successfully');
        }
        k33pManager = new EnhancedK33PManagerDB();
        await k33pManager.initialize();
        logger.info('K33P Manager with Database initialized successfully');
        // Initialize and start auto-refund monitor (only if PostgreSQL is available)
        if (!usingMockDatabase) {
            try {
                await autoRefundMonitor.initialize();
                await autoRefundMonitor.start();
                logger.info('🚀 Auto-Refund Monitor started - 2 ADA deposits will be automatically refunded');
            }
            catch (error) {
                logger.warn('Auto-Refund Monitor failed to start (using mock database):', error);
            }
        }
        else {
            logger.info('📝 Running in mock database mode - Auto-Refund Monitor disabled');
        }
    }
    catch (error) {
        logger.error('Failed to initialize K33P Manager with Database:', error);
        throw error;
    }
}
// Create Express app
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
// Request logging middleware
app.use((req, res, next) => {
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
// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json(createResponse(false, undefined, undefined, errors.array()[0].msg));
    }
    next();
};
function createResponse(success, data, meta, message) {
    return {
        success,
        data,
        meta,
        message,
        timestamp: new Date().toISOString()
    };
}
// ============================================================================
// ROUTES
// ============================================================================
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json(createResponse(true, { status: 'ok' }, undefined, 'K33P Backend is running'));
});
// API Status endpoint
app.get('/api/status', (req, res) => {
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
app.get('/api/version', (req, res) => {
    res.json(createResponse(true, {
        version: '1.0.0',
        apiVersion: 'v1',
        buildDate: new Date().toISOString(),
        features: ['auth', 'utxo', 'zk', 'users']
    }, undefined, 'API version information'));
});
// User Profile endpoints
app.get('/api/user/profile', (req, res) => {
    res.status(404).json(createResponse(false, undefined, undefined, 'GET method not supported for user profile. Use POST with user data.'));
});
app.post('/api/user/profile', async (req, res) => {
    try {
        const { walletAddress, userId } = req.body;
        if (!walletAddress && !userId) {
            return res.status(400).json(createResponse(false, undefined, undefined, 'Either walletAddress or userId is required'));
        }
        // Try to find user by wallet address or user ID
        let userDeposit;
        if (walletAddress) {
            userDeposit = await dbService.getDepositByUserAddress(walletAddress);
        }
        else if (userId) {
            // Find by user ID (this would need to be implemented in dbService)
            const deposits = await dbService.getAllDeposits();
            userDeposit = deposits.find((d) => d.user_id === userId);
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
    }
    catch (error) {
        logger.error('Error getting user profile:', error);
        res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get user profile'));
    }
});
// Root endpoint
app.get('/', (req, res) => {
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
            '/api/user/profile'
        ]
    }, undefined, 'Welcome to K33P Backend API'));
});
// Get deposit address
app.get('/api/deposit-address', async (req, res) => {
    try {
        const address = await k33pManager.getDepositAddress();
        res.json(createResponse(true, { address }, undefined, 'Deposit address retrieved'));
    }
    catch (error) {
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
], handleValidationErrors, async (req, res) => {
    try {
        const { userAddress } = req.body;
        logger.info('Retrying verification', { userAddress });
        const result = await k33pManager.retryVerification(userAddress);
        if (result.success) {
            res.json(createResponse(true, { verified: true }, result.message));
        }
        else {
            res.status(400).json(createResponse(false, undefined, undefined, result.message));
        }
    }
    catch (error) {
        logger.error('Error retrying verification:', error);
        res.status(500).json(createResponse(false, undefined, undefined, 'Failed to retry verification'));
    }
});
// Get user status
app.get('/api/user/:address/status', [
    param('address')
        .isLength({ min: 50, max: 200 })
        .withMessage('Invalid user address format')
], handleValidationErrors, async (req, res) => {
    try {
        const userAddress = req.params.address;
        const userDeposit = await dbService.getDepositByUserAddress(userAddress);
        if (!userDeposit) {
            return res.status(404).json(createResponse(false, undefined, undefined, 'User not found'));
        }
        const status = {
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
    }
    catch (error) {
        logger.error('Error getting user status:', error);
        res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get user status'));
    }
});
// Get all users (admin endpoint)
app.get('/api/admin/users', async (req, res) => {
    try {
        // Add admin authentication here in production
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.ADMIN_API_KEY) {
            return res.status(401).json(createResponse(false, undefined, undefined, 'Unauthorized'));
        }
        const deposits = await dbService.getAllDeposits();
        const users = deposits.map((d) => ({
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
    }
    catch (error) {
        logger.error('Error getting all users:', error);
        res.status(500).json(createResponse(false, undefined, undefined, 'Failed to get users'));
    }
});
// Auto-verify all unverified deposits (admin endpoint)
app.post('/api/admin/auto-verify', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.ADMIN_API_KEY) {
            return res.status(401).json(createResponse(false, undefined, undefined, 'Unauthorized'));
        }
        logger.info('Starting auto-verification process');
        await k33pManager.autoVerifyDeposits();
        res.json(createResponse(true, undefined, 'Auto-verification completed'));
    }
    catch (error) {
        logger.error('Error during auto-verification:', error);
        res.status(500).json(createResponse(false, undefined, undefined, 'Auto-verification failed'));
    }
});
// Monitor incoming transactions (admin endpoint)
app.get('/api/admin/monitor', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.ADMIN_API_KEY) {
            return res.status(401).json(createResponse(false, undefined, undefined, 'Unauthorized'));
        }
        await k33pManager.monitorIncomingTransactions();
        res.json(createResponse(true, undefined, 'Transaction monitoring completed'));
    }
    catch (error) {
        logger.error('Error monitoring transactions:', error);
        res.status(500).json(createResponse(false, undefined, undefined, 'Transaction monitoring failed'));
    }
});
// Process signup completion (admin endpoint)
app.post('/api/admin/process-signup', [
    body('userAddress')
        .isLength({ min: 50, max: 200 })
        .withMessage('Invalid user address format')
], handleValidationErrors, async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.ADMIN_API_KEY) {
            return res.status(401).json(createResponse(false, undefined, undefined, 'Unauthorized'));
        }
        const { userAddress } = req.body;
        logger.info('Processing signup completion', { userAddress });
        const txHash = await k33pManager.processSignup(userAddress);
        res.json(createResponse(true, { txHash }, 'Signup processed successfully'));
    }
    catch (error) {
        logger.error('Error processing signup:', error);
        res.status(500).json(createResponse(false, undefined, undefined, error instanceof Error ? error.message : 'Failed to process signup'));
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
], handleValidationErrors, async (req, res) => {
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
    }
    catch (error) {
        logger.error('Error processing refund:', error);
        res.status(500).json(createResponse(false, undefined, undefined, error instanceof Error ? error.message : 'Failed to process refund'));
    }
});
// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json(createResponse(false, undefined, undefined, 'Internal server error'));
});
// 404 handler
app.use((req, res) => {
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
    }
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Start the server
startServer();
export { app };
//# sourceMappingURL=k33p-backend-server.js.map