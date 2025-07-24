import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface AuditLogData {
  userId?: string;
  action: string;
  resource: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  details?: any;
}

export const auditLogger = (action: string, resource: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(body: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const auditData: AuditLogData = {
        userId: (req as any).user?.userId || (req as any).user?.id,
        action,
        resource,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        timestamp: new Date(),
        success: res.statusCode < 400,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          requestSize: JSON.stringify(req.body || {}).length,
          responseSize: JSON.stringify(body || {}).length
        }
      };
      
      // Log audit event
      if (auditData.success) {
        logger.info('Audit Log', auditData);
      } else {
        logger.warn('Audit Log - Failed Operation', auditData);
      }
      
      // Call original json method
      return originalJson.call(this, body);
    };
    
    next();
  };
};

// Specific audit loggers for common operations
export const auditSeedPhraseAccess = auditLogger('ACCESS', 'SEED_PHRASE');
export const auditSeedPhraseStore = auditLogger('STORE', 'SEED_PHRASE');
export const auditSeedPhraseRetrieve = auditLogger('RETRIEVE', 'SEED_PHRASE');
export const auditUserLogin = auditLogger('LOGIN', 'USER_AUTH');
export const auditUserRegistration = auditLogger('REGISTER', 'USER_AUTH');