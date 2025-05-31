/**
 * Enhanced K33P Smart Contract handler with automatic transaction verification
 * Adds verification of user deposits via Blockfrost API
 */
interface TransactionDetails {
    txHash: string;
    amount: bigint;
    fromAddress: string;
    toAddress: string;
    timestamp: number;
    confirmations: number;
    valid: boolean;
}
interface VerificationResult {
    isValid: boolean;
    transaction?: TransactionDetails;
    error?: string;
}
declare class BlockchainVerifier {
    private apiKey;
    private baseUrl;
    private blockfrost;
    private depositAddress;
    constructor(apiKey: string, baseUrl: string);
    setDepositAddress(address: string): Promise<void>;
    /**
     * Verify transactions from a specific wallet address to our deposit address
     */
    verifyTransactionByWalletAddress(senderWalletAddress: string, expectedAmount: bigint): Promise<VerificationResult>;
    /**
     * Verify a transaction hash against our deposit requirements
     */
    verifyTransaction(txHash: string, expectedAmount: bigint, userAddress?: string): Promise<VerificationResult>;
    /**
     * Monitor incoming transactions to deposit address
     */
    getRecentTransactions(limit?: number): Promise<TransactionDetails[]>;
}
declare class EnhancedK33PManager {
    private readonly depositsFile;
    private lucid?;
    private validator?;
    private verifier;
    constructor();
    /**
     * Initialize the enhanced K33P manager
     */
    initialize(): Promise<void>;
    /**
     * Record signup with automatic transaction verification
     */
    recordSignupWithVerification(userAddress: string, userId: string, phoneNumber: string, senderWalletAddress?: string, // Make senderWalletAddress optional
    pin?: string, biometricData?: string, verificationMethod?: 'phone' | 'pin' | 'biometric', biometricType?: 'fingerprint' | 'faceid' | 'voice' | 'iris'): Promise<{
        success: boolean;
        message: string;
        verified: boolean;
        depositAddress?: string;
    }>;
    /**
     * Retry verification for unverified deposits
     */
    retryVerification(userAddress: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Auto-verify all unverified deposits
     */
    autoVerifyDeposits(): Promise<void>;
    /**
     * Monitor for new incoming transactions
     */
    monitorIncomingTransactions(): Promise<void>;
    /**
     * Process signup (only for verified deposits)
     */
    processSignup(userAddress: string): Promise<string>;
    /**
     * List deposits with verification status
     */
    listDepositsWithStatus(): void;
    private validateUserInput;
    private generatePhoneHash;
    private generatePinHash;
    private generateBiometricHash;
    private generateZKProof;
    private loadDeposits;
    private saveDeposits;
    private loadValidator;
    getDepositAddress(): Promise<string>;
}
export { EnhancedK33PManager, BlockchainVerifier };
//# sourceMappingURL=k33p-signup-interactions.d.ts.map