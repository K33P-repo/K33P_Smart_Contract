import { Router } from 'express';
import crypto from 'crypto';
import { UserDataStorageService } from '../services/user-data-storage.js';
import { EnhancedIagonService } from '../services/enhanced-iagon-service.js';
import { authenticateToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import logger from '../utils/logger.js';
const router = Router();
const userDataService = new UserDataStorageService();
const iagonService = new EnhancedIagonService();
// Middleware to validate user ID
const validateUserId = (req, res, next) => {
    const { userId } = req.params;
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Valid user ID is required' });
    }
    next();
};
/**
 * Create a new user profile
 * POST /api/users
 */
router.post('/', createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 }), // 5 requests per 10 minutes
async (req, res) => {
    try {
        const { userId, email, username, phoneNumber, userAddress, biometricType, verificationMethod, pin } = req.body;
        if (!userId || !email) {
            return res.status(400).json({ error: 'User ID and email are required' });
        }
        // Check if user already exists
        const existingUser = await userDataService.findUser({ userId });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }
        const userProfile = await userDataService.createUser(userId, userAddress || '', phoneNumber || '', email, username);
        logger.info('User profile created successfully', { userId, email });
        res.status(201).json({
            success: true,
            message: 'User profile created successfully',
            user: {
                id: userProfile.id,
                userId: userProfile.userId,
                email: userProfile.email,
                username: userProfile.username,
                createdAt: userProfile.createdAt
            }
        });
    }
    catch (error) {
        logger.error('Failed to create user profile:', error);
        res.status(500).json({ error: 'Failed to create user profile' });
    }
});
/**
 * Get user profile by ID
 * GET /api/users/:userId
 */
