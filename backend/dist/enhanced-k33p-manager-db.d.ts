/**
 * Enhanced K33P Smart Contract handler with PostgreSQL database integration
 * This version replaces JSON file storage with PostgreSQL database
 */
interface SignupResult {
    success: boolean;
    message: string;
    verified?: boolean;
    depositAddress?: string;
}
interface RefundResult {
    success: boolean;
    message: string;
    txHash?: string;
}
export declare class EnhancedK33PManagerDB {
    private lucid?;
    private validator?;
    private depositAddress;
    private verifier;
    private initialized;
    constructor();
    initialize(): Promise<void>;
    private readFile;
    private ensureInitialized;
    getDepositAddress(): Promise<string>;
    /**
     * Verify transaction by wallet address
     */
    verifyTransactionByWalletAddress(senderWalletAddress: string, expectedAmount: bigint): Promise<any>;
    recordSignupWithVerification(userAddress: string, userId: string, phoneNumber: string, senderWalletAddress?: string, pin?: string, biometricData?: string, verificationMethod?: 'phone' | 'pin' | 'biometric', biometricType?: 'fingerprint' | 'faceid' | 'voice' | 'iris'): Promise<SignupResult>;
    retryVerification(userAddress: string): Promise<SignupResult>;
    autoVerifyDeposits(): Promise<void>;
    processRefund(userAddress: string, walletAddress?: string): Promise<RefundResult>;
    private hashData;
    private generateZKProof;
    /**
     * Load deposits in legacy format for compatibility
     */
    loadDeposits(): Promise<any[]>;
    /**
     * Monitor incoming transactions (placeholder for compatibility)
     */
    monitorIncomingTransactions(): Promise<void>;
    /**
     * Process signup completion
     */
    processSignup(userAddress: string): Promise<string>;
}
export {};
//# sourceMappingURL=enhanced-k33p-manager-db.d.ts.map