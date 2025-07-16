// Seed Phrase Storage Service for K33P
// Handles secure storage and retrieval of wallet seed phrases on Iagon

import crypto from 'crypto';
import { IagonAPI } from '../utils/iagon';
import winston from 'winston';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/seed-storage.log' })
  ]
});

// Interfaces
export interface SeedPhraseEntry {
  id: string;
  userId: string;
  walletName: string;
  walletType: 'cardano' | 'bitcoin' | 'ethereum' | 'other';
  mnemonicType: '12-word' | '24-word';
  encryptedSeedPhrase: string;
  encryptionSalt: string;
  walletAddress?: string;
  createdAt: Date;
  lastAccessed?: Date;
}

// Removed NOK access request interface

export interface SeedPhraseStorageConfig {
  encryptionAlgorithm: string;
  keyDerivationRounds: number;
  saltLength: number;
}

const DEFAULT_CONFIG: SeedPhraseStorageConfig = {
  encryptionAlgorithm: 'aes-256-gcm',
  keyDerivationRounds: 100000,
  saltLength: 32
};

export class SeedPhraseStorageService {
  private config: SeedPhraseStorageConfig;
  private iagonAPI: IagonAPI;

  constructor(config?: Partial<SeedPhraseStorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.iagonAPI = new IagonAPI();
  }

  // ============================================================================
  // SEED PHRASE STORAGE OPERATIONS
  // ============================================================================

  /**
   * Store a seed phrase securely on Iagon
   */
  async storeSeedPhrase(
    userId: string,
    walletName: string,
    seedPhrase: string,
    walletType: 'cardano' | 'bitcoin' | 'ethereum' | 'other',
    walletAddress?: string
  ): Promise<SeedPhraseEntry> {
    try {
      // Validate seed phrase
      const mnemonicType = this.validateAndDetectMnemonicType(seedPhrase);
      
      // Generate encryption components
      const salt = crypto.randomBytes(this.config.saltLength);
      const encryptionKey = this.deriveEncryptionKey(userId, salt);
      
      // Encrypt seed phrase
      const encryptedSeedPhrase = this.encryptSeedPhrase(seedPhrase, encryptionKey);
      
      // Create seed phrase entry
      const seedPhraseEntry: SeedPhraseEntry = {
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
    } catch (error) {
      logger.error('Failed to store seed phrase:', error);
      throw new Error('Failed to store seed phrase securely');
    }
  }

  /**
   * Retrieve user's stored seed phrases (metadata only)
   */
  async getUserSeedPhrases(userId: string): Promise<Omit<SeedPhraseEntry, 'encryptedSeedPhrase' | 'encryptionSalt'>[]> {
    try {
      const user: any = await this.iagonAPI.findUser({ userId });
      if (!user || !user.seedPhrases) {
        return [];
      }

      // Return metadata without sensitive data
      return user.seedPhrases.map((entry: SeedPhraseEntry) => ({
        id: entry.id,
        userId: entry.userId,
        walletName: entry.walletName,
        walletType: entry.walletType,
        mnemonicType: entry.mnemonicType,
        walletAddress: entry.walletAddress,
        createdAt: entry.createdAt,
        lastAccessed: entry.lastAccessed
      }));
    } catch (error) {
      logger.error('Failed to retrieve user seed phrases:', error);
      throw new Error('Failed to retrieve seed phrases');
    }
  }

  /**
   * Retrieve and decrypt a specific seed phrase
   */
  async retrieveSeedPhrase(
    seedPhraseId: string,
    userId: string,
    encryptionPassword: string
  ): Promise<{
    seedPhrase: string;
    walletName: string;
    walletType: string;
    mnemonicType: string;
  }> {
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
      const decryptedSeedPhrase = this.decryptSeedPhrase(
        seedPhraseEntry.encryptedSeedPhrase,
        decryptionKey
      );
      
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
    } catch (error) {
      logger.error('Failed to retrieve seed phrase:', error);
      throw new Error('Failed to retrieve seed phrase');
    }
  }

  // Removed NOK access operations and conditions update methods

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private validateAndDetectMnemonicType(seedPhrase: string): '12-word' | '24-word' {
    const words = seedPhrase.trim().split(/\s+/);
    
    if (words.length === 12) {
      return '12-word';
    } else if (words.length === 24) {
      return '24-word';
    } else {
      throw new Error('Invalid seed phrase: must be 12 or 24 words');
    }
  }

  private deriveEncryptionKey(userId: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      userId,
      salt,
      this.config.keyDerivationRounds,
      32,
      'sha256'
    );
  }

  private encryptSeedPhrase(seedPhrase: string, key: Buffer): string {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(seedPhrase, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }

  private decryptSeedPhrase(encryptedData: string, key: Buffer): string {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Removed NOK-related utility methods

  // ============================================================================
  // IAGON INTEGRATION METHODS
  // ============================================================================

  private async storeOnIagon(seedPhraseEntry: SeedPhraseEntry): Promise<void> {
    try {
      // Find or create user record
      let user: any = await this.iagonAPI.findUser({ userId: seedPhraseEntry.userId });
      
      if (!user) {
        user = await this.iagonAPI.createUser({
          userId: seedPhraseEntry.userId,
          walletAddress: seedPhraseEntry.walletAddress || '',
          phoneHash: '', // This would come from existing user data
          seedPhrases: [seedPhraseEntry]
        });
      } else {
        // Add to existing seed phrases
        if (!user.seedPhrases) {
          user.seedPhrases = [];
        }
        user.seedPhrases.push(seedPhraseEntry);
        await this.updateOnIagon(user);
      }
    } catch (error) {
      logger.error('Failed to store on Iagon:', error);
      throw error;
    }
  }

  private async updateOnIagon(user: any): Promise<void> {
    // Implementation would update user data on Iagon
    // This integrates with the existing Iagon utility functions
  }

  private async getSeedPhraseById(seedPhraseId: string): Promise<SeedPhraseEntry | null> {
    try {
      // TODO: Implement efficient seed phrase lookup by ID
      // For now, this is a placeholder that would need to be implemented
      // based on the actual Iagon API capabilities
      logger.warn('getSeedPhraseById not fully implemented - using placeholder');
      return null;
    } catch (error) {
      logger.error('Failed to get seed phrase by ID:', error);
      return null;
    }
  }

  private async updateSeedPhraseEntry(seedPhraseEntry: SeedPhraseEntry): Promise<void> {
    // Implementation would update seed phrase entry
  }
}

export default SeedPhraseStorageService;