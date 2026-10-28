# NOK Security — App Update (Midnight Deployment Auth)

**Status:** ✅ Blocker resolved. Privacy fix implemented in `c999e824`
(`fix(nok): switch to keyed commitment HMAC-SHA256 for Midnight deployment rubric`).
All three rubric categories are now ≤ 2 → clear to apply for deployment auth
once the operational items below are in place.
**Scope:** The Midnight **NOK (Next-Of-Kin)** contract only.
**Why this exists:** Midnight is opening smart-contract deployment via a
self-assessed risk rubric ([how-to-apply-for-deployment-auth](https://docs.midnight.network/blog/how-to-apply-for-deployment-auth),
[contract-deployment-rubric](https://github.com/midnightntwrk/midnight-improvement-proposals/blob/main/deployments/contract-deployment-rubric.md)).
A score of **3 in any category blocks deployment** until fixed.

---

## TL;DR

- The former blocker was an **app (off-chain) issue**, not contract logic.
- Previously we stored **unsalted SHA-256** of phone numbers / emails / user ids
  on-chain. Those are low-entropy and brute-forceable, so the "hashes" were
  effectively **plaintext PII on-chain forever** → Privacy-at-risk **3**.
- **Fixed:** `Contract/cli/src/hash.ts` now derives the on-chain `Field`s with a
  **keyed commitment (HMAC-SHA256)** under a server-held secret. Without that
  secret the commitments are not brute-forceable → Privacy-at-risk drops to **1**.
- `nok.compact` did **not** change — the fix is entirely off-chain, as predicted.
- **Action required before deploy:** set a dedicated, backed-up `NOK_HASH_SALT`
  and re-register existing records (derivation changed — see caveats).

---

## What the NOK contract does

`Contract/contract/src/nok.compact` — an admin-run access registry:

- Ledger state:
  - `noks: Map<Field, RegisteredNOK>` — one record per owner
    (`{ nokHash, ownerIdentifier, registeredAt }`)
  - `admin: Bytes<32>` — sealed admin **public** key (set once in constructor)
  - `round: Counter` — monotonic stamp
- Writes (`register_nok`, `approve_nok_login`) are **admin-only** (caller must
  prove they hold the admin secret via `assertAdmin()`).
- `check_nok_registered` is a permissionless read.
- **No funds / tokens are ever held.**
- The only private (witness) value is the admin secret key.
- `ownerIdentifier` and `nokHash` are computed **off-chain** in
  `Contract/cli/src/hash.ts` — now as an **HMAC-SHA256 keyed commitment**,
  reduced into the BLS field.

---

## Rubric self-assessment (updated)

| Category | Score | Rationale | Status |
|---|---|---|---|
| **Privacy-at-risk** | **1** ✅ (was 3) | On-chain `ownerIdentifier` / `nokHash` are now **HMAC-SHA256** keyed by a server-held secret (`hmacSha256ToField`), not plain SHA-256. Without the secret the commitments cannot be brute-forced back to a phone/email, so the ledger no longer exposes recoverable PII. | **Resolved** in `c999e824`. Verify `NOK_HASH_SALT` is set in every environment (see below). |
| **Value-at-risk** | **1** | Contract holds no funds; an exploit can't drain principal. (A compromised admin secret could approve fraudulent NOK logins — an access-control risk in the wider K33P flow — but no value is locked in the contract.) | Rotate the admin secret committed to `Contract/nok_compact_deployment.md` (treat as compromised) and load it only from a vault. `admin` is already `sealed`. |
| **State-space-at-risk** | **2** | Grows linearly with users but **bounded per user** (map keyed by `ownerIdentifier`, `insert` overwrites) and **admin-only** writes (no cheap permissionless spam). Weakness: **no delete/expiry** circuit, so records are never pruned. | Non-blocking. Optionally add a permissioned `delete_nok` / expiry circuit (also supports GDPR-style erasure). |

**Verdict:** No category scores 3 → **no deployment override block**. Proceed to
apply once the operational items below are confirmed.

---

## What changed in the fix (`c999e824`)

`Contract/cli/src/hash.ts`:

- Added `hmacSha256` / `hmacSha256ToField` (HMAC-SHA256, reduced mod the
  BLS12-381 scalar field).
- `ownerIdentifierToField` and `nokHashToField` now call `hmacSha256ToField`
  instead of the old unsalted `sha256ToField`.
- Secret resolution order (`resolveCommitmentSecret`):
  1. `NOK_HASH_SALT` env var, else
  2. an explicit `secret` argument, else
  3. `NOK_ADMIN_SECRET` env var, else
  4. throws (fails closed — no accidental unsalted fallback).

`register` and `approve` both go through the same helpers, so the keyed
derivation stays consistent across register-time and approve-time.

---

## Operational requirements before deployment

1. **Set a dedicated `NOK_HASH_SALT`** (do not rely on the `NOK_ADMIN_SECRET`
   fallback). Keeping the commitment key separate from the write-authorization
   key means rotating one does not invalidate the other, and the key that
   protects PII is not the same material that authorizes admin writes.
2. **Treat `NOK_HASH_SALT` as a permanent, backed-up secret in a vault.** It is
   required to recompute commitments at approve-time. If it is lost or changed,
   **every existing record becomes unmatchable** (see caveat).
3. **Do not commit the salt** to the repo; load it from the vault/env only.
4. **Rotate the admin secret** that was committed to
   `Contract/nok_compact_deployment.md` and scrub it from history.

> ⚠️ **Migration caveat:** the derivation changed from unsalted SHA-256 to keyed
> HMAC, so any records registered under the old scheme are **no longer
> matchable**. For the current preview deployment, **re-register** after setting
> `NOK_HASH_SALT`. If any records must be preserved, plan a re-registration
> migration keyed by the new salt.

---

## Next steps

1. [x] App fix: keyed commitment in `hash.ts` (`c999e824`) — clears the Score-3
       blocker.
2. [ ] Set a dedicated `NOK_HASH_SALT` (vault-managed) in all environments;
       stop relying on the `NOK_ADMIN_SECRET` fallback.
3. [ ] Re-register existing preview records under the new salt.
4. [ ] Ops: rotate the admin secret + move to a vault; scrub it from
       `Contract/nok_compact_deployment.md` history.
5. [ ] (Optional, non-blocking) Contract: add `delete_nok`/expiry circuit.
6. [ ] Apply: fork `midnight-improvement-proposals`, add
       `deployments/k33p-nok.md`, open PR `[Deployment Request] K33P NOK`.
