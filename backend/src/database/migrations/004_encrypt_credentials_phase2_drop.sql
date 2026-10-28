-- ============================================================================
-- Migration 004 — At-rest encryption (Phase 2): drop plaintext columns
-- ============================================================================
--
-- DESTRUCTIVE. Run ONLY after:
--   1. Migration 003 has run and backfilled the `*_enc` / `*_bidx` columns.
--   2. The backend has been deployed reading/writing the encrypted columns
--      (via src/database/encryption.ts) and verified end-to-end (signup,
--      login, phone-hash lookup, wallet lookup).
--   3. A fresh database backup has been taken.
--
-- After this runs, the plaintext credential + wallet-address values no longer
-- exist in the database — only the encrypted (`*_enc`) and blind-index
-- (`*_bidx`) forms remain.
--
--   psql "$DATABASE_URL" -f 004_encrypt_credentials_phase2_drop.sql
-- ============================================================================

BEGIN;

-- users: drop plaintext, drop old plaintext indexes that referenced them.
DROP INDEX IF EXISTS idx_users_wallet_address;
ALTER TABLE users
  DROP COLUMN IF EXISTS phone_hash,
  DROP COLUMN IF EXISTS pin_hash,
  DROP COLUMN IF EXISTS zk_commitment,
  DROP COLUMN IF EXISTS wallet_address,
  DROP COLUMN IF EXISTS sender_wallet_address;

-- user_deposits: drop plaintext.
DROP INDEX IF EXISTS idx_user_deposits_user_address;
ALTER TABLE user_deposits
  DROP COLUMN IF EXISTS phone_hash,
  DROP COLUMN IF EXISTS pin_hash,
  DROP COLUMN IF EXISTS biometric_hash,
  DROP COLUMN IF EXISTS zk_commitment,
  DROP COLUMN IF EXISTS user_address,
  DROP COLUMN IF EXISTS sender_wallet_address;

-- auth_data: drop plaintext.
ALTER TABLE auth_data
  DROP COLUMN IF EXISTS auth_hash;

COMMIT;
