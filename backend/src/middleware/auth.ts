// Authentication middleware for K33P Identity System
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { verifyZkProof as zkVerify } from '../utils/zk.js';
import { ResponseUtils, ErrorCodes } from './error-handler.js';

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
      return ResponseUtils.error(res, ErrorCodes.AUTH_TOKEN_MISSING);
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    console.log('JWT Decoded:', decoded);
    // Debug: Log what's in the token
    console.log('JWT Decoded:', {
      id: decoded.id,
      user_id: decoded.user_id,
      userId: decoded.userId,
      walletAddress: decoded.walletAddress
    });
    
    // Extract the correct user ID
    // Priority: user_id (string) > id (could be UUID) > userId
    const userId = decoded.userId || decoded.user_id || decoded.id;
    
    if (!userId) {
      console.error('No user ID found in JWT token');
      return ResponseUtils.error(res, ErrorCodes.AUTH_TOKEN_INVALID);
    }
    
    // Add user data to request
    req.user = {
      id: userId,  // This should be the string ID
      userId: userId,  // For consistency
      walletAddress: decoded.walletAddress,
      phoneNumber: decoded.phoneNumber,
      username: decoded.username,
      // Include other fields as needed
      ...decoded
    };
    
    console.log('Request user assigned:', {
      id: req.user.id,
      userId: req.user.userId
    });
    
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return ResponseUtils.error(res, ErrorCodes.AUTH_TOKEN_EXPIRED);
    }
    if (error.name === 'JsonWebTokenError') {
      return ResponseUtils.error(res, ErrorCodes.AUTH_TOKEN_INVALID);
    }
    console.error('Auth middleware error:', error);
    return ResponseUtils.error(res, ErrorCodes.SERVER_ERROR, error, 'Authentication failed');
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
      return ResponseUtils.error(res, ErrorCodes.ZK_PROOF_REQUIRED);
    }
    
    // Validate proof structure
    if (!proof.publicInputs || !proof.publicInputs.commitment || typeof proof.isValid !== 'boolean') {
      return ResponseUtils.error(res, ErrorCodes.ZK_PROOF_INVALID, null, 'Invalid proof object structure. Expected: { publicInputs: { commitment: string }, isValid: boolean }');
    }
    
    // Use the actual ZK verification function
    const isValid = zkVerify(proof, commitment);
    
    if (!isValid) {
      return ResponseUtils.error(res, ErrorCodes.ZK_PROOF_INVALID);
    }
    
    req.zkVerified = true;
    next();
  } catch (error) {
    console.error('ZK verification error:', error);
    return ResponseUtils.error(res, ErrorCodes.ZK_PROOF_GENERATION_FAILED, error, 'ZK verification failed');
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