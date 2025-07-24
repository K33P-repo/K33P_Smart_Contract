// Main Express.js server for K33P Identity System
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import utxoRoutes from './routes/utxo.js';
import zkRoutes from './routes/zk.js';
import phoneRoutes from './routes/phone-management.js';
import recoveryRoutes from './routes/account-recovery.js';

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/utxo', utxoRoutes);
app.use('/api/zk', zkRoutes);
app.use('/api/phone', phoneRoutes);
app.use('/api/recovery', recoveryRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'K33P Backend API is running', 
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/status',
      '/api/version',
      '/api/auth/*',
      '/api/utxo/*',
      '/api/zk/*',
      '/api/user/profile'
    ]
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Status endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Version endpoint
app.get('/api/version', (req, res) => {
  res.status(200).json({
    version: '1.0.0',
    apiVersion: 'v1',
    buildDate: new Date().toISOString(),
    features: ['auth', 'utxo', 'zk', 'users']
  });
});

// User Profile endpoints
app.get('/api/user/profile', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'GET method not supported for user profile. Use POST with user data.' 
  });
});

app.post('/api/user/profile', (req, res) => {
  const { walletAddress, userId } = req.body;
  
  if (!walletAddress && !userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Either walletAddress or userId is required' 
    });
  }
  
  // Mock response for now
  res.status(200).json({
    success: true,
    data: {
      userId: userId || 'mock_user_id',
      userAddress: walletAddress || 'mock_wallet_address',
      verified: false,
      signupCompleted: false,
      refunded: false,
      amount: '0',
      createdAt: new Date().toISOString(),
      verificationAttempts: 0
    },
    message: 'User profile retrieved (mock data)'
  });
});

// Also keep the original endpoint for backward compatibility
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});