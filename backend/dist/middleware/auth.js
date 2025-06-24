// Authentication middleware for K33P Identity System
import jwt from 'jsonwebtoken';
/**
 * Middleware to verify JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyToken = (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Add user data to request
        req.user = decoded;
        next();
    }
    catch (error) {
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
 * This is a placeholder for actual ZK proof verification
 * In a real implementation, this would verify the ZK proof
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyZkProof = (req, res, next) => {
    try {
        const { proof, commitment } = req.body;
        if (!proof || !commitment) {
            return res.status(400).json({ error: 'Missing ZK proof or commitment' });
        }
        // In a real implementation, this would verify the ZK proof
        // For now, we'll just assume it's valid
        req.zkVerified = true;
        next();
    }
    catch (error) {
        console.error('ZK verification error:', error);
        res.status(500).json({ error: 'ZK verification failed' });
    }
};
export { verifyToken, verifyZkProof };
//# sourceMappingURL=auth.js.map