// Authentication middleware for K33P Identity System
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { verifyZkProof as zkVerify } from '../utils/zk.js';

interface AuthenticatedRequest extends Request {
  user?: any;
  zkVerified?: boolean;
}

/**
 * Middleware to verify JWT token
 */
export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    // Add user data to request
    req.user = decoded;
    
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to verify ZK proof
 * Uses the actual ZK proof verification function
 */
export const verifyZkProof = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { proof, commitment } = req.body;
    
    if (!proof || !commitment) {
      return res.status(400).json({ error: 'Missing ZK proof or commitment' });
    }
    
    // Validate proof structure
    if (!proof.publicInputs || !proof.publicInputs.commitment || typeof proof.isValid !== 'boolean') {
      return res.status(400).json({ error: 'Invalid proof object structure. Expected: { publicInputs: { commitment: string }, isValid: boolean }' });
    }
    
    // Use the actual ZK verification function
    const isValid = zkVerify(proof, commitment);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid ZK proof' });
    }
    
    req.zkVerified = true;
    next();
  } catch (error) {
    console.error('ZK verification error:', error);
    res.status(500).json({ error: 'ZK verification failed' });
  }
};

/**
 * Middleware to authenticate users
 * This is an alias for verifyToken to maintain backward compatibility
 */
export const authenticate = verifyToken;

/**
 * Middleware to authenticate token - main export for routes
 */
export const authenticateToken = verifyToken;

export default {
  verifyToken,
  verifyZkProof,
  authenticate,
  authenticateToken
};