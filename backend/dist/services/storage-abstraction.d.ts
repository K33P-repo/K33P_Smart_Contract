/**
 * Storage Abstraction Layer for K33P
 * Provides unified interface for data storage with Iagon as primary and PostgreSQL as fallback
 * Handles automatic failover, data synchronization, and storage health monitoring
 */
export interface StorageConfig {
    primaryStorage: 'iagon' | 'postgresql';
    enableFallback: boolean;
    syncBetweenStorages: boolean;
    healthCheckInterval: number;
    retryAttempts: number;
    retryDelay: number;
}
export interface StorageResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    storageUsed: 'iagon' | 'postgresql' | 'both';
    syncStatus?: 'synced' | 'pending' | 'failed';
}
export interface StorageHealthStatus {
    iagon: {
        available: boolean;
        responseTime?: number;
        lastError?: string;
        lastChecked: Date;
    };
    postgresql: {
        available: boolean;
        responseTime?: number;
        lastError?: string;
        lastChecked: Date;
    };
}
export interface UserData {
    id: string;
    userId: string;
    email?: string;
    name?: string;
    walletAddress: string;
    phoneHash: string;
    zkCommitment?: string;
    senderWalletAddress?: string;
    txHash?: string;
    verified?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserDeposit {
    id: string;
    userAddress: string;
    userId: string;
    phoneHash: string;
    zkProof?: string;
    zkCommitment?: string;
    txHash?: string;
    amount: number;
    timestamp: Date;
    refunded: boolean;
    signupCompleted: boolean;
    verified: boolean;
    verificationAttempts: number;
    lastVerificationAttempt?: Date;
    pinHash?: string;
    biometricHash?: string;
    biometricType?: string;
    verificationMethod?: string;
    refundTxHash?: string;
    refundTimestamp?: Date;
    senderWalletAddress?: string;
    createdAt: Date;
}
export declare class StorageAbstractionService {
    private config;
    private healthStatus;
    private healthCheckTimer?;
    constructor(config?: Partial<StorageConfig>);
    private startHealthMonitoring;
    private checkStorageHealth;
    getHealthStatus(): StorageHealthStatus;
    private selectStorage;
    private withRetry;
    private storeInIagon;
    private retrieveFromIagon;
    private updateInIagon;
    private deleteFromIagon;
    private storeInPostgreSQL;
    private retrieveFromPostgreSQL;
    private updateInPostgreSQL;
    private deleteFromPostgreSQL;
    storeUser(userData: Omit<UserData, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<{
        id: string;
    }>>;
    findUser(query: {
        userId?: string;
        walletAddress?: string;
        phoneHash?: string;
    }): Promise<StorageResult<UserData | null>>;
    updateUser(userId: string, updateData: Partial<UserData>): Promise<StorageResult<void>>;
    storeUserDeposit(depositData: Omit<UserDeposit, 'id' | 'createdAt'>): Promise<StorageResult<{
        id: string;
    }>>;
    findUserDeposits(query: {
        userId?: string;
        userAddress?: string;
        txHash?: string;
    }): Promise<StorageResult<UserDeposit[]>>;
    shutdown(): Promise<void>;
}
export declare const storageService: StorageAbstractionService;
//# sourceMappingURL=storage-abstraction.d.ts.map