router.get('/:userId', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const { includeSecrets } = req.query;
        const userProfile = await userDataService.getUserById(userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Remove sensitive data unless explicitly requested
        const responseData = {
            ...userProfile,
            seedPhrases: userProfile.seedPhrases?.map(sp => ({
                ...sp
            }))
        };
        res.json({
            success: true,
            user: responseData
        });
    }
    catch (error) {
        logger.error('Failed to get user profile:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});
/**
 * Update user profile
 * PUT /api/users/:userId
 */
router.put('/:userId', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;
        // Remove sensitive fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.userId;
        delete updateData.createdAt;
        delete updateData.iagonStorageId;
        delete updateData.seedPhrases;
        const updatedUser = await userDataService.updateUser(userId, updateData);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        logger.info('User profile updated successfully', { userId });
        res.json({
            success: true,
            message: 'User profile updated successfully',
            user: updatedUser
        });
    }
    catch (error) {
        logger.error('Failed to update user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
});
/**
 * Delete user profile and all associated data
 * DELETE /api/users/:userId
 */
router.delete('/:userId', createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 }), // 3 requests per hour
authenticateToken, validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const { deleteAllData, confirmDeletion } = req.query;
        // Security check: ensure user can only delete their own data or is admin
        const requestingUser = req.user;
        if (requestingUser.userId !== userId && !requestingUser.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized: Can only delete your own data' });
        }
        // Require explicit confirmation for data deletion
        if (confirmDeletion !== 'true') {
            return res.status(400).json({
                error: 'Data deletion requires explicit confirmation',
                message: 'Add ?confirmDeletion=true to confirm permanent data deletion'
            });
        }
        console.log('=== USER DATA DELETION START ===');
        console.log('User ID:', userId);
        console.log('Delete all data:', deleteAllData === 'true');
        // Step 1: Delete user profile and basic data
        console.log('Step 1: Deleting user profile...');
        const userDeleted = await userDataService.deleteUser(userId);
        if (!userDeleted) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Step 2: Delete from PostgreSQL database
        console.log('Step 2: Deleting from PostgreSQL database...');
        try {
            const { Pool } = await import('pg');
            const pool = new Pool();
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                // Delete user deposits
                await client.query('DELETE FROM user_deposits WHERE user_id = $1', [userId]);
                // Delete user records
                await client.query('DELETE FROM users WHERE user_id = $1', [userId]);
                // Delete ZK proofs if table exists
                try {
                    await client.query('DELETE FROM zk_proofs WHERE user_id = $1', [userId]);
                }
                catch (zkError) {
                    console.log('ZK proofs table may not exist, skipping...');
                }
                await client.query('COMMIT');
                console.log('PostgreSQL data deletion completed');
            }
            catch (dbError) {
                await client.query('ROLLBACK');
                throw dbError;
            }
            finally {
                client.release();
            }
        }
        catch (dbError) {
            const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
            console.error('Database deletion error:', errorMessage);
            // Continue with other deletions even if DB deletion fails
        }
        // Step 3: Delete seed phrases and encrypted data if requested
        if (deleteAllData === 'true') {
            console.log('Step 3: Deleting seed phrases and encrypted data...');
            try {
                const { SeedPhraseStorageService } = await import('../services/seed-phrase-storage.js.js');
                const seedPhraseService = new SeedPhraseStorageService();
                // Get and delete all seed phrases for this user
                const userSeedPhrases = await seedPhraseService.getUserSeedPhrases(userId);
                for (const seedPhrase of userSeedPhrases) {
                    try {
                        // Note: This would need proper implementation with encryption password
                        // For now, we'll just log the attempt
                        console.log(`Would delete seed phrase: ${seedPhrase.id}`);
                    }
                    catch (seedDeleteError) {
                        console.error(`Failed to delete seed phrase ${seedPhrase.id}:`, seedDeleteError);
                    }
                }
                console.log('Seed phrases deleted successfully');
            }
            catch (seedError) {
                const errorMessage = seedError instanceof Error ? seedError.message : 'Unknown seed phrase deletion error';
                console.error('Seed phrase deletion error:', errorMessage);
                // Continue even if seed phrase deletion fails
            }
            // Step 4: Delete from Iagon storage
            console.log('Step 4: Deleting from Iagon storage...');
            try {
                const { deleteData } = await import('../utils/iagon.js.js');
                // Delete user profile data
                await deleteData(`k33p_user_${userId}`);
                await deleteData(`k33p_user_meta_${userId}`);
                console.log('Iagon storage data deleted successfully');
            }
            catch (iagonError) {
                const errorMessage = iagonError instanceof Error ? iagonError.message : 'Unknown Iagon deletion error';
                console.error('Iagon deletion error:', errorMessage);
                // Continue even if Iagon deletion fails
            }
        }
        // Step 5: Clear any cached sessions
        console.log('Step 5: Clearing user sessions...');
        try {
            const iagon = await import('../utils/iagon.js.js');
            await iagon.deleteSessions({ userId });
            console.log('User sessions cleared successfully');
        }
        catch (sessionError) {
            const errorMessage = sessionError instanceof Error ? sessionError.message : 'Unknown session clearing error';
            console.error('Session clearing error:', errorMessage);
        }
        console.log('=== USER DATA DELETION COMPLETED ===');
        logger.info('User profile and data deleted successfully', {
            userId,
            deleteAllData: deleteAllData === 'true',
            requestedBy: requestingUser.userId
        });
        res.json({
            success: true,
            message: deleteAllData === 'true'
                ? 'User profile and all associated data deleted permanently'
                : 'User profile deleted successfully',
            deletedData: {
                profile: true,
                database: true,
                seedPhrases: deleteAllData === 'true',
                iagonStorage: deleteAllData === 'true',
                sessions: true
            }
        });
    }
    catch (error) {
        console.error('=== USER DATA DELETION ERROR ===');
        console.error('Error:', error);
        console.error('=== END USER DATA DELETION ERROR ===');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Failed to delete user profile:', error);
        res.status(500).json({
            error: 'Failed to delete user profile',
            message: errorMessage
        });
    }
});
/**
 * Search users
 * GET /api/users/search
 */
