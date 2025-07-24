export interface User {
    id?: string;
    user_id: string;
    email?: string;
    name?: string;
    wallet_address?: string;
    phone_hash?: string;
    zk_commitment?: string;
    created_at?: Date;
    updated_at?: Date;
}
export interface UserDeposit {
    id?: string;
    user_address: string;
    user_id: string;
    phone_hash: string;
    zk_proof?: string;
    zk_commitment?: string;
    tx_hash?: string;
    amount: bigint;
    timestamp?: Date;
    refunded: boolean;
    signup_completed: boolean;
    verified: boolean;
    verification_attempts: number;
    last_verification_attempt?: Date;
    pin_hash?: string;
    biometric_hash?: string;
    biometric_type?: 'fingerprint' | 'faceid' | 'voice' | 'iris';
    verification_method?: 'phone' | 'pin' | 'biometric';
    refund_tx_hash?: string;
    refund_timestamp?: Date;
    sender_wallet_address?: string;
    created_at?: Date;
}
export interface Transaction {
    id?: string;
    tx_hash: string;
    from_address: string;
    to_address: string;
    amount: bigint;
    confirmations: number;
    block_time?: Date;
    transaction_type: 'deposit' | 'refund' | 'signup';
    status: 'pending' | 'confirmed' | 'failed';
    user_deposit_id?: string;
    created_at?: Date;
}
export interface ZKProof {
    id?: string;
    user_id: string;
    commitment: string;
    proof: string;
    public_inputs?: any;
    is_valid: boolean;
    created_at?: Date;
    verified_at?: Date;
}
export interface AuthData {
    id?: string;
    user_id: string;
    auth_type: 'phone' | 'pin' | 'biometric' | 'passkey';
    auth_hash: string;
    salt?: string;
    metadata?: any;
    is_active: boolean;
    created_at?: Date;
    last_used?: Date;
}
export declare class UserModel {
    static create(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
    static findByUserId(userId: string): Promise<User | null>;
    static findByWalletAddress(walletAddress: string): Promise<User | null>;
    static update(userId: string, updates: Partial<User>): Promise<User | null>;
    static getAll(): Promise<User[]>;
}
export declare class UserDepositModel {
    static create(deposit: Omit<UserDeposit, 'id' | 'timestamp'>): Promise<UserDeposit>;
    static findByUserAddress(userAddress: string): Promise<UserDeposit | null>;
    static findByUserId(userId: string): Promise<UserDeposit[]>;
    static update(userAddress: string, updates: Partial<UserDeposit>): Promise<UserDeposit | null>;
    static getAll(): Promise<UserDeposit[]>;
    static getUnverified(): Promise<UserDeposit[]>;
}
export declare class TransactionModel {
    static create(transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction>;
    static findByTxHash(txHash: string): Promise<Transaction | null>;
    static updateStatus(txHash: string, status: 'pending' | 'confirmed' | 'failed', confirmations?: number): Promise<Transaction | null>;
    static getAll(): Promise<Transaction[]>;
}
export declare class DatabaseManager {
    static initializeDatabase(): Promise<void>;
    static migrateFromJSON(): Promise<void>;
}
//# sourceMappingURL=models.d.ts.map