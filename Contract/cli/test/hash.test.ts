import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLS12_381_SCALAR_FIELD_MODULUS,
  hmacSha256,
  hmacSha256ToField,
  ownerIdentifierToField,
  nokHashToField,
  sha256ToField,
} from '../src/hash.ts';

test('hmacSha256 generates a 32-byte digest', () => {
  const secret = 'test-secret-salt-12345';
  const digest = hmacSha256('test-input', secret);
  assert.equal(digest.length, 32);
});

test('hmacSha256ToField produces values within BLS12-381 scalar field', () => {
  const secret = 'test-secret-salt-12345';
  const fieldVal = hmacSha256ToField('+15551234567', secret);
  assert.ok(typeof fieldVal === 'bigint');
  assert.ok(fieldVal >= 0n);
  assert.ok(fieldVal < BLS12_381_SCALAR_FIELD_MODULUS);
});

test('hash derivations are deterministic with same secret and input', () => {
  const secret = 'test-secret-salt-12345';
  const valA = nokHashToField('+15551234567', secret);
  const valB = nokHashToField('+15551234567', secret);
  assert.equal(valA, valB);
});

test('different secrets produce completely different field values', () => {
  const valA = nokHashToField('+15551234567', 'secret-a');
  const valB = nokHashToField('+15551234567', 'secret-b');
  assert.notEqual(valA, valB);
});

test('keyed commitment differs from legacy unsalted SHA-256', () => {
  const rawInput = 'k33p:nok:hash:+15551234567';
  const legacyVal = sha256ToField(rawInput);
  const keyedVal = nokHashToField('+15551234567', 'test-secret');
  assert.notEqual(legacyVal, keyedVal);
});

test('domain separation ensures ownerIdentifier and nokHash differ for same handle', () => {
  const secret = 'shared-secret';
  const handle = 'user-identifier-42';
  const ownerVal = ownerIdentifierToField(handle, secret);
  const nokVal = nokHashToField(handle, secret);
  assert.notEqual(ownerVal, nokVal);
});

test('uses environment secret fallback when secret argument is omitted', () => {
  const previousEnv = process.env.NOK_HASH_SALT;
  try {
    process.env.NOK_HASH_SALT = 'env-salt-xyz';
    const fieldVal = nokHashToField('+15551234567');
    const expected = nokHashToField('+15551234567', 'env-salt-xyz');
    assert.equal(fieldVal, expected);
  } finally {
    if (previousEnv === undefined) {
      delete process.env.NOK_HASH_SALT;
    } else {
      process.env.NOK_HASH_SALT = previousEnv;
    }
  }
});

test('throws error when secret is absent in arguments and environment', () => {
  const savedSalt = process.env.NOK_HASH_SALT;
  const savedAdmin = process.env.NOK_ADMIN_SECRET;
  try {
    delete process.env.NOK_HASH_SALT;
    delete process.env.NOK_ADMIN_SECRET;
    assert.throws(
      () => nokHashToField('+15551234567'),
      /Missing NOK commitment secret/
    );
  } finally {
    if (savedSalt !== undefined) process.env.NOK_HASH_SALT = savedSalt;
    if (savedAdmin !== undefined) process.env.NOK_ADMIN_SECRET = savedAdmin;
  }
});
