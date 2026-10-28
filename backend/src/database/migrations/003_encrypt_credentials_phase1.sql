-- ============================================================================
-- Migration 003 — At-rest encryption of credentials + wallet addresses (Phase 1)
-- ============================================================================
--
-- Phase 1 is ADDITIVE and non-destructive:
--   • adds encrypted `*_enc` (bytea) columns and deterministic `*_bidx`
--     blind-index columns alongside the existing plaintext columns,
--   • backfills them from the current plaintext values.
-- The plaintext columns are left in place so the app keeps working during the
-- transition. Phase 2 (migration 004) drops the plaintext columns once the
-- application has been switched to the encrypted columns and verified.
--
-- RUN (keys supplied as psql variables, never hard-coded; disable statement
-- logging for this session so the keys are not written to logs):
--
--   psql "$DATABASE_URL" \
--     -v enc_key="$DB_ENCRYPTION_KEY" \
--     -v bidx_key="$DB_BLIND_INDEX_KEY" \
--     -f 003_encrypt_credentials_phase1.sql
--
-- The same enc_key / bidx_key MUST be configured for the backend
-- (DB_ENCRYPTION_KEY / DB_BLIND_INDEX_KEY) or decryption/lookups will fail.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- ─── users ──────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_hash_enc            bytea,
  ADD COLUMN IF NOT EXISTS pin_hash_enc              bytea,
  ADD COLUMN IF NOT EXISTS zk_commitment_enc         bytea,
  ADD COLUMN IF NOT EXISTS wallet_address_enc        bytea,
  ADD COLUMN IF NOT EXISTS sender_wallet_address_enc bytea,
  ADD COLUMN IF NOT EXISTS phone_hash_bidx           varchar(64),
  ADD COLUMN IF NOT EXISTS wallet_address_bidx       varchar(64);

UPDATE users SET
  phone_hash_enc            = CASE WHEN phone_hash            IS NOT NULL THEN pgp_sym_encrypt(phone_hash,            :'enc_key') END,
  pin_hash_enc              = CASE WHEN pin_hash              IS NOT NULL THEN pgp_sym_encrypt(pin_hash,              :'enc_key') END,
  zk_commitment_enc         = CASE WHEN zk_commitment         IS NOT NULL THEN pgp_sym_encrypt(zk_commitment,         :'enc_key') END,
  wallet_address_enc        = CASE WHEN wallet_address        IS NOT NULL THEN pgp_sym_encrypt(wallet_address,        :'enc_key') END,
  sender_wallet_address_enc = CASE WHEN sender_wallet_address IS NOT NULL THEN pgp_sym_encrypt(sender_wallet_address, :'enc_key') END,
  phone_hash_bidx           = CASE WHEN phone_hash            IS NOT NULL THEN encode(hmac(phone_hash,     :'bidx_key', 'sha256'), 'hex') END,
  wallet_address_bidx       = CASE WHEN wallet_address        IS NOT NULL THEN encode(hmac(wallet_address, :'bidx_key', 'sha256'), 'hex') END;

CREATE INDEX IF NOT EXISTS idx_users_phone_hash_bidx     ON users(phone_hash_bidx);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address_bidx ON users(wallet_address_bidx);

-- ─── user_deposits ────────────────────────────────────────────────────────────
ALTER TABLE user_deposits
  ADD COLUMN IF NOT EXISTS phone_hash_enc            bytea,
  ADD COLUMN IF NOT EXISTS pin_hash_enc              bytea,
  ADD COLUMN IF NOT EXISTS biometric_hash_enc        bytea,
  ADD COLUMN IF NOT EXISTS zk_commitment_enc         bytea,
  ADD COLUMN IF NOT EXISTS user_address_enc          bytea,
  ADD COLUMN IF NOT EXISTS sender_wallet_address_enc bytea,
  ADD COLUMN IF NOT EXISTS user_address_bidx         varchar(64);

UPDATE user_deposits SET
  phone_hash_enc            = CASE WHEN phone_hash            IS NOT NULL THEN pgp_sym_encrypt(phone_hash,            :'enc_key') END,
  pin_hash_enc              = CASE WHEN pin_hash              IS NOT NULL THEN pgp_sym_encrypt(pin_hash,              :'enc_key') END,
  biometric_hash_enc        = CASE WHEN biometric_hash        IS NOT NULL THEN pgp_sym_encrypt(biometric_hash,        :'enc_key') END,
  zk_commitment_enc         = CASE WHEN zk_commitment         IS NOT NULL THEN pgp_sym_encrypt(zk_commitment,         :'enc_key') END,
  user_address_enc          = CASE WHEN user_address          IS NOT NULL THEN pgp_sym_encrypt(user_address,          :'enc_key') END,
  sender_wallet_address_enc = CASE WHEN sender_wallet_address IS NOT NULL THEN pgp_sym_encrypt(sender_wallet_address, :'enc_key') END,
  user_address_bidx         = CASE WHEN user_address          IS NOT NULL THEN encode(hmac(user_address, :'bidx_key', 'sha256'), 'hex') END;

CREATE INDEX IF NOT EXISTS idx_user_deposits_user_address_bidx ON user_deposits(user_address_bidx);

-- ─── auth_data ──────────────────────────────────────────────────────────────
ALTER TABLE auth_data
  ADD COLUMN IF NOT EXISTS auth_hash_enc bytea;

UPDATE auth_data SET
  auth_hash_enc = CASE WHEN auth_hash IS NOT NULL THEN pgp_sym_encrypt(auth_hash, :'enc_key') END;

COMMIT;
