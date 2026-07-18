// SPDX-License-Identifier: Apache-2.0
//
// ─── AUTOMATIC HASHING (Issue 5) ─────────────────────────────────────────────
//
// The NOK contract stores `nokHash` and keys records by `ownerIdentifier`, both
// of which are Compact `Field` values. Previously a human was expected to type
// the hash by hand — error-prone and insecure. These helpers derive the values
// in code, deterministically, from human-readable inputs (a K33P user id, phone
// number, wallet address, or the NOK's identifier) using SHA-256.
//
// A Compact `Field` is an element of the BLS12-381 scalar field, whose modulus
// is 254 bits. A raw SHA-256 digest is 256 bits and can exceed that modulus, so
// we reduce the digest modulo the field order to obtain a canonical Field value.

import { createHash } from 'node:crypto';

/** BLS12-381 scalar field modulus (r). All Field values live in [0, r). */
export const BLS12_381_SCALAR_FIELD_MODULUS =
  0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

/** Raw SHA-256 digest of a string or byte input (32 bytes). */
export function sha256(input: string | Uint8Array): Uint8Array {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return new Uint8Array(createHash('sha256').update(data).digest());
}

/** Big-endian bytes -> bigint. */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let acc = 0n;
  for (const b of bytes) acc = (acc << 8n) | BigInt(b);
  return acc;
}

/**
 * Hash an arbitrary human-readable input into a canonical Compact `Field`
 * value: SHA-256, interpreted big-endian, reduced modulo the scalar field.
 *
 * Deterministic: the same input always yields the same Field, so a value can be
 * recomputed at approve-time and compared against what was registered.
 */
export function sha256ToField(input: string | Uint8Array): bigint {
  return bytesToBigInt(sha256(input)) % BLS12_381_SCALAR_FIELD_MODULUS;
}

/**
 * Derive the on-chain `ownerIdentifier` Field from a stable K33P user handle
 * (e.g. the K33P user id, phone number, or wallet address). Domain-separated so
 * an owner identifier can never collide with a nok hash for the same input.
 */
export function ownerIdentifierToField(k33pUserHandle: string): bigint {
  return sha256ToField(`k33p:nok:owner:${k33pUserHandle}`);
}

/**
 * Derive the on-chain `nokHash` Field from the next-of-kin's identifier
 * (e.g. the NOK's phone number, email, or K33P id). Domain-separated.
 */
export function nokHashToField(nokIdentifier: string): bigint {
  return sha256ToField(`k33p:nok:hash:${nokIdentifier}`);
}
