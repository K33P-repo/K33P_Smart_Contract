import { createHash, createHmac } from 'node:crypto';

export const BLS12_381_SCALAR_FIELD_MODULUS =
  0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

function resolveCommitmentSecret(customSecret?: string | Uint8Array): Buffer {
  const hashSalt = process.env.NOK_HASH_SALT;
  if (hashSalt && hashSalt.trim().length > 0) {
    return Buffer.from(hashSalt.trim(), 'utf8');
  }
  if (customSecret) {
    return typeof customSecret === 'string'
      ? Buffer.from(customSecret, 'utf8')
      : Buffer.from(customSecret);
  }
  const adminSecret = process.env.NOK_ADMIN_SECRET;
  if (adminSecret && adminSecret.trim().length > 0) {
    return Buffer.from(adminSecret.trim(), 'utf8');
  }
  throw new Error('Missing NOK commitment secret: set NOK_HASH_SALT or NOK_ADMIN_SECRET, or pass a secret parameter');
}

export function hmacSha256(input: string | Uint8Array, secret?: string | Uint8Array): Uint8Array {
  const secretKey = resolveCommitmentSecret(secret);
  const data = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return new Uint8Array(createHmac('sha256', secretKey).update(data).digest());
}

export function sha256(input: string | Uint8Array): Uint8Array {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return new Uint8Array(createHash('sha256').update(data).digest());
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let acc = 0n;
  for (const b of bytes) acc = (acc << 8n) | BigInt(b);
  return acc;
}

export function sha256ToField(input: string | Uint8Array): bigint {
  return bytesToBigInt(sha256(input)) % BLS12_381_SCALAR_FIELD_MODULUS;
}

export function hmacSha256ToField(input: string | Uint8Array, secret?: string | Uint8Array): bigint {
  return bytesToBigInt(hmacSha256(input, secret)) % BLS12_381_SCALAR_FIELD_MODULUS;
}

export function ownerIdentifierToField(k33pUserHandle: string, secret?: string | Uint8Array): bigint {
  return hmacSha256ToField(`k33p:nok:owner:${k33pUserHandle}`, secret);
}

export function nokHashToField(nokIdentifier: string, secret?: string | Uint8Array): bigint {
  return hmacSha256ToField(`k33p:nok:hash:${nokIdentifier}`, secret);
}

// ─── Identity registry field derivation ─────────────────────────────────────────
//
// Distinct `k33p:id:*` domain-separation prefixes guarantee identity keys never
// collide with NOK keys even though both registries share one contract.

/** Derive the on-chain user key (identities map key) from a K33P user id. */
export function userIdentifierToField(k33pUserId: string, secret?: string | Uint8Array): bigint {
  return hmacSha256ToField(`k33p:id:user:${k33pUserId}`, secret);
}

/**
 * Derive the credential commitment Field from the already-hashed credential
 * material. `credentialDigest` is whatever the backend commits to (e.g. a
 * combined hash of phoneHash|biometricHash|passkeyHash). The secret (admin
 * salt) binds the commitment so it cannot be recomputed by an observer.
 */
export function credentialCommitmentToField(credentialDigest: string, secret?: string | Uint8Array): bigint {
  return hmacSha256ToField(`k33p:id:commitment:${credentialDigest}`, secret);
}