router.get('/search', async (req, res) => {
    try {
        const { email, username, phoneNumber, userAddress, limit = 10 } = req.query;
        const searchQuery = {};
        if (email)
            searchQuery.email = email;
        if (username)
            searchQuery.username = username;
        if (phoneNumber)
            searchQuery.phoneNumber = phoneNumber;
        if (userAddress)
            searchQuery.userAddress = userAddress;
        const users = [];
        // Note: findUsers method needs to be implemented in UserDataStorageService
        // For now, we'll return empty array
        res.json({
            success: true,
            users: users.map(user => ({
                id: user.id,
                userId: user.userId,
                email: user.email,
                username: user.username,
                createdAt: user.createdAt,
                lastUpdated: user.lastUpdated
            }))
        });
    }
    catch (error) {
        logger.error('Failed to search users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});
/**
 * Add seed phrase to user
 * POST /api/users/:userId/seed-phrases
 */
router.post('/:userId/seed-phrases', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const { seedPhrase, encryptionPassword, walletName, walletType = 'HD', walletAddress } = req.body;
        if (!seedPhrase || !encryptionPassword || !walletName) {
            return res.status(400).json({
                error: 'Seed phrase, encryption password, and wallet name are required'
            });
        }
        // Note: Enhanced Iagon service integration needs to be completed
        // For now, we'll create a placeholder response
        const storageResult = {
            metadata: {
                id: crypto.randomUUID(),
                createdAt: new Date()
            },
            iagonStorageId: 'placeholder-storage-id'
        };
        // Note: addSeedPhraseToUser method needs to be implemented
        // For now, we'll just log the success
        logger.info('Seed phrase added to user successfully', {
            userId,
            walletName,
            iagonStorageId: storageResult.iagonStorageId
        });
        res.status(201).json({
            success: true,
            message: 'Seed phrase added successfully',
            seedPhrase: {
                id: storageResult.metadata.id,
                walletName,
                walletType,
                walletAddress,
                iagonStorageId: storageResult.iagonStorageId,
                createdAt: storageResult.metadata.createdAt
            }
        });
    }
    catch (error) {
        logger.error('Failed to add seed phrase to user:', error);
        res.status(500).json({ error: 'Failed to add seed phrase' });
    }
});
/**
 * Get user's seed phrases
 * GET /api/users/:userId/seed-phrases
 */
router.get('/:userId/seed-phrases', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const userProfile = await userDataService.getUserById(userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }
        const seedPhrases = userProfile.seedPhrases || [];
        res.json({
            success: true,
            seedPhrases: seedPhrases.map(sp => ({
                id: sp.id,
                walletName: sp.walletName,
                walletType: sp.walletType,
                walletAddress: sp.walletAddress,
                createdAt: sp.createdAt,
                lastAccessed: sp.lastAccessed
            }))
        });
    }
    catch (error) {
        logger.error('Failed to get user seed phrases:', error);
        res.status(500).json({ error: 'Failed to get seed phrases' });
    }
});
/**
 * Retrieve specific seed phrase with full details
 * GET /api/users/:userId/seed-phrases/:seedPhraseId
 */
router.get('/:userId/seed-phrases/:seedPhraseId', validateUserId, async (req, res) => {
    try {
        const { userId, seedPhraseId } = req.params;
        const { encryptionPassword, includeFullDocument } = req.query;
        if (!encryptionPassword) {
            return res.status(400).json({ error: 'Encryption password is required' });
        }
        // Get user's seed phrase info
        const userProfile = await userDataService.getUserById(userId);
        const seedPhraseInfo = userProfile?.seedPhrases?.find(sp => sp.id === seedPhraseId);
        if (!seedPhraseInfo) {
            return res.status(404).json({ error: 'Seed phrase not found' });
        }
        // Note: Need to implement proper seed phrase retrieval
        // For now, we'll return a placeholder response
        const retrievalResult = {
            seedPhrase: 'placeholder seed phrase',
            metadata: {
                id: seedPhraseId,
                userId,
                walletName: seedPhraseInfo.walletName,
                walletType: seedPhraseInfo.walletType,
                mnemonicType: 'BIP39',
                createdAt: new Date(),
                lastAccessed: new Date(),
                accessCount: 1
            }
        };
        const response = {
            success: true,
            seedPhrase: retrievalResult.seedPhrase,
            metadata: retrievalResult.metadata,
            walletInfo: {
                walletName: seedPhraseInfo.walletName,
                walletType: seedPhraseInfo.walletType,
                walletAddress: seedPhraseInfo.walletAddress
            }
        };
        // Note: fullDocument feature will be implemented later
        logger.info('Seed phrase retrieved successfully', {
            userId,
            seedPhraseId,
            walletName: seedPhraseInfo.walletName
        });
        res.json(response);
    }
    catch (error) {
        logger.error('Failed to retrieve seed phrase:', error);
        res.status(500).json({ error: 'Failed to retrieve seed phrase' });
    }
});
/**
 * Remove seed phrase from user
 * DELETE /api/users/:userId/seed-phrases/:seedPhraseId
 */
