# NOK Security — App Update (Midnight Deployment Auth)

**Status:** Blocked for deployment (1 fixable issue). Read before continuing.
**Scope:** The Midnight **NOK (Next-Of-Kin)** contract only.
**Why this exists:** Midnight is opening smart-contract deployment via a
self-assessed risk rubric ([how-to-apply-for-deployment-auth](https://docs.midnight.network/blog/how-to-apply-for-deployment-auth),
[contract-deployment-rubric](https://github.com/midnightntwrk/midnight-improvement-proposals/blob/main/deployments/contract-deployment-rubric.md)).
A score of **3 in any category blocks deployment** until fixed. We currently
score a 3 in one category — for an **app-side** reason that is quick to fix.

---

## TL;DR

- The blocker is an **app (off-chain) issue**, not contract logic.
- On-chain we permanently store **unsalted SHA-256** of phone numbers / emails /
  user ids. Phone numbers (~33 bits) and emails are trivially brute-forceable,
  so those "hashes" are effectively **plaintext PII on-chain forever**.
- Fix lives in one file: `Contract/cli/src/hash.ts` → switch to a **keyed
  commitment** (HMAC / secret salt held by the backend). `nok.compact` does
  **not** need to change for this.
- After the fix, all three rubric categories are ≤ 2 → ready to apply.

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
  `Contract/cli/src/hash.ts` as unsalted domain-separated SHA-256, reduced into
  the BLS field.

---

## Rubric self-assessment

| Category | Score | Rationale | Fix |
|---|---|---|---|
| **Privacy-at-risk** | **3 (BLOCKER)** | `noks` permanently stores unsalted SHA-256 of phone/email/user-id. Phone numbers and emails are low-entropy and brute-forceable, so the on-chain Fields are effectively recoverable PII. This reveals a person is a K33P user, their next-of-kin's phone/email, and the owner↔NOK relationship — Tier 3 ("email addresses" / real-world identity linkage). | **App fix:** use a keyed commitment (HMAC-SHA256 under a backend secret, or Pedersen commitment with random blinding) in `hash.ts`. Drops to **Tier 1**. |
| **Value-at-risk** | **1** | Contract holds no funds; an exploit can't drain principal. (A compromised admin secret could approve fraudulent NOK logins — an access-control risk in the wider K33P flow — but no value is locked in the contract.) | Rotate the admin secret committed to `Contract/nok_compact_deployment.md` (treat as compromised) and load it only from a vault. `admin` is already `sealed`. |
| **State-space-at-risk** | **2** | Grows linearly with users but **bounded per user** (map keyed by `ownerIdentifier`, `insert` overwrites) and **admin-only** writes (no cheap permissionless spam). Weakness: **no delete/expiry** circuit, so records are never pruned. | **Contract fix (non-blocking):** add a permissioned `delete_nok` / expiry circuit (also supports GDPR-style erasure of the PII above). |

**Verdict:** Not deployable as-is due to Privacy = 3. This is a small, scoped
fix, not an architecture rewrite.

---

## Contract issue vs. app issue

- **Privacy (the blocker) = APP issue.** The contract stores two opaque `Field`
  values and doesn't care how they were derived. The weak derivation is entirely
  in `hash.ts`. Fixing it needs **no Compact change** — `register` and `approve`
  both call the same helper, so a keyed derivation stays consistent for free.
- **State-space = CONTRACT issue.** Adding a `delete_nok`/expiry circuit is the
  only genuine `nok.compact` change, and it's the non-blocking Score-2 item.
- **Committed admin secret = OPS/config issue.** Rotate + vault; not code logic.

---

## Proposed fix (privacy blocker)

Replace unsalted `SHA-256(domain + identifier)` in
`Contract/cli/src/hash.ts` with a **keyed commitment**:

- HMAC-SHA256 with a secret key held only by the backend admin (env/vault), or
- a Pedersen/persistentHash commitment with a random blinding factor.

Because the backend is the sole admin (it performs every `register` and
`approve`), it can safely hold the secret. On-chain Fields then reveal nothing
about the underlying phone/email → Privacy-at-risk becomes **1**.

> Caveat: this changes the derivation, so **existing on-chain records become
> unmatchable**. Fine for the current preview deployment (re-register), but plan
> a migration if any records must be preserved.

---

## Next steps

1. [ ] App fix: keyed commitment in `hash.ts` (clears the Score-3 blocker).
2. [ ] Ops: rotate the admin secret + move to a vault; scrub it from
       `Contract/nok_compact_deployment.md` history.
3. [ ] (Optional, non-blocking) Contract: add `delete_nok`/expiry circuit.
4. [ ] Apply: fork `midnight-improvement-proposals`, add
       `deployments/k33p-nok.md`, open PR `[Deployment Request] K33P NOK`.
