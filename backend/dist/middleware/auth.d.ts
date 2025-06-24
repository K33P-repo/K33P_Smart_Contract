/**
 * Middleware to verify JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function verifyToken(req: Object, res: Object, next: Function): any;
/**
 * Middleware to verify ZK proof
 * This is a placeholder for actual ZK proof verification
 * In a real implementation, this would verify the ZK proof
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function verifyZkProof(req: Object, res: Object, next: Function): any;
/**
 * Middleware to verify JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function authenticate(req: Object, res: Object, next: Function): any;
//# sourceMappingURL=auth.d.ts.map