# K33P — Full System Threat Model

> **Scope**: K33P end-to-end system — React Native mobile app (`k33p-mobile`) +
> Node/TypeScript backend (`K33P_Smart_Contract/backend`) + Aiken on-chain validator +
> Midnight NOK contract + Iagon off-chain storage.
>
> **As-of**: 2026-09-18
> **Methodology**: STRIDE + data-flow tracing against actual source files.
> **Classification**: Internal — Pre-Mainnet Security Review

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Key Hierarchy — Full Chain](#2-key-hierarchy--full-chain)
3. [Biometrics → Sub-Key Mapping](#3-biometrics--sub-key-mapping)
4. [Inheritance (NOK) Timer Mechanics](#4-inheritance-nok-timer-mechanics)
5. [Trust Boundaries](#5-trust-boundaries)
6. [STRIDE Threat Table](#6-stride-threat-table)
7. [Detailed Findings](#7-detailed-findings)
8. [Cryptographic Primitives Summary](#8-cryptographic-primitives-summary)
9. [Consolidated Remediation Plan](#9-consolidated-remediation-plan)

---

## 1. System Overview

K33P is a crypto-wallet seed-phrase vault. Users register with phone/PIN/biometrics.
A ZK commitment is generated server-side, a Cardano on-chain vault is created
(2 ADA collateral), and seed-phrase fragments are encrypted and stored remotely.
A Next-of-Kin (NOK) flow enables inheritance access via a Midnight smart contract.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARY 1: User Device (iOS / Android)                 │
│                                                                                      │
│  React Native UI                                                                     │
│    ├── expo-secure-store  (iOS Keychain / Android Keystore)  — OS-level encryption   │
│    ├── AsyncStorage       (unencrypted plaintext)                                    │
│    ├── useAuthMethod      (Zustand + AsyncStorage)  ← JWT + userId + phone           │
│    ├── useAuthStore       (Zustand + SecureStore)   ← faceData + authToken           │
│    └── UserKeyManager     (PBKDF2 100k, SecureStore per-purpose key)                 │
│                                                                                      │
│  Client-side crypto:                                                                 │
│    phoneKey  = AES-ECB(PBKDF2(phone, SHA512(salt:phone), 1k))   ← WEAK              │
│    pinKey    = AES-ECB(PBKDF2(PIN+userId, userId, 1k))          ← WEAK              │
│    phraseKey = AES-CBC(SHA256(phone), randomIV)                 ← low-entropy key   │
└──────────────────┬───────────────────────────────────────────────────────────────────┘
                   │  HTTPS / JWT Bearer
                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARY 2: K33P Backend (Render)                       │
│                                                                                      │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │ hash.js        │  │ zk.js            │  │ SeedPhraseStorageService             │ │
│  │ SHA-256 prefix │─▶│ poseidonHash     │  │  PBKDF2(userId, salt, 100k)          │ │
│  │ hashing        │  │ (simulated only) │  │  AES-256-CBC / createCipher (WEAK)   │ │
│  └────────────────┘  └──────────────────┘  └──────────────────────────────────────┘ │
│         │                    │                           │                           │
│         ▼                    ▼                           ▼                           │
│  ┌─────────────────────────────┐         ┌────────────────────────────────────────┐ │
│  │ PostgreSQL                  │         │ Iagon Decentralised Storage             │ │
│  │  users, auth_data, zk_proofs│         │  encrypted seed phrase blobs            │ │
│  └─────────────────────────────┘         └────────────────────────────────────────┘ │
│                                                                                      │
│  ┌─────────────────────────────┐         ┌────────────────────────────────────────┐ │
│  │ Lucid / Blockfrost          │         │ nok-service.ts → @k33p/nok-cli          │ │
│  │  SEED_PHRASE wallet signing │         │  NOK_ADMIN_SECRET + NOK_WALLET_SEED     │ │
│  └─────────────────────────────┘         └────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────┬────────────────────────────┘
                   │  Cardano Preprod / Mainnet            │  Midnight preview network
                   ▼                                       ▼
┌──────────────────────────────┐        ┌─────────────────────────────────────────────┐
│  TRUST BOUNDARY 3: Cardano   │        │  TRUST BOUNDARY 4: Midnight L1              │
│  combined_validator.ak        │        │  NOK contract (nok.compact)                 │
│  AuthDatum / IdentityDatum    │        │  admin-gated register / approve_nok_login   │
└──────────────────────────────┘        └─────────────────────────────────────────────┘
                                                         │
                                                         ▼
                                        ┌─────────────────────────────────────────────┐
                                        │  TRUST BOUNDARY 5: Vault / Iagon             │
                                        │  fileId bearer-token access                  │
                                        │  DELETE unauthenticated in fullFolderCleanup │
                                        └─────────────────────────────────────────────┘
```

---

## 2. Key Hierarchy — Full Chain

### 2.1 Client-side derivation (mobile app)

```
User enters: phoneNumber, PIN, biometricBlob
│
├─ phoneKey
│   = AES-ECB( PBKDF2(phone, SHA512("phone-key-salt:"+phone), 1000 iter, 256-bit) )
│   → sent to backend as authMethod.data   [phoneEncryption.ts]
│   ⚠ AES-ECB: no IV, identical blocks produce identical ciphertext
│   ⚠ 1000 PBKDF2 iterations (OWASP minimum: 310 000 for PBKDF2-SHA1)
│
├─ pinKey
│   = AES-ECB( PBKDF2(PIN+userId, userId, 1000 iter, 256-bit) )
│   → sent to backend as authMethod.data   [pinEncryption.ts]
│   → pinHash = PBKDF2(PIN, userId, 1000 iter, 512-bit) sent as pinHash
│   ⚠ AES-ECB, salt = userId (non-secret, predictable)
│
├─ phraseKey
│   = SHA256(phoneNumber) → used as AES-CBC-128 key with random 16-byte IV
│   → encrypts seed-phrase fragments                [crypto.ts]
│   ⚠ Key entropy = entropy of phone number (~34 bits)
│
└─ userDerivedKey (per-purpose, per-userId)
    = PBKDF2(userPassword, SHA256(userId+purpose+":salt"), 100 000 iter, 256-bit)
    → stored in SecureStore as "user_{userId}_{purpose}_key" [keyDerivation.ts]
    ✓ Acceptable iteration count; only correct derivation in client
```

### 2.2 Server-side derivation (backend)

```
Phone number (received from client)
    │  SHA-256("phone:" + phone)                       hash.js:10-13
    ▼
phoneHash  (32-byte hex, no salt) ────────────────────────────────────┐
    ⚠ Brute-forceable: ~10^10 phone numbers enumerable in < 1 hr      │
    ⚠ PHONE_HASH_SALT env var exists but is NOT applied in hash.js     │
                                                                       │
Biometric blob                                                         │
    │  SHA-256("biometric:" + blob)                    hash.js:22-25   │
    ▼                                                                  │
biometricHash (32-byte hex)                                            │
    ⚠ Mobile sends static string "static_biometric_data_base64_encoded"│
    ⚠ → biometricHash is a constant, contributing zero entropy         │
                                                                       │
Passkey                                                                │
    │  SHA-256("passkey:" + credential)                hash.js:34-37   │
    ▼                                                                  │
passkeyHash (32-byte hex)                                              │
                                                                       │
    poseidonHash([phoneHash, biometricHash?, passkeyHash?])  zk.js:45  │
         │  ⚠ poseidonHash is SHA-256 simulation, not ZK-friendly      │
         ▼                                                             │
    zkCommitment (58-char string)                                      │
         stored in: users.zk_commitment                                │
                    zk_proofs.commitment                               │
                    AuthDatum.phone_hash (on-chain UTXO)  ◀────────────┘
```

### 2.3 Seed phrase encryption (backend)

```
Seed phrase (12 or 24 BIP-39 words)
    │
    ├─ salt = crypto.randomBytes(32)
    │
    ├─ encryptionKey = PBKDF2(userId, salt, 100_000 rounds, 32 bytes, SHA-256)
    │                  seed-phrase-storage.ts:202-209
    │   ⚠ KEY INPUT IS userId — a non-secret VARCHAR stored in DB + JWT tokens
    │   ⚠ Anyone with DB read access can re-derive every key
    │
    └─ AES-256-CBC via crypto.createCipher(key)      seed-phrase-storage.ts:212
         ⚠ createCipher is DEPRECATED — derives IV from key deterministically
         ⚠ Reused IV breaks CBC semantic security
         ▼
    encryptedSeedPhrase (hex) + encryptionSalt (hex)
         │
         ▼
    Stored on Iagon (getSeedPhraseById() is an unimplemented stub → returns null)
```

### 2.4 Backend operational keys

```
SEED_PHRASE (env var)  ──▶  Lucid in-process wallet  ──▶  Signs refund / NOK txs
    ⚠ Hardcoded fallback string in k33p-signup-interactions.ts:25
    ⚠ Same hardcoded fallback in enhanced-k33p-manager-db.ts:27
    ⚠ Any repo clone gives attacker control of the Cardano backend wallet

NOK_ADMIN_SECRET (env var, 32 bytes)  ──▶  joinNok()  ──▶  Midnight contract admin
    ⚠ Preview secret committed in Contract/nok_compact_deployment.md
    ⚠ Explicitly acknowledged as compromised in NOK_INTEGRATION.md:53
NOK_WALLET_SEED (env var)  ──▶  buildWalletAndWaitForFunds()
```

---

## 3. Biometrics → Sub-Key Mapping

### 3.1 Authentication layer stack

```
Layer 0 (always required)  : Phone OTP — Twilio SMS one-time password
Layer 1 (always required)  : PIN  — PBKDF2(PIN, userId, 1k) verified server-side
Layer 2 (≥ 1 required):
  └─ Fingerprint  : expo-local-authentication → boolean result only
  └─ Face Scan    : FaceIO third-party API → token + analysis JSON
  └─ Voice ID     : listed in UI; isAvailable: false
  └─ Iris Scan    : listed in UI; isAvailable: false
```

### 3.2 Per-factor cryptographic contribution

| Auth factor | Client processing | Server hash | Stored at | ZK commitment input | Unlocks |
|---|---|---|---|---|---|
| **Phone** | Plaintext in session (AsyncStorage) → `SHA-256("phone:"+phone)` server-side | `phoneHash` | `users.phone_hash`, `AuthDatum.phone_hash`, UTXO datum | **Yes — mandatory root** | All auth paths |
| **PIN** | `AES-ECB(PBKDF2(PIN+userId, userId, 1k))` → server; `PBKDF2(PIN, userId, 1k, 512-bit)` as `pinHash` | `pinHash` | `users.pin_hash`, `auth_data` | **No** | Secondary login gate |
| **Fingerprint** | `expo-local-authentication` → boolean pass/fail | Not hashed | `auth_data.auth_hash` type=biometric, `biometricSetup` flag | **Nominally yes; actually no** — static string sent to ZK | Local device unlock convenience only |
| **Face** | FaceIO token → `faceData` stored in SecureStore | Not hashed | `useAuthStore.faceData` (SecureStore) | **No** | Local device unlock convenience only |
| **Passkey** | `SHA-256("passkey:"+credential)` | `passkeyHash` | `auth_data.auth_hash` type=passkey | **Yes — optional** | Optional ZK extension |

### 3.3 Commitment composition rule

```
commitment = poseidonHash([phoneHash, biometricHash?, passkeyHash?])
```

- A user enrolled with phone-only produces a **different** commitment than one enrolled with phone+biometric — there is no migration path; changing auth methods invalidates the on-chain commitment.
- Because `biometricHash` is always derived from the same static string, all users who enroll biometrics share the same `biometricHash` value. This offers no differentiation.

---

## 4. Inheritance (NOK) Timer Mechanics

### 4.1 NOK architecture

```
Primary user
    │  POST /api/nok/register  (JWT Bearer required)
    │  body: { nokIdentifier }  e.g. "+15551234567"
    ▼
nok-service.ts:registerNokForUser()
    ownerIdentifierToField(userId)    ← SHA-256 → BLS12-381 field element
    nokHashToField(nokIdentifier)
    registerNok(deployed, ownerField, nokField)
    ▼
Midnight NOK contract  [registered = true]
```

```
NOK person (or attacker)
    │  POST /api/nok/approve-login  (NO AUTHENTICATION — public endpoint)
    │  body: { userId, nokIdentifier }
    ▼
nok-service.ts:approveNokLoginForUser()
    approveNokLogin(deployed, ownerField, nokField)
    ▼
Midnight NOK contract  [approved = true]
```

### 4.2 NOK onboarding flows (mobile)

```
NOK ≥ 18  →  /sign-up-nok/over18
    Steps: phone OTP → email OTP → PIN setup → face capture → secret question
           → Cardano address capture

NOK < 18  →  /sign-up-nok/under18
    Steps: parent/guardian OTP → NOK PIN setup
```

NOK session state is held in **ephemeral, unprotected Zustand memory only**:
- `useNokPhoneStore` — `nokPhoneNumber`, `nokFormattedNumber`
- `useNokEmailStore` — `nokEmail`

Neither store is persisted to disk. NOK registration is not written to the backend DB from any client code path that is currently implemented.

### 4.3 Inheritance timer — designed intent vs. current implementation

> [!WARNING]
> There is **no inactivity timer** in any layer of the current codebase.
> The Midnight NOK contract tracks `registered / approved` state, but neither the
> backend nor the on-chain validator enforces a "N days of inactivity → NOK unlock"
> countdown. The approve-login endpoint is permanently open to unauthenticated calls.

**What timers / expiry mechanisms do exist:**

| Component | Behaviour |
|---|---|
| `auto-refund-monitor.ts` | Polls 2 ADA deposits every 30 s; ignores txs older than 3600 s |
| `combined_validator.ak:max_time_window` | Rejects txs with validity interval > 86 400 slots (1 day) |
| `recovery_requests.expires_at` | Expiry column present; value set by callers |
| `phone_change_requests.expires_at` | Expiry column present; value set by callers |
| Subscription `end_date` | Premium tier expires; renewal checked by cron |
| Subscription UI label | "Inheritance Mode for Next of Kin" shown as premium feature |

**Intended dead-man-switch timeline (not yet implemented):**

```
T = 0        User authenticates (OTP / PIN / biometric login)
             → Backend records last_active_at timestamp   [MISSING: column not in schema]

T + N days   Backend cron detects no login within N days  [MISSING: cron job]
             → Sends URGENT notification: "Confirm you are alive"  [notification infra exists]
             → Starts grace period countdown

T + N + G    User has not responded to liveness prompt
             → Inheritance unlock triggered               [MISSING: trigger logic]
             → NOK receives access credentials via registered email + phone
             → NOK authenticates via /sign-in-nok

NOK accesses vault:
             → Authenticates with their PIN + OTP
             → Server releases encrypted vault fileId reference
             → Client fetches encrypted seed phrase from Iagon
             → Decrypts with...                           [MISSING: NOK sub-key derivation]
```

**Five missing components to make inheritance functional:**

1. `last_active_at` column on `users` table + heartbeat API endpoint.
2. Backend cron that checks `last_active_at < NOW() - INTERVAL 'N days'`.
3. User warning notification flow (N configurable; grace period G defined).
4. NOK sub-key: either Shamir secret share or re-encrypt vault key with NOK's public key derived from their own credentials.
5. Authentication requirement on `POST /api/nok/approve-login`.

---

## 5. Trust Boundaries

| Boundary | What crosses it | What is trusted inside | Key risk |
|---|---|---|---|
| **Device → Backend** | JWT Bearer HTTPS; phone/PIN/biometric plaintext in request body | Backend process + env vars | Plaintext credentials in transit headers/logs |
| **Backend → PostgreSQL** | User records, phone hashes, ZK commitments, pin hashes | DB host + credentials | DB read access decrypts all seed phrases (F-04) |
| **Backend → Iagon** | AES-encrypted seed phrase blobs; user metadata | Iagon API availability | Retrieval path unimplemented; blobs may be stranded |
| **Backend → Cardano L1** | Lucid-signed txs from `SEED_PHRASE` wallet | Blockfrost API; Cardano consensus | Hardcoded seed phrase gives attacker full wallet control |
| **Backend → Midnight** | Admin-signed NOK register/approve calls via `NOK_ADMIN_SECRET` | Midnight ZK proof server | Admin secret committed in repo |
| **Cardano L1 → Validator** | Datum + redeemer + tx context | Aiken validator logic | Signature field in redeemers is ignored (dead code) |
| **Vault service → Client** | fileId + bearer token | Bearer token auth | DELETE path has no auth token in `fullFolderCleanup` |

---

## 6. STRIDE Threat Table

Threats are numbered sequentially. Prefix **B** = backend/on-chain origin; **M** = mobile-app origin.

| # | Component | Threat | STRIDE | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|---|---|
| **B-01** | `k33p-signup-interactions.ts:25` | Hardcoded fallback seed phrase in source → repo clone gives attacker Cardano wallet control | Tampering / Info Disclosure | **High** | **Critical** | **Critical** | None |
| **B-02** | `Contract/nok_compact_deployment.md` | `NOK_ADMIN_SECRET` committed in repo | Info Disclosure | **High** | **Critical** | **Critical** | Documented as compromised; not rotated |
| **B-03** | `POST /api/nok/approve-login` | Unauthenticated — any caller knowing `userId` + `nokIdentifier` approves inheritance | Spoofing / EoP | **High** | **High** | **Critical** | None |
| **B-04** | `zk.js:generateZkProof` | ZK proof is simulated (`isValid: true`); verification checks flag only | Spoofing | **High** | **High** | **High** | Documented; not production-ready |
| **B-05** | `seed-phrase-storage.ts:202` | Seed encryption key = `PBKDF2(userId, salt)` — userId is public | Info Disclosure | **High** | **High** | **High** | None |
| **B-06** | `seed-phrase-storage.ts:212` | `crypto.createCipher` — deprecated, IV reused, CBC semantic security broken | Info Disclosure | **High** | **High** | **High** | None |
| **B-07** | `hash.js:10` | `SHA-256("phone:"+phone)` — no salt; ~10^10 phone space enumerable < 1 hr | Info Disclosure | **High** | **Medium** | **High** | `PHONE_HASH_SALT` exists but unused |
| **B-08** | `combined_validator.ak:201` | Redeemer `signature` field ignored (`_`); dead code misleads auditors | Spoofing | **High** | **High** | **High** | None |
| **B-09** | Inheritance system | No inactivity timer; `approve-login` permanently open | EoP | **High** | **High** | **High** | None |
| **B-10** | `SEED_PHRASE` env var | Leaked via Render dashboard, crash dump, or log line → full wallet takeover | Info Disclosure | Medium | **Critical** | **High** | Standard env practice; no HSM |
| **B-11** | Iagon + `getSeedPhraseById` | Retrieval is unimplemented stub (`return null`); seed blobs stored but never retrievable | Denial of Service | Medium | **High** | **High** | None |
| **B-12** | `JWT_SECRET` env var | No key rotation, no `kid` header; long-lived tokens with no revocation | Tampering / Spoofing | Medium | High | **High** | None |
| **B-13** | Twilio OTP | SMS OTP susceptible to SIM-swap; no secondary factor after phone change | Spoofing | Medium | High | **High** | None |
| **B-14** | `UpdateAuthData` redeemer | Replay: only checks `created_at >= datum.created_at`; nonce field exists but unchecked | Repudiation | Low | Medium | Medium | Nonce field present, unused |
| **B-15** | `auto-refund-monitor` | Blockfrost API key leaked in error-page logs | Info Disclosure | Medium | Medium | Medium | Partial log truncation |
| **B-16** | Redis rate limiter | `clear-rate-limiter.js` admin script can disable all rate limiting | DoS avoidance | Low | Medium | Medium | Admin key required |
| **B-17** | Iagon availability | No seed-phrase retrieval fallback; blobs may become permanently inaccessible | Denial of Service | Low | High | Medium | Partial (user-data fallback only) |
| **M-01** | `did-creation/index.tsx:276` | Static string `"static_biometric_data_base64_encoded"` sent as biometric to ZK service | Spoofing | **High** | **Critical** | **Critical** | None |
| **M-02** | `useAuthMethod.ts` | JWT (`token`) stored in unencrypted AsyncStorage | Info Disclosure | **High** | **High** | **High** | None |
| **M-03** | `pinEncryption.ts` | AES-ECB mode; PIN self-encrypts; 1 000 PBKDF2 iterations | Tampering / EoP | **High** | **High** | **High** | None |
| **M-04** | `phoneEncryption.ts` | AES-ECB mode; 1 000 PBKDF2 iterations | Tampering / EoP | **High** | **High** | **High** | None |
| **M-05** | `useAuthMethod.ts` | `phoneNumber` and `pin` persisted to AsyncStorage in plaintext | Info Disclosure | **High** | **High** | **High** | None |
| **M-06** | Both Zustand auth stores | Both use `'auth-storage'` persist key — silent state collision on hydration | Tampering | **High** | High | **High** | None |
| **M-07** | NOK decryption | No NOK sub-key derivation exists; NOK cannot decrypt vault contents | Denial of Service | **High** | **High** | **High** | None (by design gap) |
| **M-08** | `wallet-api.ts:fullFolderCleanup` | Vault DELETE call sends no auth token | Spoofing / Tampering | Medium | High | **High** | None |
| **M-09** | `storage.ts` | Wallet cache keyed by `phoneNumber_pin` in plaintext AsyncStorage | Info Disclosure | Medium | Medium | Medium | None |
| **M-10** | `useNokEmailStore` / `useNokPhoneScreen` | NOK identifiers held only in unprotected Zustand memory; lost on app kill | Repudiation | Medium | Medium | Medium | None |
| **M-11** | `console.log` throughout app | Secrets (face tokens, phone, auth state) logged to console | Info Disclosure | Medium | Medium | Medium | None |
| **M-12** | `did-creation/index.tsx:70` | `walletAddress` is a hardcoded testnet address | Spoofing | Low | Low | Low (testnet) | Testnet only |
| **M-13** | Inheritance timer | Timer threshold N and grace period G undefined in client | Denial of Service | High | High | **High** | None |
| **M-14** | `phraseKey` derivation | `SHA256(phoneNumber)` as AES key — ~34 bits of entropy | Info Disclosure | Medium | High | High | Random IV present |
| **M-15** | `pinKey` salt | Salt = `userId` (non-secret); PBKDF2 easily reversed given DB access | EoP | High | High | **High** | None |
| **M-16** | Face scan via FaceIO | Third-party service receives biometric data; no data processing agreement visible | Info Disclosure | Medium | High | High | Vendor dependency |

---

## 7. Detailed Findings

### F-01 — Hardcoded backend seed phrase `[B-01]`

**Files:** [`k33p-signup-interactions.ts:25`](file:///home/dee/K33P_Smart_Contract/backend/src/k33p-signup-interactions.ts#L25),
[`enhanced-k33p-manager-db.ts:27`](file:///home/dee/K33P_Smart_Contract/backend/src/enhanced-k33p-manager-db.ts#L27)

```ts
seedPhrase: process.env.SEED_PHRASE || "blame purpose battle mistake match cousin degree route bag return clump key ...",
```

Any developer who clones the repository controls the backend Cardano wallet. All
refund transactions and NOK funding transactions originate from this wallet. The
wallet address derived from this seed is the `depositAddress` — the target of
every 2 ADA user collateral payment.

**Fix:** Remove the fallback string entirely. Throw at startup if `SEED_PHRASE` is
absent. Load from a secrets manager (AWS Secrets Manager, HashiCorp Vault) in
production.

---

### F-02 — NOK admin secret committed to repository `[B-02]`

**File:** `Contract/nok_compact_deployment.md` (acknowledged in
[`NOK_INTEGRATION.md:53`](file:///home/dee/K33P_Smart_Contract/backend/NOK_INTEGRATION.md#L53))

The 32-byte `NOK_ADMIN_SECRET` that controls the Midnight NOK contract is in
version control. Any party with repo read access can approve NOK logins for any
user on the preview network.

**Fix:** Rotate the admin secret (redeploy the Midnight contract with a fresh
secret). Remove all secret material from the repo. Load from vault only.

---

### F-03 — NOK approve-login endpoint is unauthenticated `[B-03]`

**File:** [`nok-service.ts:107`](file:///home/dee/K33P_Smart_Contract/backend/src/services/nok-service.ts#L107)

```
POST /api/nok/approve-login   — public, no auth
body: { userId, nokIdentifier }
```

Any caller who knows (or guesses) a `userId` and the registered `nokIdentifier`
can immediately unlock inheritance access. When combined with the absent timer
(F-09) this is a complete, unauthenticated account takeover vector.

**Fix:** Require either: (a) an internal-only call originating from the inactivity
cron job, or (b) a NOK-authenticated request using the NOK's own JWT issued after
their own OTP flow.

---

### F-04 — ZK proof is simulated, not cryptographic `[B-04]`

**File:** [`zk.js:93-130`](file:///home/dee/K33P_Smart_Contract/backend/src/utils/zk.js#L93)

```js
return {
  proof: `zk-proof-${proofId}-${commitment.substring(0, 10)}`,
  publicInputs: { commitment },
  isValid: true
};
```

Verification checks `proof.isValid === true && commitment matches`. Any attacker who
reads another user's `zkCommitment` from the DB can forge a proof that passes.
The on-chain `zk_proof` ByteArray is length-checked (64 bytes) but never
cryptographically verified.

**Fix:** Replace with a real ZK proof system (Noir, RISC Zero, or Aleo) before
handling real funds. The on-chain validator must verify the proof, not just its
length.

---

### F-05 — Seed phrase encryption key derived from non-secret userId `[B-05]`

**File:** [`seed-phrase-storage.ts:202-209`](file:///home/dee/K33P_Smart_Contract/backend/src/services/seed-phrase-storage.ts#L202)

```ts
return crypto.pbkdf2Sync(userId, salt, 100_000, 32, 'sha256');
```

`userId` is a `VARCHAR(50)` (e.g., `k33p-user-abc123`) stored in PostgreSQL,
embedded in every JWT, and logged. An attacker with DB read access can read
`userId + encryptionSalt` from Iagon and re-derive the AES key to decrypt any
seed phrase. The 100 000 PBKDF2 iterations offer no protection when the "password"
is public.

**Fix:** Derive from a user-supplied passphrase that is never stored (best), or
from a server-side master secret wrapped in an HSM that is never accessible
alongside the ciphertext.

---

### F-06 — Deprecated `createCipher` — deterministic IV `[B-06]`

**File:** [`seed-phrase-storage.ts:212`](file:///home/dee/K33P_Smart_Contract/backend/src/services/seed-phrase-storage.ts#L212)

```ts
const cipher = crypto.createCipher('aes-256-cbc', key);  // DEPRECATED
```

`createCipher` uses OpenSSL's `EVP_BytesToKey` to derive an IV from the key
deterministically. Two encryptions with the same key produce the same IV — breaking
CBC's semantic security. Node.js has deprecated this API since v10.

**Fix:**
```ts
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
// prepend iv to ciphertext for storage
```

---

### F-07 — Phone hash dictionary-attackable `[B-07]`

**File:** [`hash.js:10-13`](file:///home/dee/K33P_Smart_Contract/backend/src/utils/hash.js#L10)

```js
const hashPhone = (phone) => crypto.createHash('sha256').update(`phone:${phone}`).digest('hex');
```

The prefix `"phone:"` is a published constant. Phone number space is ~10^10
(10-digit numbers). GPU enumeration yields all hashes in minutes. The env var
`PHONE_HASH_SALT` exists (`.env.example:60`) but is never passed to this function.

**Fix:** `HMAC-SHA-256(key=PHONE_HASH_SALT, message=phone)`. The salt must be a
long random secret loaded from the environment, not a static prefix.

---

### F-08 — On-chain signature field is dead code `[B-08]`

**File:** [`combined_validator.ak:201,204,207`](file:///home/dee/K33P_Smart_Contract/smart_contract_validator/validators/combined_validator.ak#L201)

```aiken
StoreAuthData { auth_data, signature: _ } ->   // signature ignored
UpdateAuthData { auth_data, signature: _ } ->   // signature ignored
DeactivateAuthData { signature: _ } ->          // signature ignored
```

All redeemer variants accept a `signature` field that is immediately discarded.
On-chain authorisation is achieved via `validate_wallet_authorization` checking
`tx.extra_signatories`, which is correct — but the dead `signature` field adds
byte overhead and misleads auditors into thinking a separate signature verification
exists.

**Fix:** Remove the `signature` field from all redeemer types, or implement
actual ED25519 signature verification against the stored wallet credential.

---

### F-09 — No inheritance inactivity timer `[B-09, M-13]`

Neither the backend, the mobile app, nor the on-chain validator implements a
dead-man-switch. The Midnight NOK contract stores `registered / approved` state
but has no time concept. Required implementation:

1. `ALTER TABLE users ADD COLUMN last_active_at TIMESTAMPTZ;`
2. Heartbeat endpoint `POST /api/user/heartbeat` (authenticated).
3. Cron: `SELECT * FROM users WHERE last_active_at < NOW() - INTERVAL '$N days'`.
4. Notification pipeline: URGENT alert → grace period G.
5. NOK sub-key: Shamir share of vault key (2-of-2 with primary) or re-encrypt
   vault key under NOK's public key (derived from NOK's PIN + OTP at registration).
6. Authenticated `approve-login` — only callable by the cron or a verified NOK session.

---

### F-10 — Static biometric string sent to ZK service `[M-01]`

**Files:** `did-creation/index.tsx:276`, `utils/api.ts`

```ts
const biometricData = "static_biometric_data_base64_encoded";
// ...
generateZKCommitment(phone, biometricData, passkey);
```

Every user's ZK commitment uses the identical biometric component regardless of
which biometric they enrolled. The biometric authentication layer provides only a
local device gate (boolean result from `expo-local-authentication`) with no
cryptographic binding to the key vault.

**Fix:** After a successful biometric match, derive a device-bound key from the
secure enclave (e.g., `expo-crypto` or a native module generating a key pair tied
to biometric presence) and use its public key hash as the `biometric` parameter.

---

### F-11 — JWT stored in unencrypted AsyncStorage `[M-02]`

**File:** `store/useAuthMethod.ts`

```ts
// Zustand persist config
storage: createJSONStorage(() => AsyncStorage)   // not SecureStore
// persists: token, userId, walletAddress, phoneNumber, pin
```

On Android < 6.0 (and on rooted devices) AsyncStorage is readable by any
application with storage permissions. On iOS, AsyncStorage is backed by an
unencrypted SQLite file outside the Keychain.

**Fix:** Replace the AsyncStorage adapter with SecureStore for `token`,
`phoneNumber`, and `pin`. Items that must survive app kill can use
`SecureStore.setItemAsync` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.

---

### F-12 — AES-ECB and insufficient PBKDF2 iterations `[M-03, M-04]`

**Files:** `utils/pinEncryption.ts`, `utils/phoneEncryption.ts`

```ts
// pinEncryption.ts — representative snippet
const key = await PBKDF2(PIN + userId, userId, { iterations: 1000, ... });
const encrypted = AES.encrypt(PIN, key, { mode: CryptoJS.mode.ECB });
```

- **ECB mode**: identical 16-byte blocks produce identical ciphertext. For a 4-digit
  PIN this is catastrophic — there are only 10 000 possible values and ECB reveals
  block-level patterns.
- **1 000 iterations**: OWASP 2023 recommends ≥ 310 000 for PBKDF2-SHA1 (or 210 000
  for PBKDF2-SHA256).

**Fix:** Switch to `AES-GCM` with `crypto.randomBytes(12)` as nonce. Raise
iterations to ≥ 310 000.

---

### F-13 — Zustand persist key collision `[M-06]`

Both `useAuthMethod.ts` and `useAuthStore.ts` use `name: 'auth-storage'` in their
Zustand persist config. The second store to hydrate on app launch will silently
overwrite the other's AsyncStorage entry. This leads to unpredictable state loss.

**Fix:** Rename one store key to `'auth-method-storage'` and the other to
`'auth-secure-storage'`.

---

### F-14 — NOK vault decryption key undefined `[M-07]`

There is no code in the client or the backend that defines how a NOK would decrypt
vault contents. The primary user's vault is encrypted under a key derived from
their own phone number (`phraseKey = AES-CBC(SHA256(phone), randomIV)`). The NOK
has a different phone number — they cannot derive the same key.

**Fix (Shamir approach):**
1. At primary-user registration, generate vault key `K`.
2. Split `K` into two Shamir shares: `S_user`, `S_nok`.
3. Encrypt `S_user` under primary user's PIN-derived key; store in Iagon.
4. Encrypt `S_nok` under NOK's PIN-derived key (collected at NOK onboarding); store separately in Iagon.
5. To decrypt: primary user reconstructs `K` from their own share (standard path). NOK reconstructs `K` from their share only after inheritance is approved.

---

## 8. Cryptographic Primitives Summary

### Client-side (mobile)

| Operation | Algorithm | Mode | Key source | Key size | Iterations | Verdict |
|---|---|---|---|---|---|---|
| Phone credential encryption | AES | **ECB** | PBKDF2(phone, sha512(salt+phone)) | 256-bit | **1 000** | **Weak** |
| PIN credential encryption | AES | **ECB** | PBKDF2(PIN+userId, userId) | 256-bit | **1 000** | **Weak** |
| Seed phrase fragment encryption | AES | CBC + random IV | SHA256(phoneNumber) | 128-bit | — | Marginal (low-entropy key) |
| Per-purpose user key | PBKDF2 | — | userPassword | 256-bit | **100 000** | Acceptable |
| PIN hash sent to server | PBKDF2-SHA1 | — | userId as salt | 512-bit | **1 000** | **Weak** |

### Server-side (backend)

| Operation | Algorithm | Mode | Key source | Key size | Iterations | Verdict |
|---|---|---|---|---|---|---|
| Phone hash | SHA-256 | — | None (constant prefix) | — | — | **Weak** (no HMAC, no salt) |
| Biometric hash | SHA-256 | — | None | — | — | **Irrelevant** (static input) |
| ZK commitment | SHA-256 (simulated poseidon) | — | — | — | — | **Not ZK** |
| Seed phrase encryption | AES-256 | **CBC / createCipher** | PBKDF2(userId, salt, 100k) | 256-bit | 100 000 | **Weak** (non-secret key, deprecated IV) |
| Seed phrase key derivation | PBKDF2-SHA256 | — | userId (non-secret) | 256-bit | 100 000 | **Weak** (wrong password) |

---

## 9. Consolidated Remediation Plan

### P0 — Fix before handling any real user funds

| ID | Finding | Required action |
|---|---|---|
| B-01 | Hardcoded backend seed phrase | Remove fallback string; throw at startup if env absent |
| B-02 | NOK admin secret in repo | Rotate secret; remove from version control; load from vault |
| B-03 | Unauthenticated approve-login | Require NOK-authenticated JWT or internal-only cron caller |
| B-04 | Simulated ZK proof | Replace with Noir / RISC Zero / Aleo real proof before mainnet |
| M-01 | Static biometric in ZK | Capture real biometric-bound key; hash as ZK input |
| M-07 | No NOK decryption key | Implement Shamir secret sharing or NOK re-encryption at registration |

### P1 — Fix before any external security review

| ID | Finding | Required action |
|---|---|---|
| B-05 | PBKDF2 keyed on userId | Re-key from user passphrase or HSM-backed server secret |
| B-06 | `createCipher` deprecated | Replace with `createCipheriv` + AES-256-GCM + random IV |
| B-07 | Phone hash no salt | Apply `HMAC-SHA-256(PHONE_HASH_SALT, phone)` |
| B-09 | No inheritance timer | Add `last_active_at`, heartbeat endpoint, cron, notification flow |
| M-02 | JWT in AsyncStorage | Migrate `token` to SecureStore |
| M-03/04 | AES-ECB + 1k PBKDF2 | Switch to AES-GCM; raise iterations to ≥ 310 000 |
| M-05 | PIN/phone in AsyncStorage | Never persist raw PIN; clear phone on app background |
| M-06 | Zustand key collision | Rename one `'auth-storage'` persist key |
| M-15 | pinKey salt = userId | Use random per-user salt stored separately; raise iterations |

### P2 — Fix before general availability

| ID | Finding | Required action |
|---|---|---|
| B-08 | Dead signature field on-chain | Remove field or implement real ED25519 verification |
| B-12 | No JWT rotation | Add `kid`, short expiry, revocation list |
| B-13 | SIM-swap OTP | Require second factor after phone change |
| B-14 | Nonce unused in AuthDatum | Enforce nonce monotonicity in validator |
| M-08 | Vault DELETE unauthenticated | Pass auth token in `fullFolderCleanup` fetch |
| M-09 | Wallet cache key = phone+pin | Key by opaque userId only; store in SecureStore |
| M-10 | NOK state lost on app kill | Persist NOK registration server-side at time of enrollment |
| M-11 | console.log secrets | Audit and strip all secret-logging before production build |
| M-16 | FaceIO third-party biometric | Review DPA; consider on-device-only alternative |
