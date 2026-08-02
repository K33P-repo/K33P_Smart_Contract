export interface NokResult {
    userId: string;
    ownerIdentifier: string;
    registered?: boolean;
    approved?: boolean;
}
/** Register a next-of-kin record for a K33P user. Admin write op. */
export declare function registerNokForUser(userId: string, nokIdentifier: string): Promise<NokResult>;
/** Approve a NOK-initiated login for a K33P user. Admin write op. */
export declare function approveNokLoginForUser(userId: string, nokIdentifier: string): Promise<NokResult>;
/** Read-only: is a NOK registered for this K33P user? */
export declare function checkNokRegisteredForUser(userId: string): Promise<NokResult>;
/** Read-only: contract ledger state (admin pubkey, round, record count). */
export declare function getNokContractState(): Promise<{
    contractAddress: string;
    adminPubKey: string;
    round: any;
    registeredCount: any;
} | null>;
//# sourceMappingURL=nok-service.d.ts.map