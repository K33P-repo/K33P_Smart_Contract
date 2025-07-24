/**
 * User Data Storage Service for K33P
 * Implements user data storage using Iagon's file storage services
 * with a custom user management layer on top of their storage API
 */
import crypto from 'crypto';
import { storeData, retrieveData, deleteData } from '../utils/iagon.js';
import { logger } from '../utils/logger.js';
// ============================================================================
// USER DATA STORAGE SERVICE CLASS
// ============================================================================
export class UserDataStorageService {
    STORAGE_VERSION = '2.0';
    USER_STORAGE_PREFIX = 'k33p_user_';
    METADATA_STORAGE_PREFIX = 'k33p_user_meta_';
    ENCRYPTION_ALGORITHM = 'aes-256-gcm';
    KEY_DERIVATION_ITERATIONS = 100000;
    constructor() {
        logger.info('UserDataStorageService initialized');
    }
    // ============================================================================
    // USER CREATION AND MANAGEMENT
    // ============================================================================
    /**
     * Create a new user profile and store it on Iagon
     */
    async createUser(userId, walletAddress, phoneHash, email, username) {
        try {
            // Check if user already exists
            const existingUser = await this.findUser({ userId });
            if (existingUser) {
                throw new Error(`User with ID ${userId} already exists`);
            }
            // Create user profile
            const userProfile = {
                id: crypto.randomUUID(),
                userId,
                walletAddress,
                phoneHash,
                email,
                username,
                profileData: {},
                securitySettings: {
                    twoFactorEnabled: false,
                    biometricEnabled: false,
                    recoveryMethodsEnabled: ['phone'],
                },
                preferences: {
                    theme: 'auto',
                    language: 'en',
                    notifications: {
                        email: true,
                        push: true,
                        sms: false,
                    },
                    privacy: {
                        shareAnalytics: false,
                        shareUsageData: false,
                    },
                },
                seedPhrases: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true,
                version: this.STORAGE_VERSION,
            };
            // Store user data on Iagon
            const storageResult = await this.storeUserData(userProfile);
            logger.info(`User created successfully`, {
                userId,
                walletAddress,
                iagonStorageId: storageResult.iagonStorageId
            });
            return userProfile;
        }
        catch (error) {
            logger.error('Failed to create user:', error);
            throw error;
        }
    }
    /**
     * Find a user by various criteria
     */
    async findUser(query) {
        try {
            // For now, we'll implement a simple lookup by userId
            // In a production system, you might want to maintain an index
            if (query.userId) {
                return await this.getUserById(query.userId);
            }
            // For other queries, we'd need to implement indexing or search
            logger.warn('Advanced user search not implemented yet', { query });
            return null;
        }
        catch (error) {
            logger.error('Failed to find user:', error);
            return null;
        }
    }
    /**
     * Get user by ID
     */
    async getUserById(userId) {
        try {
            const storageKey = this.getUserStorageKey(userId);
            const userData = await retrieveData(storageKey);
            if (!userData) {
                return null;
            }
            const userProfile = JSON.parse(userData);
            // Update last access time
            userProfile.lastLoginAt = new Date();
            await this.updateUser(userId, { lastLoginAt: userProfile.lastLoginAt });
            return userProfile;
        }
        catch (error) {
            logger.error(`Failed to get user by ID ${userId}:`, error);
            return null;
        }
    }
    /**
     * Update user data
     */
    async updateUser(userId, updateData) {
        try {
            const existingUser = await this.getUserById(userId);
            if (!existingUser) {
                throw new Error(`User with ID ${userId} not found`);
            }
            // Merge update data
            const updatedUser = {
                ...existingUser,
                ...updateData,
                profileData: {
                    ...existingUser.profileData,
                    ...updateData.profileData,
                },
                securitySettings: {
                    ...existingUser.securitySettings,
                    ...updateData.securitySettings,
                },
                preferences: {
                    ...existingUser.preferences,
                    ...updateData.preferences,
                    notifications: {
                        ...existingUser.preferences.notifications,
                        ...updateData.preferences?.notifications,
                    },
                    privacy: {
                        ...existingUser.preferences.privacy,
                        ...updateData.preferences?.privacy,
                    },
                },
                updatedAt: new Date(),
            };
            // Store updated data
            await this.storeUserData(updatedUser);
            logger.info(`User updated successfully`, { userId });
            return updatedUser;
        }
        catch (error) {
            logger.error('Failed to update user:', error);
            throw error;
        }
    }
    /**
     * Delete user data
     */
    async deleteUser(userId) {
        try {
            const storageKey = this.getUserStorageKey(userId);
            const metadataKey = this.getMetadataStorageKey(userId);
            // Delete user data and metadata
            await deleteData(storageKey);
            await deleteData(metadataKey);
            logger.info(`User deleted successfully`, { userId });
            return true;
        }
        catch (error) {
            logger.error('Failed to delete user:', error);
            return false;
        }
    }
    // ============================================================================
    // SEED PHRASE MANAGEMENT
    // ============================================================================
    /**
     * Add seed phrase to user profile
     */
    async addSeedPhraseToUser(userId, seedPhrase) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }
            // Add seed phrase to user's collection
            user.seedPhrases.push(seedPhrase);
            user.updatedAt = new Date();
            // Store updated user data
            await this.storeUserData(user);
            logger.info(`Seed phrase added to user`, { userId, seedPhraseId: seedPhrase.id });
            return user;
        }
        catch (error) {
            logger.error('Failed to add seed phrase to user:', error);
            throw error;
        }
    }
    /**
     * Remove seed phrase from user profile
     */
    async removeSeedPhraseFromUser(userId, seedPhraseId) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }
            // Remove seed phrase from user's collection
            user.seedPhrases = user.seedPhrases.filter(sp => sp.id !== seedPhraseId);
            user.updatedAt = new Date();
            // Store updated user data
            await this.storeUserData(user);
            logger.info(`Seed phrase removed from user`, { userId, seedPhraseId });
            return user;
        }
        catch (error) {
            logger.error('Failed to remove seed phrase from user:', error);
            throw error;
        }
    }
    /**
     * Get all seed phrases for a user
     */
    async getUserSeedPhrases(userId) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                return [];
            }
            return user.seedPhrases || [];
        }
        catch (error) {
            logger.error('Failed to get user seed phrases:', error);
            return [];
        }
    }
    // ============================================================================
    // STORAGE OPERATIONS
    // ============================================================================
    /**
     * Store user data on Iagon
     */
    async storeUserData(userProfile) {
        try {
            const storageKey = this.getUserStorageKey(userProfile.userId);
            const userData = JSON.stringify(userProfile, null, 2);
            // Store user data
            const iagonStorageId = await storeData(storageKey, userData);
            // Create and store metadata
            const metadata = {
                userId: userProfile.userId,
                iagonStorageId,
                encryptionKeyHash: this.generateKeyHash(userProfile.userId),
                storageSize: userData.length,
                version: this.STORAGE_VERSION,
            };
            const metadataKey = this.getMetadataStorageKey(userProfile.userId);
            await storeData(metadataKey, JSON.stringify(metadata));
            return metadata;
        }
        catch (error) {
            logger.error('Failed to store user data:', error);
            throw error;
        }
    }
    /**
     * Backup user data
     */
    async backupUserData(userId) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }
            const backupKey = `${this.USER_STORAGE_PREFIX}backup_${userId}_${Date.now()}`;
            const backupData = JSON.stringify({
                ...user,
                backupCreatedAt: new Date().toISOString(),
            }, null, 2);
            const backupId = await storeData(backupKey, backupData);
            logger.info(`User data backed up successfully`, { userId, backupId });
            return backupId;
        }
        catch (error) {
            logger.error('Failed to backup user data:', error);
            throw error;
        }
    }
    /**
     * Get user storage statistics
     */
    async getUserStorageStats(userId) {
        try {
            const metadataKey = this.getMetadataStorageKey(userId);
            const metadataStr = await retrieveData(metadataKey);
            if (!metadataStr) {
                return {
                    userId,
                    storageSize: 0,
                    seedPhrasesCount: 0,
                    lastUpdated: null,
                };
            }
            const metadata = JSON.parse(metadataStr);
            const user = await this.getUserById(userId);
            return {
                userId,
                storageSize: metadata.storageSize,
                seedPhrasesCount: user?.seedPhrases?.length || 0,
                lastUpdated: user?.updatedAt,
                version: metadata.version,
            };
        }
        catch (error) {
            logger.error('Failed to get user storage stats:', error);
            throw error;
        }
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    /**
     * Generate storage key for user data
     */
    getUserStorageKey(userId) {
        return `${this.USER_STORAGE_PREFIX}${userId}`;
    }
    /**
     * Generate storage key for user metadata
     */
    getMetadataStorageKey(userId) {
        return `${this.METADATA_STORAGE_PREFIX}${userId}`;
    }
    /**
     * Generate key hash for encryption verification
     */
    generateKeyHash(userId) {
        return crypto.createHash('sha256').update(userId + this.STORAGE_VERSION).digest('hex');
    }
    /**
     * Validate user profile data
     */
    validateUserProfile(userProfile) {
        const requiredFields = ['id', 'userId', 'walletAddress', 'phoneHash', 'createdAt', 'version'];
        return requiredFields.every(field => field in userProfile && userProfile[field] !== undefined);
    }
    /**
     * Migrate user data to newer version if needed
     */
    async migrateUserData(userProfile) {
        // Handle version migrations here
        if (!userProfile.version || userProfile.version < this.STORAGE_VERSION) {
            logger.info(`Migrating user data from version ${userProfile.version} to ${this.STORAGE_VERSION}`);
            // Add any missing fields with defaults
            userProfile.version = this.STORAGE_VERSION;
            userProfile.updatedAt = new Date();
            // Store migrated data
            await this.storeUserData(userProfile);
        }
        return userProfile;
    }
}
export default UserDataStorageService;
//# sourceMappingURL=user-data-storage.js.map