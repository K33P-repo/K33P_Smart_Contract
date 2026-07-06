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
    static generateAndStoreUserZKProof(userData: UserZKData): Promise<ZKProofData>;
    static generateAndStoreDataZKProof(userId: string, dataType: string, data: Record<string, any>): Promise<ZKProofData>;
    private static storeZKProofInDatabase;
    static getUserZKProofs(userId: string): Promise<any[]>;
    static verifyStoredZKProof(userId: string, commitment: string): Promise<boolean>;
    static getLatestUserZKProof(userId: string): Promise<any | null>;
    static getUserByPhoneHash(phoneHash: string): Promise<any | null>;
    static getUserById(userId: string): Promise<any | null>;
    static getUserByWalletAddress(walletAddress: string): Promise<any | null>;
    static createUser(userData: {
        userId: string;
        walletAddress?: string;
        phoneHash: string;
        zkCommitment: string;
        authMethods: any[];
        verificationMethod: string;
    }): Promise<any>;
    static updateUser(userId: string, updates: any): Promise<any>;
}
export default ZKProofService;
//# sourceMappingURL=zk-proof-service.d.ts.map