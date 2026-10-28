# K33P Upgrade — Real server-side ZK (Midnight) + at-rest DB encryption

This change makes K33P's authentication use **real zero-knowledge proofs on
Midnight** (replacing the previous simulated proofs) and lays the foundation for
**encrypting credentials + wallet addresses at rest** with Postgres `pgcrypto`.
The UI contract is unchanged.

Approach: a single Compact contract (the existing NOK contract extended with an
identity registry — no new contract, no contract-to-contract calls). The backend
is the off-chain admin client. See `plan` / `backend/DB-ENCRYPTION.md` for depth.

---

## Component: Compact contract (`Contract/contract`)

**Upgraded**
- `src/nok.compact`: added a `RegisteredIdentity` struct and an `identities`
  map, plus admin-gated circuits `register_identity`, `verify_login`, and the
  read-only `check_identity_registered`. Reuses the existing `admin` /
  `secretKey` / `publicKey` / `assertAdmin` / `round` — one contract now holds
  both the NOK and identity registries in separate maps (no key collision).

**Not changed**
- NOK circuits, admin/sealed-key model, constructor.

**Action required**
- Recompile (`npm run compact` / `build:all`) to regenerate `src/managed/nok`
  with the new circuits, then **redeploy** (preview is fine — no data migration).

---

## Component: Deploy/Admin CLI (`Contract/cli`)

**Upgraded**
- `src/nok-api.ts`: `registerIdentity`, `verifyLogin`, `isIdentityRegistered`
  wrappers; `registeredIdentityCount` added to the ledger-state readout.
- `src/hash.ts`: `userIdentifierToField` and `credentialCommitmentToField`
  (distinct `k33p:id:*` domain-separation prefixes vs the NOK `k33p:nok:*`).
- `.env.example`: note that one admin secret / one address covers both
  registries.

**Not changed**
- `deploy.ts` / `admin.ts` deploy flow (identity ships on the same contract, so
  the existing deploy produces the combined contract automatically).

---

## Component: Backend (`backend`)

**Upgraded — real ZK auth**
- `src/services/nok-service.ts`: `registerIdentityForUser`,
  `verifyLoginForUser`, `checkIdentityRegisteredForUser` (reuse the cached
  contract context).
- `src/utils/zk.js`: commitments are now **real/deterministic**; the simulated
  `generateZkProof`/`verifyZkProof` are explicitly marked legacy and used only
  by the auxiliary `/zk` demo routes — never for login decisions.
- `src/services/zk-proof-service.ts`: registers the commitment on Midnight at
  signup (the real ZK step).
- `src/middleware/auth.ts`: `verifyZkProof` is now a presence guard; the real
  cryptographic check happens in the handler.
- `src/routes/auth.js`: `/login` verifies via `verifyLoginForUser` (the old
  `user.zkCommitment !== commitment` string-compare is removed); `handleSignup`
  registers the identity on-chain. **Request/response shape unchanged.**

**Upgraded — database encryption foundation**
- `src/database/encryption.ts` (new): pgcrypto SQL helpers + keyed blind-index
  + key loading/validation.
- `src/database/migrations/003_encrypt_credentials_phase1.sql` (new): additive
  columns + backfill.
- `src/database/migrations/004_encrypt_credentials_phase2_drop.sql` (new): drops
  the plaintext columns (run after verification).
- `src/database/schema.sql`: encrypted `*_enc` + blind-index `*_bidx` columns
  and indexes (fresh installs).
- `src/database/config.ts`: TLS verification in production (`DB_SSL*`) and
  refuses to start without `DB_Password` in prod.
- `src/services/seed-phrase-storage.ts`: **security fix** — replaced the broken
  `crypto.createCipher('aes-256-cbc')` (no IV, MD5 KDF, key = public `userId`)
  with real AES-256-GCM keyed by `SEED_PHRASE_ENCRYPTION_KEY`.
- `.env.example` (new) + `DB-ENCRYPTION.md` (new): config + rollout guide.

**Not changed / NOT yet done**
- **D2 (follow-up, needs a live DB):** wiring `models.ts` / `service.ts` user,
  deposit and auth queries to read/write the encrypted columns + blind-index
  lookups. Must be deployed together with migration 003, then verified, then 004
  dropped. See `DB-ENCRYPTION.md` → “Integration points”.
- ZK proof blobs are intentionally not encrypted (chosen scope: credentials +
  wallet addresses only).
- Backend still receives raw credentials (Option 2 is server-side proving); full
  zero-trust / client-side proving is a future Option 3 (Passport-aligned).

---

## Component: Cardano validator (`smart_contract_validator`)

**Not changed.** The Aiken validator and the ADA deposit/refund escrow are left
as-is; Cardano continues to handle value/refunds while Midnight handles the
credential ZK.

---

## Component: Frontend (`temp_frontend`)

**Not changed.** The `{commitment, proof}` login/signup API shape is preserved,
so no UI changes are required for this upgrade.

---

## Build / verify (run in WSL — Compact compiler + node_modules required)

```sh
cd Contract && npm install && npm run build:all && npm run build -w @k33p/nok-cli
cd ../backend && npm install && npm run build
cd ../Contract && npm run deploy          # redeploy combined contract (preview) -> NOK_CONTRACT_ADDRESS
# DB encryption rollout: backend/DB-ENCRYPTION.md (migration 003 -> wire D2 -> verify -> 004)
```

## New environment variables
- Backend: `DB_ENCRYPTION_KEY`, `DB_BLIND_INDEX_KEY`, `SEED_PHRASE_ENCRYPTION_KEY`,
  optional `DB_SSL*`; plus the Midnight client vars `NOK_CONTRACT_ADDRESS`,
  `NOK_ADMIN_SECRET`, `NOK_WALLET_SEED`, `PROOF_SERVER_URL`, `MIDNIGHT_NETWORK`
  (and `MIDNIGHT_BLOCKFROST_PROJECT_ID` on mainnet). See `backend/.env.example`.


