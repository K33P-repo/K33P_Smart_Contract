import { User, UserDeposit, Transaction } from './models.js';
export declare class MockDatabaseService {
    private static basePath;
    private static loadMockData;
    private static saveMockData;
    static getAllUsers(): Promise<User[]>;
    static findUserByAddress(address: string): Promise<User | null>;
    static findUserById(userId: string): Promise<User | null>;
    static getAllUserDeposits(): Promise<UserDeposit[]>;
    static findDepositByUserAddress(userAddress: string): Promise<UserDeposit | null>;
    static findDepositsByUserId(userId: string): Promise<UserDeposit[]>;
    static updateDepositRefundStatus(userAddress: string, refunded: boolean, refundTxHash?: string): Promise<boolean>;
    static getAllTransactions(): Promise<Transaction[]>;
    static findTransactionByHash(txHash: string): Promise<Transaction | null>;
    static createTransaction(transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction>;
    static testConnection(): Promise<boolean>;
    static initialize(): Promise<void>;
    static getUserById(userId: string): Promise<User | null>;
    static getDepositByUserAddress(userAddress: string): Promise<UserDeposit | null>;
    static createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User>;
    static createDeposit(depositData: Omit<UserDeposit, 'id' | 'created_at'>): Promise<UserDeposit>;
    static updateDeposit(userAddress: string, updates: Partial<UserDeposit>): Promise<boolean>;
    static markRefunded(userAddress: string, refundTxHash: string): Promise<boolean>;
    static incrementVerificationAttempts(userAddress: string): Promise<boolean>;
    static markDepositAsVerified(userAddress: string, txHash: string): Promise<boolean>;
    static getUnverifiedDeposits(): Promise<UserDeposit[]>;
}
export declare const USING_MOCK_DATABASE = true;
//# sourceMappingURL=mock-service.d.ts.map