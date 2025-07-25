/**
 * ZK Proof Service for K33P Identity System
 * Automatically generates and stores ZK proofs for all database operations
 * Ensures every user registration and data entry has associated ZK proofs
 */
export interface ZKProofData {
    commitment: string;
    proof: any;
    publicInputs: any;
    isValid: boolean;
}
export interface UserZKData {
    userId: string;
    phoneNumber?: string;
    biometricData?: string;
    passkeyData?: string;
    userAddress?: string;
    additionalData?: Record<string, any>;
}
export declare class ZKProofService {
    /**
     * Generate and store ZK proof for a new user registration
     */
    static generateAndStoreUserZKProof(userData: UserZKData): Promise<ZKProofData>;
    /**
     * Generate and store ZK proof for any data entry
     */
    static generateAndStoreDataZKProof(userId: string, dataType: string, data: Record<string, any>): Promise<ZKProofData>;
    /**
     * Store ZK proof in PostgreSQL database
     */
    private static storeZKProofInDatabase;
    /**
     * Retrieve ZK proofs for a user
     */
    static getUserZKProofs(userId: string): Promise<any[]>;
    /**
     * Verify a ZK proof against stored data
     */
    static verifyStoredZKProof(userId: string, commitment: string): Promise<boolean>;
    /**
     * Get latest ZK proof for a user
     */
    static getLatestUserZKProof(userId: string): Promise<any | null>;
}
export default ZKProofService;
//# sourceMappingURL=zk-proof-service.d.ts.map