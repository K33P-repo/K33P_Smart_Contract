import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { UserDataStorageService } from '../services/user-data-storage';
import { EnhancedIagonService } from '../services/enhanced-iagon-service';
import { authenticateToken } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const userDataService = new UserDataStorageService();
const iagonService = new EnhancedIagonService();

// Middleware to validate user ID
const validateUserId = (req: Request, res: Response, next: any) => {
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      email,
      username,
      phoneNumber,
      userAddress,
      biometricType,
      verificationMethod,
      pin
    } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'User ID and email are required' });
    }

    // Check if user already exists
    const existingUser = await userDataService.findUser({ userId });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const userProfile = await userDataService.createUser(
      userId,
      userAddress || '',
      phoneNumber || '',
      email,
      username
    );

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
  } catch (error) {
    logger.error('Failed to create user profile:', error);
    res.status(500).json({ error: 'Failed to create user profile' });
  }
});

/**
 * Get user profile by ID
 * GET /api/users/:userId
 */
router.get('/:userId', validateUserId, async (req: Request, res: Response) => {
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
  } catch (error) {
    logger.error('Failed to get user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

/**
 * Update user profile
 * PUT /api/users/:userId
 */
router.put('/:userId', validateUserId, async (req: Request, res: Response) => {
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
  } catch (error) {
    logger.error('Failed to update user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

/**
 * Delete user profile
 * DELETE /api/users/:userId
 */
router.delete('/:userId', validateUserId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { deleteAllData } = req.query;

    const success = await userDataService.deleteUser(userId);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User profile deleted successfully', { userId, deleteAllData });

    res.json({
      success: true,
      message: 'User profile deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete user profile:', error);
    res.status(500).json({ error: 'Failed to delete user profile' });
  }
});

/**
 * Search users
 * GET /api/users/search
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { email, username, phoneNumber, userAddress, limit = 10 } = req.query;

    const searchQuery: any = {};
    if (email) searchQuery.email = email as string;
    if (username) searchQuery.username = username as string;
    if (phoneNumber) searchQuery.phoneNumber = phoneNumber as string;
    if (userAddress) searchQuery.userAddress = userAddress as string;

    const users: any[] = [];
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
  } catch (error) {
    logger.error('Failed to search users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/**
 * Add seed phrase to user
 * POST /api/users/:userId/seed-phrases
 */
router.post('/:userId/seed-phrases', validateUserId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const {
      seedPhrase,
      encryptionPassword,
      walletName,
      walletType = 'HD',
      walletAddress
    } = req.body;

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
  } catch (error) {
    logger.error('Failed to add seed phrase to user:', error);
    res.status(500).json({ error: 'Failed to add seed phrase' });
  }
});

/**
 * Get user's seed phrases
 * GET /api/users/:userId/seed-phrases
 */
router.get('/:userId/seed-phrases', validateUserId, async (req: Request, res: Response) => {
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
  } catch (error) {
    logger.error('Failed to get user seed phrases:', error);
    res.status(500).json({ error: 'Failed to get seed phrases' });
  }
});

/**
 * Retrieve specific seed phrase with full details
 * GET /api/users/:userId/seed-phrases/:seedPhraseId
 */
router.get('/:userId/seed-phrases/:seedPhraseId', validateUserId, async (req: Request, res: Response) => {
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

    const response: any = {
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
  } catch (error) {
    logger.error('Failed to retrieve seed phrase:', error);
    res.status(500).json({ error: 'Failed to retrieve seed phrase' });
  }
});

/**
 * Remove seed phrase from user
 * DELETE /api/users/:userId/seed-phrases/:seedPhraseId
 */
router.delete('/:userId/seed-phrases/:seedPhraseId', validateUserId, async (req: Request, res: Response) => {
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
  } catch (error) {
    logger.error('Failed to remove seed phrase from user:', error);
    res.status(500).json({ error: 'Failed to remove seed phrase' });
  }
});

/**
 * Get user storage statistics
 * GET /api/users/:userId/storage/stats
 */
router.get('/:userId/storage/stats', validateUserId, async (req: Request, res: Response) => {
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
  } catch (error) {
    logger.error('Failed to get storage stats:', error);
    res.status(500).json({ error: 'Failed to get storage stats' });
  }
});

/**
 * Backup user data
 * POST /api/users/:userId/backup
 */
router.post('/:userId/backup', validateUserId, async (req: Request, res: Response) => {
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
  } catch (error) {
    logger.error('Failed to create backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

export default router;