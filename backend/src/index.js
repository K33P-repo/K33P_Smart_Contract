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

// Root route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'K33P Backend API is running. See /api/health for status.' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
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