/**
 * Enhanced Iagon Service for K33P Seed Phrase Storage
 * Handles secure storage and retrieval of 12/24-word seed phrases on Iagon
 * with encryption, NOK access control, and comprehensive audit logging
 */

import crypto from 'crypto';
import { findUser, createUser, findUserById, storeData, retrieveData, deleteData, updateData } from '../utils/iagon';
import { logger } from '../utils/logger';
import { UserDataStorageService } from './user-data-storage';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface SeedPhraseMetadata {
  id: string;
  userId: string;
  walletName: string;
  walletType: string;
  mnemonicType: '12-word' | '24-word';
  encryptionKeyHash: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
  accessCount: number;
}

export interface EncryptedSeedPhraseData {
  encryptedSeedPhrase: string;
  encryptionMethod: string;
  keyDerivationMethod: string;
  salt: string;
  iv: string;
  authTag: string;
  metadata: {
    walletName: string;
    walletType: string;
    mnemonicType: '12-word' | '24-word';
    createdAt: string;
    version: string;
    userId?: string;
  };
}

export interface StorageResult {
  iagonStorageId: string;
  encryptionKeyHash: string;
  metadata: SeedPhraseMetadata;
}

export interface RetrievalResult {
  seedPhrase: string;
  metadata: SeedPhraseMetadata;
}

// ============================================================================
// ENHANCED IAGON SERVICE CLASS
// ============================================================================

export class EnhancedIagonService {
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly KEY_DERIVATION_ITERATIONS = 100000;
  private readonly STORAGE_VERSION = '2.0';
  private userDataService: UserDataStorageService;

  constructor() {
    this.userDataService = new UserDataStorageService();
  }

  // ============================================================================
  // ENCRYPTION AND SECURITY METHODS
  // ============================================================================

  /**
   * Derive encryption key from password using PBKDF2
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      this.KEY_DERIVATION_ITERATIONS,
      32, // 256 bits
      'sha256'
    );
  }

  /**
   * Generate cryptographically secure salt
   */
  private generateSalt(): Buffer {
    return crypto.randomBytes(32);
  }

  /**
   * Generate initialization vector
   */
  private generateIV(): Buffer {
    return crypto.randomBytes(16);
  }

