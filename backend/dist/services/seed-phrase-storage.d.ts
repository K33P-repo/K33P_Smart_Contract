export interface SeedPhraseEntry {
    id: string;
    userId: string;
    walletName: string;
    walletType: 'cardano' | 'bitcoin' | 'ethereum' | 'other';
    mnemonicType: '12-word' | '24-word';
    encryptedSeedPhrase: string;
    encryptionSalt: string;
    walletAddress?: string;
    createdAt: Date;
    lastAccessed?: Date;
}
export interface SeedPhraseStorageConfig {
    encryptionAlgorithm: string;
    keyDerivationRounds: number;
    saltLength: number;
}
export declare class SeedPhraseStorageService {
    private config;
    private iagonAPI;
    constructor(config?: Partial<SeedPhraseStorageConfig>);
    /**
     * Store a seed phrase securely on Iagon
     */
    storeSeedPhrase(userId: string, walletName: string, seedPhrase: string, walletType: 'cardano' | 'bitcoin' | 'ethereum' | 'other', walletAddress?: string): Promise<SeedPhraseEntry>;
    /**
     * Retrieve user's stored seed phrases (metadata only)
     */
    getUserSeedPhrases(userId: string): Promise<Omit<SeedPhraseEntry, 'encryptedSeedPhrase' | 'encryptionSalt'>[]>;
    /**
     * Retrieve and decrypt a specific seed phrase
     */
    retrieveSeedPhrase(seedPhraseId: string, userId: string, encryptionPassword: string): Promise<{
        seedPhrase: string;
        walletName: string;
        walletType: string;
        mnemonicType: string;
    }>;
    private validateAndDetectMnemonicType;
    private deriveEncryptionKey;
    private encryptSeedPhrase;
    private decryptSeedPhrase;
    private storeOnIagon;
    private updateOnIagon;
    private getSeedPhraseById;
    private updateSeedPhraseEntry;
}
export default SeedPhraseStorageService;
//# sourceMappingURL=seed-phrase-storage.d.ts.map