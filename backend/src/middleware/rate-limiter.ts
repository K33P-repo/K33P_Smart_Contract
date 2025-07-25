import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Simple in-memory rate limiter
const requestCounts = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string;
}

export const createRateLimiter = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // Reset or initialize counter
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + options.windowMs
      });
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': options.max.toString(),
        'X-RateLimit-Remaining': (options.max - 1).toString(),
        'X-RateLimit-Reset': Math.floor(clientData?.resetTime || (now + options.windowMs) / 1000).toString(),
        'X-RateLimit-Window': Math.floor(options.windowMs / 1000).toString()
      });
      
      return next();
    }
    
    // Add rate limit headers
    const remaining = Math.max(0, options.max - clientData.count);
    res.set({
      'X-RateLimit-Limit': options.max.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.floor(clientData.resetTime / 1000).toString(),
      'X-RateLimit-Window': Math.floor(options.windowMs / 1000).toString()
    });
    
    if (clientData.count >= options.max) {
      logger.warn(`Rate limit exceeded for IP: ${clientId}`);
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
        timestamp: new Date().toISOString()
      });
    }
    
    clientData.count++;
    next();
  };
};

// Default rate limiter for seed phrase operations
export const rateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many seed phrase requests, please try again later.'
});