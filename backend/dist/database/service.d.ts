import { User, UserDeposit, Transaction } from './models.js';
export declare class DatabaseService {
    createUser(userData: {
        userId: string;
        email?: string;
        name?: string;
        walletAddress?: string;
        phoneHash?: string;
        zkCommitment?: string;
    }): Promise<User>;
    getUserById(userId: string): Promise<User | null>;
    getUserByWalletAddress(walletAddress: string): Promise<User | null>;
    updateUser(userId: string, updates: Partial<User>): Promise<User | null>;
    getAllUsers(): Promise<User[]>;
    createDeposit(depositData: {
        userAddress: string;
        userId: string;
        phoneHash: string;
        zkProof?: string;
        zkCommitment?: string;
        txHash?: string;
        amount: bigint;
        senderWalletAddress?: string;
        pinHash?: string;
        biometricHash?: string;
        biometricType?: 'fingerprint' | 'faceid' | 'voice' | 'iris';
        verificationMethod?: 'phone' | 'pin' | 'biometric';
    }): Promise<UserDeposit>;
    getDepositByUserAddress(userAddress: string): Promise<UserDeposit | null>;
    getDepositsByUserId(userId: string): Promise<UserDeposit[]>;
    updateDeposit(userAddress: string, updates: Partial<UserDeposit>): Promise<UserDeposit | null>;
    getAllDeposits(): Promise<UserDeposit[]>;
    getUnverifiedDeposits(): Promise<UserDeposit[]>;
    markDepositAsVerified(userAddress: string, txHash?: string): Promise<UserDeposit | null>;
    incrementVerificationAttempts(userAddress: string): Promise<UserDeposit | null>;
    markSignupCompleted(userAddress: string, txHash: string): Promise<UserDeposit | null>;
    markRefunded(userAddress: string, refundTxHash: string): Promise<UserDeposit | null>;
    createTransaction(transactionData: {
        txHash: string;
        fromAddress: string;
        toAddress: string;
        amount: bigint;
        confirmations: number;
        blockTime?: Date;
        transactionType: 'deposit' | 'refund' | 'signup';
        status?: 'pending' | 'confirmed' | 'failed';
        userDepositId?: string;
    }): Promise<Transaction>;
    getTransactionByHash(txHash: string): Promise<Transaction | null>;
    updateTransactionStatus(txHash: string, status: 'pending' | 'confirmed' | 'failed', confirmations?: number): Promise<Transaction | null>;
    getAllTransactions(): Promise<Transaction[]>;
    /**
     * Load deposits in the format expected by the existing K33P manager
     * This maintains compatibility with existing code
     */
    loadDeposits(): Promise<any[]>;
    /**
     * Save deposits in the format expected by the existing K33P manager
     * This maintains compatibility with existing code
     */
    saveDeposits(deposits: any[]): Promise<void>;
    /**
     * Find a deposit by user address (legacy format)
     */
    findDepositByUserAddress(userAddress: string): Promise<any | null>;
    getStatistics(): Promise<{
        totalUsers: number;
        totalDeposits: number;
        verifiedDeposits: number;
        refundedDeposits: number;
        completedSignups: number;
        totalDepositAmount: string;
        totalRefundAmount: string;
    }>;
    cleanupOldRecords(daysOld?: number): Promise<number>;
}
export declare const dbService: DatabaseService;
//# sourceMappingURL=service.d.ts.map