/**
 * Enhanced Iagon Service for K33P Seed Phrase Storage
 * Handles secure storage and retrieval of 12/24-word seed phrases on Iagon
 * with encryption, NOK access control, and comprehensive audit logging
 */
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
export declare class EnhancedIagonService {
    private readonly ENCRYPTION_ALGORITHM;
    private readonly KEY_DERIVATION_ITERATIONS;
    private readonly STORAGE_VERSION;
    constructor();
    /**
     * Derive encryption key from password using PBKDF2
     */
    private deriveKey;
    /**
     * Generate cryptographically secure salt
     */
    private generateSalt;
    /**
     * Generate initialization vector
     */
    private generateIV;
    /**
     * Encrypt seed phrase with AES-256-GCM
     */
    private encryptSeedPhrase;
    /**
     * Decrypt seed phrase with AES-256-GCM
     */
    private decryptSeedPhrase;
    /**
     * Generate hash of encryption key for verification
     */
    private generateKeyHash;
    /**
     * Validate seed phrase format
     */
    private validateSeedPhrase;
    /**
     * Store encrypted seed phrase on Iagon
     */
    storeSeedPhrase(userId: string, walletName: string, walletType: string, mnemonicType: '12-word' | '24-word', seedPhrase: string, encryptionPassword: string): Promise<StorageResult>;
    /**
     * Retrieve and decrypt seed phrase from Iagon
     */
    retrieveSeedPhrase(iagonStorageId: string, encryptionPassword: string, requesterId: string): Promise<RetrievalResult>;
    /**
     * Delete seed phrase from Iagon storage
     */
    deleteSeedPhrase(iagonStorageId: string, encryptionPassword: string, userId: string): Promise<void>;
    /**
     * Get storage statistics
     */
    getStorageStats(userId: string): Promise<any>;
    /**
     * Validate storage integrity
     */
    validateStorageIntegrity(iagonStorageId: string): Promise<boolean>;
    /**
     * Backup seed phrase data
     */
    backupSeedPhrase(iagonStorageId: string, backupLocation: string): Promise<string>;
}
export default EnhancedIagonService;
//# sourceMappingURL=enhanced-iagon-service.d.ts.map