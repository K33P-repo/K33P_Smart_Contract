// Database at-rest encryption helpers (Postgres pgcrypto).
//
// Strategy
// --------
// Sensitive credential + wallet-address columns are stored encrypted as `bytea`
// using pgcrypto's symmetric PGP functions (`pgp_sym_encrypt` /
// `pgp_sym_decrypt`). The symmetric key is held by the application (env
// `DB_ENCRYPTION_KEY`) and passed to every query as a bound parameter — it is
// never stored in the database.
//
// Because `pgp_sym_encrypt` is randomized (fresh salt per call), an encrypted
// column cannot be searched with `WHERE col = $value`. For columns we look up
// by equality (phone hash, wallet address, …) we additionally store a
// deterministic keyed BLIND INDEX: `HMAC-SHA256(DB_BLIND_INDEX_KEY, value)`.
// Lookups match on the blind index; the encrypted column holds the real value.
//
// Operational guardrails
// ----------------------
//  • Keep the key out of SQL/statement logs: all helpers below use bound
//    parameters ($n), never string interpolation. Disable `log_statement=all`
//    / set `log_min_duration_statement = -1` (or redact) in production.
//  • The key lives only in process memory, sourced from a secret manager in
//    production (not committed .env). See DB-ENCRYPTION.md.
import crypto from 'crypto';

/** Load + validate the pgcrypto symmetric key. Throws if missing/weak. */
export function getDbEncryptionKey(): string {
  const key = process.env.DB_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error('DB_ENCRYPTION_KEY is required for at-rest encryption (set it in your secret manager).');
  }
  if (key.length < 32) {
    throw new Error('DB_ENCRYPTION_KEY must be at least 32 characters.');
  }
  return key;
}

/** Load + validate the blind-index pepper. Throws if missing/weak. */
export function getBlindIndexKey(): Buffer {
  const key = process.env.DB_BLIND_INDEX_KEY?.trim();
  if (!key) {
    throw new Error('DB_BLIND_INDEX_KEY is required for searchable encryption (set it in your secret manager).');
  }
  if (key.length < 32) {
    throw new Error('DB_BLIND_INDEX_KEY must be at least 32 characters.');
  }
  return Buffer.from(key, 'utf8');
}

/**
 * Deterministic keyed blind index for a plaintext value, used in WHERE clauses
 * on encrypted columns. Returns a lowercase hex HMAC-SHA256 digest, or null for
 * nullish input so optional columns stay NULL.
 */
export function blindIndex(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return crypto.createHmac('sha256', getBlindIndexKey()).update(value, 'utf8').digest('hex');
}

// ─── SQL fragment builders ───────────────────────────────────────────────────
//
// These return a `{ sql, params }` pair you splice into a parameterised query.
// `nextParam` is the 1-based index of the first placeholder this fragment uses;
// callers thread it so placeholder numbers stay in order.

export interface SqlFragment {
  sql: string;
  params: unknown[];
}

/**
 * Build an INSERT/UPDATE value expression that encrypts `value` under the
 * pgcrypto key. Produces `pgp_sym_encrypt($a, $b)` and the two params
 * (value, key). A null/undefined value yields a literal NULL (no encryption).
 */
export function encryptValueExpr(value: string | null | undefined, nextParam: number): { expr: string; params: unknown[]; consumed: number } {
  if (value === null || value === undefined) {
    return { expr: 'NULL', params: [], consumed: 0 };
  }
  return {
    expr: `pgp_sym_encrypt($${nextParam}, $${nextParam + 1})`,
    params: [value, getDbEncryptionKey()],
    consumed: 2,
  };
}

/**
 * Build a SELECT expression that decrypts an encrypted column back to text:
 * `pgp_sym_decrypt(col, $k) AS alias`. The key is a bound param.
 */
export function decryptColumnExpr(column: string, alias: string, nextParam: number): { expr: string; params: unknown[]; consumed: number } {
  return {
    expr: `pgp_sym_decrypt(${column}, $${nextParam}) AS ${alias}`,
    params: [getDbEncryptionKey()],
    consumed: 1,
  };
}
