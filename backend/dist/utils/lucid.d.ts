export function initLucid(): Promise<Lucid>;
export const IdentityDatumSchema: import("lucid-cardano/esm/deps/deno.land/x/typebox@0.25.13/src/typebox").TObject<{
    phone_hash: import("lucid-cardano/esm/deps/deno.land/x/typebox@0.25.13/src/typebox").TUnsafe<string>;
    biometric_hash: import("lucid-cardano/esm/deps/deno.land/x/typebox@0.25.13/src/typebox").TUnsafe<string>;
    passkey_hash: import("lucid-cardano/esm/deps/deno.land/x/typebox@0.25.13/src/typebox").TUnsafe<string>;
    wallet_address: import("lucid-cardano/esm/deps/deno.land/x/typebox@0.25.13/src/typebox").TUnsafe<string>;
    created_at: import("lucid-cardano/esm/deps/deno.land/x/typebox@0.25.13/src/typebox").TUnsafe<bigint>;
}>;
/**
 * Create a signup transaction
 * @param {string} userAddress - User's wallet address
 * @param {Object} userHashes - Object containing phone_hash, biometric_hash, and passkey_hash
 * @returns {Promise<string>} - Transaction hash
 */
export function signupTxBuilder(userAddress: string, userHashes: Object): Promise<string>;
/**
 * Issue a refund for a UTXO
 * @param {string} ownerAddress - Owner's wallet address
 * @param {Object} scriptUtxo - UTXO to refund
 * @returns {Promise<string>} - Transaction hash
 */
export function refundTx(ownerAddress: string, scriptUtxo: Object): Promise<string>;
/**
 * Fetch UTXOs at script address
 * @param {string} phoneHash - Phone hash to filter UTXOs
 * @returns {Promise<Array>} - Array of UTXOs
 */
export function fetchUtxos(phoneHash: string): Promise<any[]>;
import { Lucid } from 'lucid-cardano';
//# sourceMappingURL=lucid.d.ts.map