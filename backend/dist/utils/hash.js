// Hashing utilities for K33P Identity System
import crypto from 'crypto';

/**
 * Hash a phone number using SHA-256
 * This should match the hash_phone function in the Aiken smart contract
 * @param {string} phone - Phone number to hash
 * @returns {string} - Hexadecimal hash
 */
const hashPhone = (phone) => {
  return crypto.createHash('sha256')
    .update(`phone:${phone}`)
    .digest('hex');
};

/**
 * Hash biometric data using SHA-256
 * This should match the hash_biometric function in the Aiken smart contract
 * @param {string} biometric - Biometric data to hash
 * @returns {string} - Hexadecimal hash
 */
const hashBiometric = (biometric) => {
  return crypto.createHash('sha256')
    .update(`biometric:${biometric}`)
    .digest('hex');
};

/**
 * Hash a passkey using SHA-256
 * This should match the hash_passkey function in the Aiken smart contract
 * @param {string} passkey - Passkey to hash
 * @returns {string} - Hexadecimal hash
 */
const hashPasskey = (passkey) => {
  return crypto.createHash('sha256')
    .update(`passkey:${passkey}`)
    .digest('hex');
};

/**
 * Combine multiple hashes using SHA-256
 * This should match the combined_hash function in the Aiken smart contract
 * @param {Object} hashes - Object containing phoneHash, biometricHash, and passkeyHash
 * @returns {string} - Hexadecimal hash
 */
const combinedHash = (hashes) => {
  const { phoneHash, biometricHash, passkeyHash } = hashes;
  return crypto.createHash('sha256')
    .update(`${phoneHash}${biometricHash}${passkeyHash}`)
    .digest('hex');
};

/**
 * Verify a hash against a value
 * This should match the verify_hash function in the Aiken smart contract
 * @param {string} value - Value to hash
 * @param {string} hash - Hash to verify against
 * @param {Function} hashFunction - Hash function to use
 * @returns {boolean} - Whether the hash is valid
 */
const verifyHash = (value, hash, hashFunction) => {
  return hashFunction(value) === hash;
};

export {
  hashPhone,
  hashBiometric,
  hashPasskey,
  combinedHash,
  verifyHash
};