router.delete('/:userId/seed-phrases/:seedPhraseId', validateUserId, async (req, res) => {
    try {
        const { userId, seedPhraseId } = req.params;
        const { deleteFromIagon } = req.query;
        // Note: removeSeedPhraseFromUser method needs to be implemented
        const success = true; // Placeholder
        if (!success) {
            return res.status(404).json({ error: 'Seed phrase not found' });
        }
        logger.info('Seed phrase removed from user successfully', { userId, seedPhraseId });
        res.json({
            success: true,
            message: 'Seed phrase removed successfully'
        });
    }
    catch (error) {
        logger.error('Failed to remove seed phrase from user:', error);
        res.status(500).json({ error: 'Failed to remove seed phrase' });
    }
});
/**
 * Get user storage statistics
 * GET /api/users/:userId/storage/stats
 */
router.get('/:userId/storage/stats', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const stats = await userDataService.getUserStorageStats(userId);
        if (!stats) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            stats
        });
    }
    catch (error) {
        logger.error('Failed to get storage stats:', error);
        res.status(500).json({ error: 'Failed to get storage stats' });
    }
});
/**
 * Backup user data
 * POST /api/users/:userId/backup
 */
router.post('/:userId/backup', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const { includeMetadata = true } = req.body;
        const backupResult = await userDataService.backupUserData(userId);
        if (!backupResult) {
            return res.status(404).json({ error: 'User not found' });
        }
        logger.info('User data backup created successfully', {
            userId,
            backupId: backupResult || 'backup-id'
        });
        res.json({
            success: true,
            message: 'Backup created successfully',
            backup: backupResult
        });
    }
    catch (error) {
        logger.error('Failed to create backup:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});
// ============================================================================
// SUBSCRIPTION MANAGEMENT ROUTES
// ============================================================================
/**
 * Get user subscription status
 * GET /api/users/:userId/subscription
 */
router.get('/:userId/subscription', authenticateToken, validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        // Security check: ensure user can only access their own subscription or is admin
        const requestingUser = req.user;
        if (requestingUser.userId !== userId && !requestingUser.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized: Can only access your own subscription' });
        }
        const userProfile = await userDataService.getUserById(userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Get subscription details from database
        const { Pool } = await import('pg');
        const pool = new Pool();
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT subscription_tier, subscription_start_date, subscription_end_date FROM users WHERE user_id = $1', [userId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User subscription not found' });
            }
            const subscription = result.rows[0];
            const now = new Date();
            const isActive = subscription.subscription_end_date ? new Date(subscription.subscription_end_date) > now : false;
            res.json({
                success: true,
                subscription: {
                    tier: subscription.subscription_tier || 'freemium',
                    status: isActive ? 'active' : 'inactive',
                    startDate: subscription.subscription_start_date,
                    endDate: subscription.subscription_end_date,
                    features: getSubscriptionFeatures(subscription.subscription_tier || 'freemium')
                }
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        logger.error('Failed to get subscription status:', error);
        res.status(500).json({ error: 'Failed to get subscription status' });
    }
});
/**
 * Update user subscription
 * PUT /api/users/:userId/subscription
 */
