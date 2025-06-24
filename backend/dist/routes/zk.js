// Zero-Knowledge Proof routes for K33P Identity System
import express from 'express';
import { poseidonHash, generateZkCommitment, generateZkProof, verifyZkProof } from '../utils/zk.js';
import { findUser } from '../utils/iagon.js';
import { verifyToken } from '../middleware/auth.js';
const router = express.Router();
/**
 * Generate a ZK commitment from user inputs
 * @route POST /api/zk/commitment
 */
router.post('/commitment', async (req, res) => {
    try {
        const { phone, biometric, passkey } = req.body;
        // Validate inputs
        if (!phone || !biometric || !passkey) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required inputs: phone, biometric, and passkey are required'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Hash the inputs
        const phoneHash = poseidonHash([phone]);
        const biometricHash = poseidonHash([biometric]);
        const passkeyHash = poseidonHash([passkey]);
        // Generate a commitment from the hashed inputs
        const commitment = generateZkCommitment({ phoneHash, biometricHash, passkeyHash });
        // Return the commitment and hashes
        return res.status(200).json({
            success: true,
            data: {
                commitment,
                hashes: {
                    phoneHash,
                    biometricHash,
                    passkeyHash
                }
            },
            message: 'ZK commitment generated successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error generating ZK commitment:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to generate ZK commitment'
            },
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * Generate a ZK proof
 * @route POST /api/zk/proof
 */
router.post('/proof', async (req, res) => {
    try {
        const { phone, biometric, passkey, commitment } = req.body;
        // Validate inputs
        if (!phone || !biometric || !passkey || !commitment) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required inputs: phone, biometric, passkey, and commitment are required'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Generate a proof
        const proof = generateZkProof({ phone, biometric, passkey }, commitment);
        // Check if the proof is valid
        if (!proof.isValid) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'ZK_VERIFICATION_FAILED',
                    message: 'Failed to generate a valid ZK proof',
                    details: proof.error || 'Unknown error'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Return the proof
        return res.status(200).json({
            success: true,
            data: proof,
            message: 'ZK proof generated successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error generating ZK proof:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to generate ZK proof'
            },
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * Verify a ZK proof
 * @route POST /api/zk/verify
 */
router.post('/verify', async (req, res) => {
    try {
        const { proof, commitment } = req.body;
        // Validate inputs
        if (!proof || !commitment) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required inputs: proof and commitment are required'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Verify the proof
        const isValid = verifyZkProof(proof, commitment);
        // Return the verification result
        return res.status(200).json({
            success: true,
            data: {
                isValid
            },
            message: isValid ? 'ZK proof verified successfully' : 'ZK proof verification failed',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error verifying ZK proof:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to verify ZK proof'
            },
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * Login with ZK proof
 * @route POST /api/zk/login
 */
router.post('/login', async (req, res) => {
    try {
        const { walletAddress, phone, proof, commitment } = req.body;
        // Validate inputs
        if (!proof || !commitment) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required inputs: proof and commitment are required'
                },
                timestamp: new Date().toISOString()
            });
        }
        if (!walletAddress && !phone) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Either walletAddress or phone must be provided'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Find the user by wallet address or phone hash
        let user;
        try {
            if (walletAddress) {
                user = await findUser({ walletAddress });
            }
            else if (phone) {
                const phoneHash = poseidonHash([phone]);
                user = await findUser({ phoneHash });
            }
        }
        catch (error) {
            console.error('Error finding user:', error);
            return res.status(500).json({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Failed to find user, Iagon API may be unavailable',
                    details: error.message
                },
                timestamp: new Date().toISOString()
            });
        }
        // Check if the user exists
        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Verify the ZK proof
        const isValid = verifyZkProof(proof, commitment);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'ZK_VERIFICATION_FAILED',
                    message: 'ZK proof verification failed'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Check if the commitment matches the user's commitment
        if (user.zkCommitment !== commitment) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid commitment for this user'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Login successful
        return res.status(200).json({
            success: true,
            data: {
                message: 'ZK login successful',
                userId: user.userId,
                token: 'jwt_token_would_be_generated_here'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error during ZK login:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to login with ZK proof',
                details: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * Get a user's ZK commitment
 * @route GET /api/zk/user/:userId
 */
router.get('/user/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        // Validate inputs
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required parameter: userId'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Find the user by userId
        let user;
        try {
            user = await findUser({ userId });
        }
        catch (error) {
            console.error('Error finding user:', error);
            return res.status(500).json({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Failed to find user, Iagon API may be unavailable',
                    details: error.message
                },
                timestamp: new Date().toISOString()
            });
        }
        // Check if the user exists
        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                },
                timestamp: new Date().toISOString()
            });
        }
        // Return the user's ZK commitment
        return res.status(200).json({
            success: true,
            data: {
                userId: user.userId,
                zkCommitment: user.zkCommitment
            },
            message: 'User ZK commitment retrieved successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error retrieving user ZK commitment:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to retrieve user ZK commitment'
            },
            timestamp: new Date().toISOString()
        });
    }
});
export default router;
//# sourceMappingURL=zk.js.map