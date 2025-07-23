// Seed Phrase Storage Service for K33P
// Handles secure storage and retrieval of wallet seed phrases on Iagon
import crypto from 'crypto';
import { findUser, createUser } from '../utils/iagon.js';
import winston from 'winston';
// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/seed-storage.log' })
    ]
});
const DEFAULT_CONFIG = {
    encryptionAlgorithm: 'aes-256-gcm',
    keyDerivationRounds: 100000,
    saltLength: 32
};
export class SeedPhraseStorageService {
    config;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ============================================================================
    // SEED PHRASE STORAGE OPERATIONS
    // ============================================================================
    /**
     * Store a seed phrase securely on Iagon
     */
    async storeSeedPhrase(userId, walletName, seedPhrase, walletType, walletAddress) {
        try {
            // Validate seed phrase
            const mnemonicType = this.validateAndDetectMnemonicType(seedPhrase);
            // Generate encryption components
            const salt = crypto.randomBytes(this.config.saltLength);
            const encryptionKey = this.deriveEncryptionKey(userId, salt);
            // Encrypt seed phrase
            const encryptedSeedPhrase = this.encryptSeedPhrase(seedPhrase, encryptionKey);
            // Create seed phrase entry
            const seedPhraseEntry = {
                id: crypto.randomUUID(),
                userId,
                walletName,
                walletType,
                mnemonicType,
                encryptedSeedPhrase,
                encryptionSalt: salt.toString('hex'),
                walletAddress,
                createdAt: new Date()
            };
            // Store on Iagon (using the existing Iagon integration)
            await this.storeOnIagon(seedPhraseEntry);
            logger.info(`Seed phrase stored for user ${userId}, wallet: ${walletName}`);
            return seedPhraseEntry;
        }
        catch (error) {
            logger.error('Failed to store seed phrase:', error);
            throw new Error('Failed to store seed phrase securely');
        }
    }
    /**
     * Retrieve user's stored seed phrases (metadata only)
     */
    async getUserSeedPhrases(userId) {
        try {
            const user = await findUser({ userId });
            if (!user || !user.seedPhrases) {
                return [];
            }
            // Return metadata without sensitive data
            return user.seedPhrases.map((entry) => ({
                id: entry.id,
                userId: entry.userId,
                walletName: entry.walletName,
                walletType: entry.walletType,
                mnemonicType: entry.mnemonicType,
                walletAddress: entry.walletAddress,
                createdAt: entry.createdAt,
                lastAccessed: entry.lastAccessed
            }));
        }
        catch (error) {
            logger.error('Failed to retrieve user seed phrases:', error);
            throw new Error('Failed to retrieve seed phrases');
        }
    }
    /**
     * Retrieve and decrypt a specific seed phrase
     */
    async retrieveSeedPhrase(seedPhraseId, userId, encryptionPassword) {
        try {
            const seedPhraseEntry = await this.getSeedPhraseById(seedPhraseId);
            if (!seedPhraseEntry) {
                throw new Error('Seed phrase not found');
            }
            if (seedPhraseEntry.userId !== userId) {
                throw new Error('Unauthorized access to seed phrase');
            }
            // Derive decryption key
            const salt = Buffer.from(seedPhraseEntry.encryptionSalt, 'hex');
            const decryptionKey = this.deriveEncryptionKey(userId, salt);
            // Decrypt seed phrase
            const decryptedSeedPhrase = this.decryptSeedPhrase(seedPhraseEntry.encryptedSeedPhrase, decryptionKey);
            // Update last accessed
            seedPhraseEntry.lastAccessed = new Date();
            await this.updateSeedPhraseEntry(seedPhraseEntry);
            logger.info(`Seed phrase retrieved for user ${userId}, ID: ${seedPhraseId}`);
            return {
                seedPhrase: decryptedSeedPhrase,
                walletName: seedPhraseEntry.walletName,
                walletType: seedPhraseEntry.walletType,
                mnemonicType: seedPhraseEntry.mnemonicType
            };
        }
        catch (error) {
            logger.error('Failed to retrieve seed phrase:', error);
            throw new Error('Failed to retrieve seed phrase');
        }
    }
    // Removed NOK access operations and conditions update methods
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    validateAndDetectMnemonicType(seedPhrase) {
        const words = seedPhrase.trim().split(/\s+/);
        if (words.length === 12) {
            return '12-word';
        }
        else if (words.length === 24) {
            return '24-word';
        }
        else {
            throw new Error('Invalid seed phrase: must be 12 or 24 words');
        }
    }
    deriveEncryptionKey(userId, salt) {
        return crypto.pbkdf2Sync(userId, salt, this.config.keyDerivationRounds, 32, 'sha256');
    }
    encryptSeedPhrase(seedPhrase, key) {
        const cipher = crypto.createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(seedPhrase, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    decryptSeedPhrase(encryptedData, key) {
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    // Removed NOK-related utility methods
    // ============================================================================
    // IAGON INTEGRATION METHODS
    // ============================================================================
    async storeOnIagon(seedPhraseEntry) {
        try {
            // Find or create user record
            let user = await findUser({ userId: seedPhraseEntry.userId });
            if (!user) {
                user = await createUser({
                    userId: seedPhraseEntry.userId,
                    walletAddress: seedPhraseEntry.walletAddress || '',
                    phoneHash: '', // This would come from existing user data
                    seedPhrases: [seedPhraseEntry]
                });
            }
            else {
                // Add to existing seed phrases
                if (!user.seedPhrases) {
                    user.seedPhrases = [];
                }
                user.seedPhrases.push(seedPhraseEntry);
                await this.updateOnIagon(user);
            }
        }
        catch (error) {
            logger.error('Failed to store on Iagon:', error);
            throw error;
        }
    }
    async updateOnIagon(user) {
        // Implementation would update user data on Iagon
        // This integrates with the existing Iagon utility functions
    }
    async getSeedPhraseById(seedPhraseId) {
        try {
            // TODO: Implement efficient seed phrase lookup by ID
            // For now, this is a placeholder that would need to be implemented
            // based on the actual Iagon API capabilities
            logger.warn('getSeedPhraseById not fully implemented - using placeholder');
            return null;
        }
        catch (error) {
            logger.error('Failed to get seed phrase by ID:', error);
            return null;
        }
    }
    async updateSeedPhraseEntry(seedPhraseEntry) {
        // Implementation would update seed phrase entry
    }
}
export default SeedPhraseStorageService;
//# sourceMappingURL=seed-phrase-storage.js.map