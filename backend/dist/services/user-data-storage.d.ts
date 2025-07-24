/**
 * User Data Storage Service for K33P
 * Implements user data storage using Iagon's file storage services
 * with a custom user management layer on top of their storage API
 */
import { SeedPhraseEntry } from './seed-phrase-storage';
export interface UserProfile {
    id: string;
    userId: string;
    walletAddress: string;
    phoneHash: string;
    email?: string;
    username?: string;
    profileData: {
        firstName?: string;
        lastName?: string;
        dateOfBirth?: string;
        country?: string;
        timezone?: string;
    };
    securitySettings: {
        twoFactorEnabled: boolean;
        biometricEnabled: boolean;
        recoveryMethodsEnabled: string[];
        lastPasswordChange?: Date;
    };
    preferences: {
        theme: 'light' | 'dark' | 'auto';
        language: string;
        notifications: {
            email: boolean;
            push: boolean;
            sms: boolean;
        };
        privacy: {
            shareAnalytics: boolean;
            shareUsageData: boolean;
        };
    };
    seedPhrases: SeedPhraseEntry[];
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
    isActive: boolean;
    version: string;
}
export interface UserStorageMetadata {
    userId: string;
    iagonStorageId: string;
    encryptionKeyHash: string;
    lastBackupAt?: Date;
    storageSize: number;
    version: string;
}
export interface UserSearchQuery {
    userId?: string;
    walletAddress?: string;
    phoneHash?: string;
    email?: string;
    isActive?: boolean;
}
export interface UserUpdateData {
    profileData?: Partial<UserProfile['profileData']>;
    securitySettings?: Partial<UserProfile['securitySettings']>;
    preferences?: Partial<UserProfile['preferences']>;
    email?: string;
    username?: string;
    lastLoginAt?: Date;
    isActive?: boolean;
}
export declare class UserDataStorageService {
    private readonly STORAGE_VERSION;
    private readonly USER_STORAGE_PREFIX;
    private readonly METADATA_STORAGE_PREFIX;
    private readonly ENCRYPTION_ALGORITHM;
    private readonly KEY_DERIVATION_ITERATIONS;
    constructor();
    /**
     * Create a new user profile and store it on Iagon
     */
    createUser(userId: string, walletAddress: string, phoneHash: string, email?: string, username?: string): Promise<UserProfile>;
    /**
     * Find a user by various criteria
     */
    findUser(query: UserSearchQuery): Promise<UserProfile | null>;
    /**
     * Get user by ID
     */
    getUserById(userId: string): Promise<UserProfile | null>;
    /**
     * Update user data
     */
    updateUser(userId: string, updateData: UserUpdateData): Promise<UserProfile | null>;
    /**
     * Delete user data
     */
    deleteUser(userId: string): Promise<boolean>;
    /**
     * Add seed phrase to user profile
     */
    addSeedPhraseToUser(userId: string, seedPhrase: SeedPhraseEntry): Promise<UserProfile | null>;
    /**
     * Remove seed phrase from user profile
     */
    removeSeedPhraseFromUser(userId: string, seedPhraseId: string): Promise<UserProfile | null>;
    /**
     * Get all seed phrases for a user
     */
    getUserSeedPhrases(userId: string): Promise<SeedPhraseEntry[]>;
    /**
     * Store user data on Iagon
     */
    private storeUserData;
    /**
     * Backup user data
     */
    backupUserData(userId: string): Promise<string>;
    /**
     * Get user storage statistics
     */
    getUserStorageStats(userId: string): Promise<any>;
    /**
     * Generate storage key for user data
     */
    private getUserStorageKey;
    /**
     * Generate storage key for user metadata
     */
    private getMetadataStorageKey;
    /**
     * Generate key hash for encryption verification
     */
    private generateKeyHash;
    /**
     * Validate user profile data
     */
    private validateUserProfile;
    /**
     * Migrate user data to newer version if needed
     */
    private migrateUserData;
}
export default UserDataStorageService;
//# sourceMappingURL=user-data-storage.d.ts.map