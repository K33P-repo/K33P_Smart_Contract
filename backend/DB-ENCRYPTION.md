# Database at-rest encryption (pgcrypto)

Encrypts K33P **credentials + wallet addresses** at rest using Postgres
`pgcrypto`, with deterministic **blind indexes** so equality lookups still work.

## What is encrypted

| Table | Encrypted (`*_enc` bytea) | Blind index (`*_bidx`) |
|-------|---------------------------|------------------------|
| `users` | `phone_hash`, `pin_hash`, `zk_commitment`, `wallet_address`, `sender_wallet_address` | `phone_hash_bidx`, `wallet_address_bidx` |
| `user_deposits` | `phone_hash`, `pin_hash`, `biometric_hash`, `zk_commitment`, `user_address`, `sender_wallet_address` | `user_address_bidx` |
| `auth_data` | `auth_hash` | — |

ZK proof blobs are intentionally **not** encrypted (per the chosen scope).

## Keys (store in a secret manager, never in git)

- `DB_ENCRYPTION_KEY` — pgcrypto symmetric key (>= 32 chars). Encrypts `*_enc`.
- `DB_BLIND_INDEX_KEY` — HMAC pepper (>= 32 chars). Computes `*_bidx`.

Both are read by `src/database/encryption.ts`. Losing `DB_ENCRYPTION_KEY` makes
encrypted data unrecoverable; rotate by re-encrypting (decrypt with old, encrypt
with new) under a maintenance window.

## Why blind indexes

`pgp_sym_encrypt` is randomized, so `WHERE phone_hash_enc = $x` can never match.
For columns we query by equality we store `HMAC-SHA256(DB_BLIND_INDEX_KEY, value)`
(deterministic) and match on that instead:

```sql
SELECT ... , pgp_sym_decrypt(phone_hash_enc, $key) AS phone_hash
FROM users WHERE phone_hash_bidx = $bidx;
```

## Rollout (phased, zero-downtime)

Code that references `*_enc` / `*_bidx` columns and migration **003** must deploy
**together** (the columns don't exist until 003 runs).

1. **Migrate (003, additive + backfill).** Keys passed as psql vars; disable
   statement logging for the session so keys aren't logged:
   ```sh
   psql "$DATABASE_URL" -v enc_key="$DB_ENCRYPTION_KEY" -v bidx_key="$DB_BLIND_INDEX_KEY" \
     -f src/database/migrations/003_encrypt_credentials_phase1.sql
   ```
2. **Deploy backend** with the data-layer wired to the encrypted columns
   (see “Integration points” below). Writes populate `*_enc` + `*_bidx`;
   reads decrypt; lookups use `*_bidx`.
3. **Verify** signup, login, phone-hash lookup, wallet lookup, deposits.
4. **Back up**, then run **004** to drop the plaintext columns:
   ```sh
   psql "$DATABASE_URL" -f src/database/migrations/004_encrypt_credentials_phase2_drop.sql
   ```

## Integration points (data layer)

Use the helpers in `src/database/encryption.ts` (`encryptValueExpr`,
`decryptColumnExpr`, `blindIndex`). The methods to switch from plaintext columns
to encrypted columns + blind-index lookups:

- `database/models.ts`
  - `UserModel.create` — write `*_enc` (via `pgp_sym_encrypt`) + `*_bidx`
    (via `blindIndex(...)`) instead of the plaintext columns.
  - `UserModel.findByUserId` / `findByWalletAddress` / `parseUser` — select
    `pgp_sym_decrypt(col, $key) AS col`; look up wallet by `wallet_address_bidx`.
  - `UserModel.update` / `updatePin` — encrypt on write, recompute blind index.
  - `UserDepositModel.create` / `findByUserId` / `update`, `AuthDataModel.*` —
    same treatment.
- `database/service.ts`
  - `getUserByPhoneHash` → `WHERE phone_hash_bidx = $1` with
    `blindIndex(phoneHash)`; decrypt returned columns.
  - `getUserByUsername` and any other raw `SELECT ... FROM users` that returns
    the encrypted columns.

> Keep every reference to the key as a **bound parameter** (`$n`) — never string
> interpolation — so it cannot leak into query logs.

## Related hardening

- `database/config.ts` now verifies TLS in production (`rejectUnauthorized: true`,
  optional `DB_SSL_CA`) and refuses to start without `DB_Password` in prod.
- `services/seed-phrase-storage.ts` now uses real AES-256-GCM (random IV + auth
  tag) with a key derived from `SEED_PHRASE_ENCRYPTION_KEY` (not the public
  userId). Existing seed phrases encrypted with the old scheme must be
  re-encrypted.
