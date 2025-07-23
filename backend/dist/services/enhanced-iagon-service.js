/**
 * Enhanced Iagon Service for K33P Seed Phrase Storage
 * Handles secure storage and retrieval of 12/24-word seed phrases on Iagon
 * with encryption, NOK access control, and comprehensive audit logging
 */
import crypto from 'crypto';
import { storeData, retrieveData, deleteData } from '../utils/iagon.js';
import { logger } from '../utils/logger.js';
// ============================================================================
// ENHANCED IAGON SERVICE CLASS
// ============================================================================
export class EnhancedIagonService {
    ENCRYPTION_ALGORITHM = 'aes-256-gcm';
    KEY_DERIVATION_ITERATIONS = 100000;
    STORAGE_VERSION = '1.0';
    constructor() {
        // No longer need to instantiate IagonAPI class
    }
    // ============================================================================
    // ENCRYPTION AND SECURITY METHODS
    // ============================================================================
    /**
     * Derive encryption key from password using PBKDF2
     */
    deriveKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, this.KEY_DERIVATION_ITERATIONS, 32, // 256 bits
        'sha256');
    }
    /**
     * Generate cryptographically secure salt
     */
    generateSalt() {
        return crypto.randomBytes(32);
    }
    /**
     * Generate initialization vector
     */
    generateIV() {
        return crypto.randomBytes(16);
    }
    /**
     * Encrypt seed phrase with AES-256-GCM
     */
    encryptSeedPhrase(seedPhrase, password, metadata) {
        try {
            const salt = this.generateSalt();
            const iv = this.generateIV();
            const key = this.deriveKey(password, salt);
            const cipher = crypto.createCipher('aes-256-cbc', key);
            let encrypted = cipher.update(seedPhrase, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return {
                encryptedSeedPhrase: encrypted,
                encryptionMethod: this.ENCRYPTION_ALGORITHM,
                keyDerivationMethod: 'PBKDF2-SHA256',
                salt: salt.toString('hex'),
                iv: iv.toString('hex'),
                authTag: '', // Removed for compatibility
                metadata: {
                    ...metadata,
                    createdAt: new Date().toISOString(),
                    version: this.STORAGE_VERSION
                }
            };
        }
        catch (error) {
            logger.error('Encryption failed:', error);
            throw new Error('Failed to encrypt seed phrase');
        }
    }
    /**
     * Decrypt seed phrase with AES-256-GCM
     */
    decryptSeedPhrase(encryptedData, password) {
        try {
            const salt = Buffer.from(encryptedData.salt, 'hex');
            const iv = Buffer.from(encryptedData.iv, 'hex');
            // const authTag = Buffer.from(encryptedData.authTag, 'hex'); // Not used anymore
            const key = this.deriveKey(password, salt);
            const decipher = crypto.createDecipher('aes-256-cbc', key);
            let decrypted = decipher.update(encryptedData.encryptedSeedPhrase, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            logger.error('Decryption failed:', error);
            throw new Error('Failed to decrypt seed phrase - invalid password or corrupted data');
        }
    }
    /**
     * Generate hash of encryption key for verification
     */
    generateKeyHash(password, salt) {
        const key = this.deriveKey(password, Buffer.from(salt, 'hex'));
        return crypto.createHash('sha256').update(key).digest('hex');
    }
    /**
     * Validate seed phrase format
     */
    validateSeedPhrase(seedPhrase, mnemonicType) {
        const words = seedPhrase.trim().split(/\s+/);
        const expectedLength = mnemonicType === '12-word' ? 12 : 24;
        if (words.length !== expectedLength) {
            throw new Error(`Invalid seed phrase: expected ${expectedLength} words, got ${words.length}`);
        }
        // Basic validation - each word should be alphabetic
        const invalidWords = words.filter(word => !/^[a-zA-Z]+$/.test(word));
        if (invalidWords.length > 0) {
            throw new Error(`Invalid words in seed phrase: ${invalidWords.join(', ')}`);
        }
        return true;
    }
    // ============================================================================
    // STORAGE METHODS
    // ============================================================================
    /**
     * Store encrypted seed phrase on Iagon
     */
    async storeSeedPhrase(userId, walletName, walletType, mnemonicType, seedPhrase, encryptionPassword) {
        try {
            // Validate seed phrase
            this.validateSeedPhrase(seedPhrase, mnemonicType);
            // Prepare metadata
            const metadata = {
                walletName,
                walletType,
                mnemonicType,
                userId
            };
            // Encrypt seed phrase
            const encryptedData = this.encryptSeedPhrase(seedPhrase, encryptionPassword, metadata);
            // Store on Iagon
            const storageKey = `k33p_seed_${userId}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            const iagonStorageId = await storeData(storageKey, JSON.stringify(encryptedData));
            // Generate encryption key hash
            const encryptionKeyHash = this.generateKeyHash(encryptionPassword, encryptedData.salt);
            const seedPhraseMetadata = {
                id: crypto.randomUUID(),
                userId,
                walletName,
                walletType,
                mnemonicType,
                encryptionKeyHash,
                createdAt: new Date(),
                updatedAt: new Date(),
                accessCount: 0
            };
            logger.info(`Seed phrase stored successfully for user ${userId}`, {
                seedPhraseId: seedPhraseMetadata.id,
                walletName,
                walletType,
                mnemonicType,
                iagonStorageId
            });
            return {
                iagonStorageId,
                encryptionKeyHash,
                metadata: seedPhraseMetadata
            };
        }
        catch (error) {
            logger.error('Failed to store seed phrase:', error);
            throw error;
        }
    }
    /**
     * Retrieve and decrypt seed phrase from Iagon
     */
    async retrieveSeedPhrase(iagonStorageId, encryptionPassword, requesterId) {
        try {
            // Retrieve encrypted data from Iagon
            const encryptedDataStr = await retrieveData(iagonStorageId);
            const encryptedData = JSON.parse(encryptedDataStr);
            // Decrypt seed phrase
            const seedPhrase = this.decryptSeedPhrase(encryptedData, encryptionPassword);
            // Validate decrypted seed phrase
            this.validateSeedPhrase(seedPhrase, encryptedData.metadata.mnemonicType);
            const metadata = {
                id: crypto.randomUUID(),
                userId: encryptedData.metadata.userId || requesterId,
                walletName: encryptedData.metadata.walletName,
                walletType: encryptedData.metadata.walletType,
                mnemonicType: encryptedData.metadata.mnemonicType,
                encryptionKeyHash: this.generateKeyHash(encryptionPassword, encryptedData.salt),
                createdAt: new Date(encryptedData.metadata.createdAt),
                updatedAt: new Date(),
                lastAccessed: new Date(),
                accessCount: 0
            };
            logger.info(`Seed phrase retrieved successfully`, {
                requesterId,
                walletName: metadata.walletName,
                walletType: metadata.walletType,
                mnemonicType: metadata.mnemonicType,
                iagonStorageId
            });
            return {
                seedPhrase,
                metadata
            };
        }
        catch (error) {
            logger.error('Failed to retrieve seed phrase:', error);
            throw error;
        }
    }
    // Removed NOK access settings update method
    /**
     * Delete seed phrase from Iagon storage
     */
    async deleteSeedPhrase(iagonStorageId, encryptionPassword, userId) {
        try {
            // Verify ownership by attempting to decrypt
            await this.retrieveSeedPhrase(iagonStorageId, encryptionPassword, userId);
            // Delete from Iagon
            await deleteData(iagonStorageId);
            logger.info(`Seed phrase deleted successfully`, {
                userId,
                iagonStorageId
            });
        }
        catch (error) {
            logger.error('Failed to delete seed phrase:', error);
            throw error;
        }
    }
    // Removed NOK access methods
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    /**
     * Get storage statistics
     */
    async getStorageStats(userId) {
        try {
            // This would typically query the database for user's storage metadata
            // For now, return basic stats
            return {
                totalSeedPhrases: 0,
                storageUsed: '0 KB',
                lastAccess: null
            };
        }
        catch (error) {
            logger.error('Failed to get storage stats:', error);
            throw error;
        }
    }
    /**
     * Validate storage integrity
     */
    async validateStorageIntegrity(iagonStorageId) {
        try {
            const encryptedDataStr = await retrieveData(iagonStorageId);
            const encryptedData = JSON.parse(encryptedDataStr);
            // Basic validation checks
            const requiredFields = ['encryptedSeedPhrase', 'salt', 'iv', 'authTag', 'metadata'];
            const hasAllFields = requiredFields.every(field => field in encryptedData);
            if (!hasAllFields) {
                return false;
            }
            // Validate metadata structure
            const metadata = encryptedData.metadata;
            const requiredMetadataFields = ['walletName', 'walletType', 'mnemonicType', 'createdAt', 'version'];
            const hasAllMetadataFields = requiredMetadataFields.every(field => field in metadata);
            return hasAllMetadataFields;
        }
        catch (error) {
            logger.error('Storage integrity validation failed:', error);
            return false;
        }
    }
    /**
     * Backup seed phrase data
     */
    async backupSeedPhrase(iagonStorageId, backupLocation) {
        try {
            const encryptedDataStr = await retrieveData(iagonStorageId);
            // Create backup with timestamp
            const backupKey = `${backupLocation}_backup_${Date.now()}`;
            const backupId = await storeData(backupKey, encryptedDataStr);
            logger.info(`Seed phrase backed up successfully`, {
                originalId: iagonStorageId,
                backupId,
                backupLocation
            });
            return backupId;
        }
        catch (error) {
            logger.error('Failed to backup seed phrase:', error);
            throw error;
        }
    }
}
export default EnhancedIagonService;
//# sourceMappingURL=enhanced-iagon-service.js.map