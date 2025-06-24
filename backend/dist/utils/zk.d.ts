/**
 * Simulated Poseidon hash function for ZK proofs
 * In a production environment, this would be replaced with a real ZK-friendly hash function
 * @param {Array<string>} inputs - Array of input values to hash
 * @returns {string} - The hash result
 */
export function poseidonHash(inputs: Array<string>): string;
/**
 * Generate a Zero-Knowledge commitment from hashed inputs
 * @param {Object} hashedInputs - Object containing hashed inputs
 * @param {string} hashedInputs.phoneHash - Hashed phone number
 * @param {string} hashedInputs.biometricHash - Hashed biometric data
 * @param {string} hashedInputs.passkeyHash - Hashed passkey
 * @returns {string} - The ZK commitment
 */
export function generateZkCommitment(hashedInputs: {
    phoneHash: string;
    biometricHash: string;
    passkeyHash: string;
}): string;
/**
 * Generate a Zero-Knowledge proof
 * This is a simulated implementation for demonstration purposes
 * In a production environment, this would generate an actual ZK proof
 * @param {Object} inputs - Raw user inputs
 * @param {string} commitment - The ZK commitment to prove
 * @returns {Object} - The ZK proof object
 */
export function generateZkProof(inputs: Object, commitment: string): Object;
/**
 * Verify a Zero-Knowledge proof
 * This is a simulated implementation for demonstration purposes
 * In a production environment, this would verify an actual ZK proof
 * @param {Object} proof - The ZK proof object
 * @param {string} commitment - The ZK commitment to verify against
 * @returns {boolean} - Whether the proof is valid
 */
export function verifyZkProof(proof: Object, commitment: string): boolean;
//# sourceMappingURL=zk.d.ts.map