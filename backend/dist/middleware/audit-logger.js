import { logger } from '../utils/logger';
export const auditLogger = (action, resource) => {
    return (req, res, next) => {
        const startTime = Date.now();
        // Store original res.json to intercept response
        const originalJson = res.json;
        res.json = function (body) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            const auditData = {
                userId: req.user?.userId || req.user?.id,
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
            }
            else {
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
//# sourceMappingURL=audit-logger.js.map