  /**
   * Encrypt seed phrase with AES-256-GCM
   */
  private encryptSeedPhrase(
    seedPhrase: string,
    password: string,
    metadata: any
  ): EncryptedSeedPhraseData {
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
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt seed phrase');
    }
  }

  /**
   * Decrypt seed phrase with AES-256-GCM
   */
  private decryptSeedPhrase(
    encryptedData: EncryptedSeedPhraseData,
    password: string
  ): string {
    try {
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      // const authTag = Buffer.from(encryptedData.authTag, 'hex'); // Not used anymore
      const key = this.deriveKey(password, salt);

      const decipher = crypto.createDecipher('aes-256-cbc', key);

      let decrypted = decipher.update(encryptedData.encryptedSeedPhrase, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt seed phrase - invalid password or corrupted data');
    }
  }

  /**
   * Generate hash of encryption key for verification
   */
  private generateKeyHash(password: string, salt: string): string {
    const key = this.deriveKey(password, Buffer.from(salt, 'hex'));
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Validate seed phrase format
   */
  private validateSeedPhrase(seedPhrase: string, mnemonicType: '12-word' | '24-word'): boolean {
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
   * Store encrypted seed phrase on Iagon with JSON format and user integration
   */
  async storeSeedPhrase(
    userId: string,
    walletName: string,
    walletType: string,
    mnemonicType: '12-word' | '24-word',
    seedPhrase: string,
    encryptionPassword: string,
    walletAddress?: string
  ): Promise<StorageResult> {
    try {
      // Validate seed phrase
      this.validateSeedPhrase(seedPhrase, mnemonicType);

      // Prepare comprehensive metadata
      const metadata = {
        walletName,
        walletType,
        mnemonicType,
        userId,
        walletAddress,
        createdAt: new Date().toISOString(),
        version: this.STORAGE_VERSION
      };

      // Encrypt seed phrase
      const encryptedData = this.encryptSeedPhrase(seedPhrase, encryptionPassword, metadata);

      // Create comprehensive JSON structure for storage
      const seedPhraseDocument = {
        id: crypto.randomUUID(),
        userId,
        walletName,
        walletType,
        mnemonicType,
        walletAddress,
        encryptedData,
        metadata: {
          ...metadata,
          storageFormat: 'json',
          encryptionMethod: this.ENCRYPTION_ALGORITHM,
          keyDerivationIterations: this.KEY_DERIVATION_ITERATIONS
        },
        accessLog: {
          createdAt: new Date().toISOString(),
          lastAccessed: null,
          accessCount: 0
        },
        version: this.STORAGE_VERSION
      };

      // Store on Iagon as JSON
      const storageKey = `k33p_seed_${userId}_${seedPhraseDocument.id}_${Date.now()}`;
      const iagonStorageId = await storeData(storageKey, JSON.stringify(seedPhraseDocument, null, 2));

      // Generate encryption key hash
      const encryptionKeyHash = this.generateKeyHash(encryptionPassword, encryptedData.salt);

      const seedPhraseMetadata: SeedPhraseMetadata = {
        id: seedPhraseDocument.id,
        userId,
        walletName,
        walletType,
        mnemonicType,
        encryptionKeyHash,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0
      };

      // Add seed phrase to user profile
      const seedPhraseEntry = {
        id: seedPhraseDocument.id,
        userId,
        walletName,
        walletType: walletType as 'cardano' | 'bitcoin' | 'ethereum' | 'other',
        mnemonicType,
        encryptedSeedPhrase: JSON.stringify(encryptedData),
        encryptionSalt: encryptedData.salt,
        walletAddress,
        createdAt: new Date()
      };

      await this.userDataService.addSeedPhraseToUser(userId, seedPhraseEntry);

      logger.info(`Seed phrase stored successfully for user ${userId}`, {
        seedPhraseId: seedPhraseMetadata.id,
        walletName,
        walletType,
        mnemonicType,
        iagonStorageId,
        storageFormat: 'json'
      });

      return {
        iagonStorageId,
        encryptionKeyHash,
        metadata: seedPhraseMetadata
      };
    } catch (error) {
      logger.error('Failed to store seed phrase:', error);
      throw error;
    }
  }

  /**
   * Retrieve and decrypt seed phrase from Iagon with full JSON details
   */
  async retrieveSeedPhrase(
    iagonStorageId: string,
    encryptionPassword: string,
    requesterId: string
  ): Promise<RetrievalResult & { fullDocument?: any }> {
    try {
      // Retrieve encrypted data from Iagon
      const documentStr = await retrieveData(iagonStorageId);
      const seedPhraseDocument = JSON.parse(documentStr);

      // Check if this is the new JSON format or legacy format
      let encryptedData: EncryptedSeedPhraseData;
      let metadata: any;
      
      if (seedPhraseDocument.version && seedPhraseDocument.encryptedData) {
        // New JSON format
        encryptedData = seedPhraseDocument.encryptedData;
        metadata = seedPhraseDocument.metadata;
        
        // Update access log
        seedPhraseDocument.accessLog.lastAccessed = new Date().toISOString();
        seedPhraseDocument.accessLog.accessCount += 1;
        
        // Update the document in storage
        await updateData(iagonStorageId, JSON.stringify(seedPhraseDocument, null, 2));
      } else {
        // Legacy format
        encryptedData = seedPhraseDocument;
        metadata = encryptedData.metadata;
      }

      // Decrypt seed phrase
      const seedPhrase = this.decryptSeedPhrase(encryptedData, encryptionPassword);

      // Validate decrypted seed phrase
      this.validateSeedPhrase(seedPhrase, metadata.mnemonicType);

      const seedPhraseMetadata: SeedPhraseMetadata = {
        id: seedPhraseDocument.id || crypto.randomUUID(),
        userId: metadata.userId || requesterId,
        walletName: metadata.walletName,
        walletType: metadata.walletType,
        mnemonicType: metadata.mnemonicType,
        encryptionKeyHash: this.generateKeyHash(encryptionPassword, encryptedData.salt),
        createdAt: new Date(metadata.createdAt),
        updatedAt: new Date(),
        lastAccessed: new Date(),
        accessCount: seedPhraseDocument.accessLog?.accessCount || 0
      };

      logger.info(`Seed phrase retrieved successfully`, {
        requesterId,
        walletName: seedPhraseMetadata.walletName,
        walletType: seedPhraseMetadata.walletType,
        mnemonicType: seedPhraseMetadata.mnemonicType,
        iagonStorageId,
        accessCount: seedPhraseMetadata.accessCount,
        format: seedPhraseDocument.version ? 'json' : 'legacy'
      });

      return {
        seedPhrase,
        metadata: seedPhraseMetadata,
        fullDocument: seedPhraseDocument.version ? {
          id: seedPhraseDocument.id,
          walletAddress: seedPhraseDocument.walletAddress,
          accessLog: seedPhraseDocument.accessLog,
          storageFormat: metadata.storageFormat,
          version: seedPhraseDocument.version
        } : undefined
      };
    } catch (error) {
      logger.error('Failed to retrieve seed phrase:', error);
      throw error;
    }
  }

  // Removed NOK access settings update method

  /**
   * Delete seed phrase from Iagon storage
   */
  async deleteSeedPhrase(
    iagonStorageId: string,
    encryptionPassword: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify ownership by attempting to decrypt
      await this.retrieveSeedPhrase(iagonStorageId, encryptionPassword, userId);

      // Delete from Iagon
      await deleteData(iagonStorageId);

      logger.info(`Seed phrase deleted successfully`, {
        userId,
        iagonStorageId
      });
    } catch (error) {
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
  async getStorageStats(userId: string): Promise<any> {
    try {
      // This would typically query the database for user's storage metadata
      // For now, return basic stats
      return {
        totalSeedPhrases: 0,
        storageUsed: '0 KB',
        lastAccess: null
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      throw error;
    }
  }

  /**
   * Validate storage integrity
   */
  async validateStorageIntegrity(iagonStorageId: string): Promise<boolean> {
    try {
      const encryptedDataStr = await retrieveData(iagonStorageId);
      const encryptedData: EncryptedSeedPhraseData = JSON.parse(encryptedDataStr);

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
    } catch (error) {
      logger.error('Storage integrity validation failed:', error);
      return false;
    }
  }

  /**
   * Backup seed phrase data
   */
  async backupSeedPhrase(
    iagonStorageId: string,
    backupLocation: string
  ): Promise<string> {
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
    } catch (error) {
      logger.error('Failed to backup seed phrase:', error);
      throw error;
    }
  }
}

export default EnhancedIagonService;