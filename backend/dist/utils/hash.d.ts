/**
 * Hash a phone number using SHA-256
 * This should match the hash_phone function in the Aiken smart contract
 * @param {string} phone - Phone number to hash
 * @returns {string} - Hexadecimal hash
 */
export function hashPhone(phone: string): string;
/**
 * Hash biometric data using SHA-256
 * This should match the hash_biometric function in the Aiken smart contract
 * @param {string} biometric - Biometric data to hash
 * @returns {string} - Hexadecimal hash
 */
export function hashBiometric(biometric: string): string;
/**
 * Hash a passkey using SHA-256
 * This should match the hash_passkey function in the Aiken smart contract
 * @param {string} passkey - Passkey to hash
 * @returns {string} - Hexadecimal hash
 */
export function hashPasskey(passkey: string): string;
/**
 * Combine multiple hashes using SHA-256
 * This should match the combined_hash function in the Aiken smart contract
 * @param {Object} hashes - Object containing phoneHash, biometricHash, and passkeyHash
 * @returns {string} - Hexadecimal hash
 */
export function combinedHash(hashes: Object): string;
/**
 * Verify a hash against a value
 * This should match the verify_hash function in the Aiken smart contract
 * @param {string} value - Value to hash
 * @param {string} hash - Hash to verify against
 * @param {Function} hashFunction - Hash function to use
 * @returns {boolean} - Whether the hash is valid
 */
export function verifyHash(value: string, hash: string, hashFunction: Function): boolean;
//# sourceMappingURL=hash.d.ts.map