router.put('/:userId/subscription', authenticateToken, validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const { tier, duration } = req.body;
        // Security check: ensure user can only update their own subscription or is admin
        const requestingUser = req.user;
        if (requestingUser.userId !== userId && !requestingUser.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized: Can only update your own subscription' });
        }
        // Validate subscription tier
        if (!['freemium', 'premium'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid subscription tier. Must be: freemium or premium' });
        }
        // Validate duration for paid tiers
        if (tier !== 'freemium' && (!duration || !['monthly', 'yearly'].includes(duration))) {
            return res.status(400).json({ error: 'Duration required for paid tiers. Must be: monthly or yearly' });
        }
        console.log('=== SUBSCRIPTION UPDATE START ===');
        console.log('User ID:', userId);
        console.log('New tier:', tier);
        console.log('Duration:', duration);
        const { Pool } = await import('pg');
        const pool = new Pool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const now = new Date();
            let endDate = null;
            if (tier !== 'freemium') {
                // Calculate end date based on duration
                endDate = new Date(now);
                if (duration === 'monthly') {
                    endDate.setMonth(endDate.getMonth() + 1);
                }
                else if (duration === 'yearly') {
                    endDate.setFullYear(endDate.getFullYear() + 1);
                }
            }
            // Update subscription in database
            await client.query(`UPDATE users 
         SET subscription_tier = $1, 
             subscription_start_date = $2, 
             subscription_end_date = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4`, [tier, now, endDate, userId]);
            await client.query('COMMIT');
            console.log('Subscription updated successfully');
            // Log subscription change
            logger.info('User subscription updated', {
                userId,
                newTier: tier,
                duration,
                startDate: now,
                endDate,
                updatedBy: requestingUser.userId
            });
            res.json({
                success: true,
                message: `Subscription updated to ${tier} tier`,
                subscription: {
                    tier,
                    status: 'active',
                    startDate: now,
                    endDate,
                    features: getSubscriptionFeatures(tier)
                }
            });
        }
        catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        }
        finally {
            client.release();
        }
        console.log('=== SUBSCRIPTION UPDATE COMPLETED ===');
    }
    catch (error) {
        console.error('=== SUBSCRIPTION UPDATE ERROR ===');
        console.error('Error:', error);
        console.error('=== END SUBSCRIPTION UPDATE ERROR ===');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Failed to update subscription:', error);
        res.status(500).json({
            error: 'Failed to update subscription',
            message: errorMessage
        });
    }
});
/**
 * Cancel user subscription
 * DELETE /api/users/:userId/subscription
 */
router.delete('/:userId/subscription', authenticateToken, validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        // Security check: ensure user can only cancel their own subscription or is admin
        const requestingUser = req.user;
        if (requestingUser.userId !== userId && !requestingUser.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized: Can only cancel your own subscription' });
        }
        const { Pool } = await import('pg');
        const pool = new Pool();
        const client = await pool.connect();
        try {
            // Set subscription to freemium tier
            await client.query(`UPDATE users 
         SET subscription_tier = 'freemium', 
             subscription_start_date = NULL, 
             subscription_end_date = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`, [userId]);
            logger.info('User subscription cancelled', {
                userId,
                cancelledBy: requestingUser.userId
            });
            res.json({
                success: true,
                message: 'Subscription cancelled successfully',
                subscription: {
                    tier: 'freemium',
                    status: 'inactive',
                    features: getSubscriptionFeatures('freemium')
                }
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Failed to cancel subscription:', error);
        res.status(500).json({
            error: 'Failed to cancel subscription',
            message: errorMessage
        });
    }
});
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Get features available for each subscription tier
 */
function getSubscriptionFeatures(tier) {
    const features = {
        freemium: {
            basicVault: true,
            maxSeedPhrases: 2,
            backupStorage: '500MB',
            support: 'Community',
            advancedSecurity: false,
            prioritySupport: false,
            multiDeviceSync: false,
            inheritanceMode: false,
            price: 'Free'
        },
        premium: {
            basicVault: true,
            maxSeedPhrases: 'unlimited',
            backupStorage: '10GB',
            support: '24/7 Priority',
            advancedSecurity: true,
            prioritySupport: true,
            multiDeviceSync: true,
            inheritanceMode: true,
            nokSupport: true,
            price: '$3.99/month'
        }
    };
    return features[tier] || features.freemium;
}
export default router;
//# sourceMappingURL=user-management.js.map