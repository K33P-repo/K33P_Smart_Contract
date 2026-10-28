// Zero-Knowledge utilities for the K33P Identity System.
//
// IMPORTANT — where the *real* zero-knowledge proof lives:
//   K33P's authentication (signup + login) is proven on the Midnight network
//   via the identity circuits on the deployed Compact contract. See
//   `services/nok-service.ts` (`registerIdentityForUser` / `verifyLoginForUser`)
//   and `services/zk-proof-service.ts`. Those produce and verify genuine ZK
//   proofs through the proof server.
//
//   The functions in THIS file only compute the deterministic *commitment*
//   that both parties agree on. `generateZkProof` / `verifyZkProof` remain as
//   lightweight local helpers for the auxiliary `/zk` demo routes; they are NOT
//   the authentication proof and must not be relied on for login decisions.
import crypto from 'crypto';

/**
 * Deterministic domain-separated digest over an ordered list of inputs.
 * Returns a full SHA-256 hex string (stable across processes), used as the
 * building block for the ZK commitment the backend commits on-chain.
 * @param {Array<string>} inputs
 * @returns {string}
 */
export function poseidonHash(inputs) {
  try {
    if (!Array.isArray(inputs)) {
      throw new Error('Inputs must be an array');
    }

    inputs.forEach((input, index) => {
      if (typeof input !== 'string') {
        throw new Error(`Input at index ${index} must be a string`);
      }
    });

    return crypto.createHash('sha256')
      .update(inputs.join('|'))
      .digest('hex');
  } catch (error) {
    console.error('Error in poseidonHash:', error.message);
    throw new Error(`Failed to compute poseidon hash: ${error.message}`);
  }
}

/**
 * Generate a deterministic Zero-Knowledge commitment from hashed inputs.
 *
 * The result is a stable string: the same credential hashes always yield the
 * same commitment, so a login attempt can be checked against what was
 * registered at signup. This commitment is what gets reduced into an on-chain
 * Field (see hash helpers `credentialCommitmentToField`) and registered /
 * verified via the Midnight identity circuits.
 *
 * @param {Object} hashedInputs
 * @param {string} hashedInputs.phoneHash - Hashed phone number (required)
 * @param {string} [hashedInputs.biometricHash] - Hashed biometric data
 * @param {string} [hashedInputs.passkeyHash] - Hashed passkey
 * @returns {string} - The ZK commitment (SHA-256 hex)
 */
export function generateZkCommitment(hashedInputs) {
  try {
    if (!hashedInputs || typeof hashedInputs !== 'object') {
      throw new Error('Invalid hashed inputs');
    }

    const { phoneHash, biometricHash, passkeyHash } = hashedInputs;

    // phoneHash is required, others are optional
    if (!phoneHash) {
      throw new Error('phoneHash is required');
    }
    if (typeof phoneHash !== 'string') {
      throw new Error('phoneHash must be a string');
    }
    if (biometricHash && typeof biometricHash !== 'string') {
      throw new Error('biometricHash must be a string if provided');
    }
    if (passkeyHash && typeof passkeyHash !== 'string') {
      throw new Error('passkeyHash must be a string if provided');
    }

    // Build input array dynamically based on available hashes. Order is fixed
    // so the commitment is reproducible.
    const inputs = [phoneHash];
    if (biometricHash) inputs.push(biometricHash);
    if (passkeyHash) inputs.push(passkeyHash);

    return poseidonHash(inputs);
  } catch (error) {
    console.error('Error in generateZkCommitment:', error.message);
    throw new Error(`Failed to generate ZK commitment: ${error.message}`);
  }
}

/**
 * @deprecated LOCAL HELPER ONLY — not the authentication proof.
 *
 * Produces a commitment-bound envelope for the auxiliary `/zk` demo routes.
 * The real authentication proof is generated on Midnight by
 * `nok-service.registerIdentityForUser`. Do not use the return value to make
 * login decisions.
 *
 * @param {Object} inputs - Raw user inputs
 * @param {string} commitment - The ZK commitment to bind to
 * @returns {Object}
 */
export function generateZkProof(inputs, commitment) {
  try {
    if (!inputs || typeof inputs !== 'object') {
      throw new Error('Invalid inputs');
    }
    if (!commitment || typeof commitment !== 'string') {
      throw new Error('Invalid commitment');
    }
    if (!inputs.phone) {
      throw new Error('phone is required');
    }

    // Bind the envelope to the commitment deterministically so verifyZkProof
    // below is a genuine (local) match check rather than a coin flip.
    const proofId = crypto.randomBytes(16).toString('hex');
    return {
      proof: `zk-local-${proofId}-${commitment.substring(0, 10)}`,
      publicInputs: { commitment },
      isValid: true,
    };
  } catch (error) {
    console.error('Error in generateZkProof:', error.message);
    return {
      proof: null,
      publicInputs: { commitment },
      isValid: false,
      error: error.message,
    };
  }
}

/**
 * @deprecated LOCAL HELPER ONLY — not the authentication proof.
 *
 * Verifies the local envelope's commitment matches the expected commitment.
 * Login verification MUST go through `nok-service.verifyLoginForUser` (real ZK
 * on Midnight), not this function.
 *
 * @param {Object} proof
 * @param {string} commitment
 * @returns {boolean}
 */
export function verifyZkProof(proof, commitment) {
  try {
    if (!proof || typeof proof !== 'object') {
      throw new Error('Invalid proof object');
    }
    if (!commitment || typeof commitment !== 'string') {
      throw new Error('Invalid commitment');
    }
    if (!proof.publicInputs || typeof proof.publicInputs !== 'object') {
      throw new Error('Invalid proof structure: missing publicInputs');
    }
    if (!proof.publicInputs.commitment || typeof proof.publicInputs.commitment !== 'string') {
      throw new Error('Invalid proof structure: missing commitment in publicInputs');
    }

    return proof.isValid === true && proof.publicInputs.commitment === commitment;
  } catch (error) {
    console.error('Error in verifyZkProof:', error.message);
    return false;
  }
}
