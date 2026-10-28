# Integrating the mainnet NOK contract with the K33P application

How to point the K33P backend (and, through it, the mobile app) at the NOK +
Identity Compact contract that is **deployed on Midnight Mainnet**, and what
changes operationally once real funds and a real chain are involved.

Companion docs:

| Doc | What it covers |
|---|---|
| `deploymain.md` | How the contract got onto mainnet (Blockfrost, DUST, batched deploy) |
| `NOK-DEPLOYMENT.md` | ABI, circuits, keys, hashing, user → `owner_identifier` mapping |
| `../backend/NOK_INTEGRATION.md` | The backend wiring (routes, service, build steps) — written for **preview** |

This document is the mainnet delta on top of those.

---

## 0. TL;DR

```bash
# backend/.env  (production: a secret manager, never a file in git)
MIDNIGHT_NETWORK=mainnet
MIDNIGHT_BLOCKFROST_PROJECT_ID=<Blockfrost *Midnight Mainnet* project token>
NOK_CONTRACT_ADDRESS=<contractAddress from Contract/cli/nok-deployment.mainnet.json>
NOK_ADMIN_SECRET=<adminSecret from the same file>            # 64 hex
NOK_WALLET_SEED=<the WALLET_SEED the contract was deployed from>  # holds the DUST
NOK_HASH_SALT=<a fixed random string; see §3.3>
MIDNIGHT_PROOF_SERVER_URL=http://<proof-server-host>:6300
```

Then: build the Contract workspace with the **exact ZK assets used for the
mainnet deploy** (§4), start a proof server reachable from the backend (§5),
restart the backend, and run the smoke test in §7.

---

## 1. What is already there

The integration code exists and is network-agnostic. Nothing in the contract
repo needs to change to target mainnet; the backend selects the network purely
from the environment.

```
keepmobile  ──HTTP──▶  backend/src/routes/nok-routes.ts        /api/nok/*
                       backend/src/routes/auth.js               /api/auth/signup, /api/auth/login
                                │
                                ▼
                       backend/src/services/nok-service.ts      (admin of the contract)
                                │  imports compiled dist/ of
                                ▼
                       @k33p/nok-cli  (Contract/cli)            config.ts · wallet.ts · nok-api.ts · hash.ts
                                │
                                ▼  Blockfrost indexer + RPC, local proof server
                       NOK contract on Midnight Mainnet
```

| Piece | File | Mainnet-relevant behaviour |
|---|---|---|
| Network selection | `cli/src/config.ts` → `loadConfig()` | `MIDNIGHT_NETWORK=mainnet` (or legacy `NOK_NETWORK`) returns `MainnetConfig`, which routes indexer/WS/RPC through Blockfrost and **throws** if `MIDNIGHT_BLOCKFROST_PROJECT_ID` is missing. |
| Wallet bootstrap | `cli/src/wallet.ts` → `buildWalletAndWaitForFunds()` | On mainnet it does *not* wait for NIGHT (DUST may come from cNIGHT), persists sync snapshots to `Contract/cli/.wallet-state/`, and **throws if spendable DUST is 0**. |
| Contract API | `cli/src/nok-api.ts` | `joinNok()` + `register_nok` / `approve_nok_login` / `register_identity` / `verify_login` + read helpers. Reads use only the indexer. |
| Hashing | `cli/src/hash.ts` | HMAC-SHA256 → BLS12-381 Field. Salt = `NOK_HASH_SALT`, else `NOK_ADMIN_SECRET`. |
| Backend service | `backend/src/services/nok-service.ts` | Lazy singleton: first call syncs the wallet + joins the contract, then caches for the process lifetime. |
| Routes | `backend/src/routes/nok-routes.ts` (`/api/nok/*`), `backend/src/routes/auth.js` | Signup calls `registerIdentityForUser`; login calls `verifyLoginForUser`. |

> The mobile app (`keepmobile/K33P-mobile/app/profile/nok-setup/*`) currently
> has the NOK screens but does **not** call `/api/nok/*` yet. The mobile → backend
> contract is unchanged by mainnet; see §8 for what it should call.

---

## 2. Env var naming — read this before anything else

Two naming schemes meet here, and they are **not** the same variable:

| Who | Contract address var | Where it comes from |
|---|---|---|
| Deploy / admin CLI (`cli/src/deploy.ts`, `admin.ts`) | `MIDNIGHT_MAIN_NOK_ADDRESS` (mainnet) / `MIDNIGHT_NOK_ADDRESS` (others) | `contractAddressEnvName('NOK')` in `config.ts`; this is the "App env:" line `deploy.ts` prints |
| **Backend** (`nok-service.ts`) | **`NOK_CONTRACT_ADDRESS`** | `requireEnv('NOK_CONTRACT_ADDRESS')` |

So when `deploy.ts` tells you to add `MIDNIGHT_MAIN_NOK_ADDRESS=…`, the backend
needs the same value under `NOK_CONTRACT_ADDRESS`. Setting only the
`MIDNIGHT_MAIN_*` form makes the backend fail with
`NOK: missing required env var NOK_CONTRACT_ADDRESS`.

Likewise the seed: the CLI reads `WALLET_SEED`, the backend reads
`NOK_WALLET_SEED`. They must hold the **same** seed on mainnet (§3.2).

Proof server URL: `MainnetConfig` reads `MIDNIGHT_PROOF_SERVER_URL` first, then
`PROOF_SERVER_URL`, then defaults to `http://127.0.0.1:6300`. Either name works;
`backend/.env.example` uses `PROOF_SERVER_URL`.

---

## 3. Backend configuration for mainnet

### 3.1 Full variable set

```bash
# ── Network ──────────────────────────────────────────────────────────────────
MIDNIGHT_NETWORK=mainnet
# Per-network Blockfrost token. A preprod/preview token 403s on mainnet.
MIDNIGHT_BLOCKFROST_PROJECT_ID=

# ── Contract ─────────────────────────────────────────────────────────────────
# From Contract/cli/nok-deployment.mainnet.json (gitignored) — "contractAddress".
NOK_CONTRACT_ADDRESS=
# Same file — "adminSecret". 32 bytes hex. Controls BOTH registries.
NOK_ADMIN_SECRET=

# ── Fee wallet ───────────────────────────────────────────────────────────────
# The WALLET_SEED used for the mainnet deploy — it is the wallet with the DUST.
NOK_WALLET_SEED=

# ── Hashing ──────────────────────────────────────────────────────────────────
# Fixed HMAC salt for owner/nok/user/commitment Fields. Set ONCE, never rotate
# (rotating orphans every record on-chain). See §3.3.
NOK_HASH_SALT=

# ── Proof server ─────────────────────────────────────────────────────────────
MIDNIGHT_PROOF_SERVER_URL=http://127.0.0.1:6300

# ── Optional tuning (read by cli/src/wallet.ts) ──────────────────────────────
# SYNC_BATCH_SIZE=1000        # default 1000; genesis sync batch size
# WALLET_STATE_RESET=1        # one-off: discard the saved sync snapshot
# INTENT_TTL_MINUTES=30       # tx TTL cap; keep < 60
# SUBMIT_VIA_WS=1             # use the SDK WS submit instead of HTTP RPC
```

`backend/.env.example` already carries a mainnet section — keep it in sync with
the above.

### 3.2 Why the backend must use the deploy wallet's seed

Mainnet has no faucet. DUST is generated by registered NIGHT / cNIGHT mapped to
a specific **dust address**, and that mapping was done for the wallet the
contract was deployed from. A different seed will sync fine and then throw
`No spendable DUST in this wallet…` on the first write, which surfaces to users
as failed signups and logins.

Consequences:

- The backend and the deploy/admin CLI share one wallet ⇒ **do not run the CLI
  (`npm run admin`) against mainnet while the backend is live**. A wallet with a
  single DUST coin can have only one in-flight tx; the second party sees the
  coin as `pending` and fails to balance.
- Both processes write sync snapshots to the same path
  (`Contract/cli/.wallet-state/mainnet-<seed-fingerprint>.json`) — another
  reason not to run them concurrently.

### 3.3 Hash salt (`NOK_HASH_SALT`)

`hash.ts` → `resolveCommitmentSecret()` uses `NOK_HASH_SALT` if set, otherwise
the **UTF-8 bytes of `NOK_ADMIN_SECRET`**. Every on-chain key
(`owner_identifier`, `nok_hash`, `user_id`, `commitment`) is an HMAC under that
salt, so:

- The salt must be identical for `register_*` and the later `approve_*` /
  `verify_*`, forever. Changing it makes every existing record unreachable.
- Pin it explicitly with `NOK_HASH_SALT` so it is decoupled from the admin
  secret and survives any future admin-secret rotation (which requires a
  redeploy anyway, because `admin` is a sealed ledger cell).
- The preview deployment used a different admin secret (and its secret is
  committed in `nok_compact_deployment.md`). **Nothing registered on preview
  exists on mainnet** — see §6 for what that means for existing users.

### 3.4 Node version

`backend/package.json` pins `"node": ">=18.0.0 <=22.14.0"`, while the Midnight
toolchain matrix in `NOK-DEPLOYMENT.md` says Node 22.15+. The local machine
runs 22.18 and works; align the `engines` range before relying on it in a
fresh production image.

---

## 4. ZK assets — ship the exact build that was deployed

`nok-api.ts` resolves the compiled artefacts from
`Contract/contract/src/managed/nok/` (`nokContractConfig.zkConfigPath`):

- `keys/*.prover` — sent to the proof server for every write
- `keys/*.verifier` — must equal, byte for byte, the keys published on-chain
- `zkir/*`, `contract/index.js` — circuit IR and generated bindings

`managed/` is **gitignored**. If a production host recompiles `nok.compact`
with `compact compile`, the verifier keys will differ from the ones on-chain and
`joinNok()` / every proof will fail (the same hazard `missingVerifierKeys()`
guards against during deploy). Therefore:

1. Take `Contract/contract/src/managed/nok/` **from the machine that ran the
   mainnet deploy** and treat it as a release artefact (tarball in your
   artefact store, or a private package). Never regenerate it for mainnet.
2. On every host that runs the backend:
   ```bash
   cd Contract
   npm install                      # also runs scripts/patch-dust-batch.mjs
   # restore managed/nok from the artefact — do NOT `npm run compact`
   npm run build -w @k33p/nok-contract   # copies managed/ into contract/dist
   npm run build -w @k33p/nok-cli        # produces cli/dist the backend imports
   cd ../backend && npm install          # links @k33p/nok-cli (file:../Contract/cli)
   ```
3. Sanity-check the keys match the chain before pointing traffic at it:
   ```bash
   cd Contract
   MIDNIGHT_NETWORK=mainnet node --env-file=.env --import tsx -e '
     import { loadConfig } from "./cli/src/config.ts";
     import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
     import { ALL_CIRCUITS, readVerifierKey } from "./cli/src/nok-api.ts";
     const c = loadConfig();
     const s = await indexerPublicDataProvider(c.indexer, c.indexerWS).queryContractState(process.env.NOK_CONTRACT_ADDRESS);
     for (const id of ALL_CIRCUITS) {
       const op = s.operation(id);
       const same = op && Buffer.from(op.verifierKey).equals(Buffer.from(readVerifierKey(id)));
       console.log(id.padEnd(26), op ? (same ? "match" : "MISMATCH") : "MISSING on-chain");
     }'
   ```
   All six circuits must print `match`. `MISSING` means the batched deploy
   never finished — run `RESUME_CONTRACT_ADDRESS=<addr> npm run deploy` per
   `deploymain.md`, not the backend.

The Render build already runs the Contract workspace before the backend
(commit `78d606da`); make sure that step restores the artefact instead of
compiling.

---

## 5. Proof server in production

Every write circuit (`register_*`, `approve_*`, `verify_login`) needs a proof
server; reads do not. Requirements:

- Image `midnightntwrk/proof-server` **8.x** (matches `@midnight-ntwrk/ledger-v8`
  8.1.x pinned in the workspace). Check the support matrix before bumping either.
- Reachable from the backend at `MIDNIGHT_PROOF_SERVER_URL`;
  `curl $URL/health` → `{"status":"ok"}`.
- Proving a circuit takes CPU and several GB of RAM. Co-locate it with the
  backend (same VM / private network); do not expose it publicly.

Render's `render.yaml` only defines the web service. Options:

| Option | Notes |
|---|---|
| Private Docker service on Render | Run the proof-server image as a private service; point `MIDNIGHT_PROOF_SERVER_URL` at its internal hostname. |
| Sidecar on a VM | If the backend moves off Render, `docker run -p 6300:6300 midnightntwrk/proof-server:<8.x>` next to it. |

Without a reachable proof server the backend starts fine, but every signup and
login fails at proof time (`ECONNREFUSED :6300` in the `[NOK]` logs).

---

## 6. Behavioural differences you must plan for

These are consequences of the existing code paths, not new features.

### 6.1 Login and signup are on-chain transactions

`register_identity` *and* `verify_login` are impure circuits (both call
`round.increment`), so each one is a mainnet transaction: proof generation,
DUST fee, submission over Blockfrost, and `midnight-js` waiting for
finalization on the indexer. From `cli/src/deploy.ts`/`wallet.ts` experience,
normal completion is **1–5 minutes**, with a 30-minute TTL worst case.

How `auth.js` handles them:

- **signup** → `enqueueIdentityRegistration()` — **not awaited**. The 201 with
  the JWT goes out immediately with `identityRegistration: "pending"`; the
  on-chain write runs in the background through the write queue (6.2). The
  mobile app polls `GET /api/auth/identity-status/:userId` (Bearer) until
  `state` is `registered` (`failed` carries the error; `unknown` means the
  process restarted before it landed — reconcile with `onChain`).
- **login** → `verifyLoginForUser()` — still awaited inline (hard-fails with
  `ZK_PROOF_INVALID`). On mainnet this blocks the login request for minutes and
  costs DUST per login. Decide explicitly:

| Approach | Change | Trade-off |
|---|---|---|
| Keep synchronous | none | Simplest; unacceptable UX for login behind a ~100 s proxy timeout |
| Queue + poll (as signup does) | return a `pending` login and poll a status endpoint | Still one tx per login; no HTTP timeout |
| Login = proof only, no tx | verify the commitment against `identities` via the read path (`isIdentityRegistered` + compare stored `commitment`) and reserve `verify_login` for high-value actions | Near-instant login; loses the per-login on-chain audit stamp |

### 6.2 All writes are serialized through one wallet

Every write in `nok-service.ts` (`register_nok`, `approve_nok_login`,
`register_identity`, `verify_login`) goes through `enqueueWrite()`, a
single-concurrency promise chain, so transactions are built and submitted
strictly one at a time in arrival order. With one DUST coin a second concurrent
tx could otherwise not be balanced (`Insufficient Funds: could not balance
dust`) until the first finalized. A failed write does not block the ones behind
it. The queue is per process — run **one** backend instance against the
operator wallet (or move the queue to a shared job store before scaling out).

Still worth adding before each tx: the CLI's `waitForTip` /
`waitForSpendableDust` / `withTxCheckpoint` safeguards from `wallet.ts`
(`deploy.ts` shows the pattern in `readyForTx()`), which protect against a
stale DUST view and a coin left `pending` by a dead tx.

### 6.3 Cold start is slow; make it a warm-up, not a request

The first call to `getContext()` syncs the wallet. With a snapshot in
`Contract/cli/.wallet-state/` this takes seconds; without one it is a genesis
scan of mainnet (hundreds of thousands of events, many minutes over Blockfrost,
and it counts against the Blockfrost quota). Render's filesystem is ephemeral,
so **every redeploy is a cold genesis sync** unless you:

- mount a persistent disk and put `Contract/cli/.wallet-state/` (and the
  LevelDB private-state store `nok-private-state` created in the backend's
  cwd) on it, and
- trigger `getContext()` at server start (e.g. in `k33p-backend-server.ts`
  after listen) so the first user does not pay for the sync, and make
  `/api/health` reflect `NOK ready` vs `NOK syncing`.

Snapshots are keyed by network + seed fingerprint, so a preview snapshot never
collides with mainnet. If a snapshot is corrupt or stale (symptom: `0 DUST
coins` while the chain says otherwise), restart once with
`WALLET_STATE_RESET=1`.

### 6.4 Reads should not need the wallet

`check/:userId`, `state`, and `isIdentityRegistered` only use
`providers.publicDataProvider` (an `indexerPublicDataProvider`). Today they
still go through `getContext()`, which builds the wallet. For mainnet, add a
read-only path in `nok-service.ts` that constructs just
`indexerPublicDataProvider(config.indexer, config.indexerWS)` — reads then work
even while the wallet is syncing or out of DUST, and they do not touch the
DUST coin at all.

### 6.5 Existing users are not on mainnet

The `identities` map on the mainnet contract starts empty. Any user who signed
up while the backend pointed at preview has no on-chain commitment, so
`verify_login` fails with `no identity registered`. Options:

- **Backfill**: for each user with a stored `zk_proofs.commitment`, run
  `registerIdentityForUser(user_id, commitment)` through the serialized queue
  (one tx each; budget DUST and time accordingly), or
- **Lazy re-registration**: on login, if `isIdentityRegistered` is false and the
  DB commitment matches, register then verify.

Same applies to NOK records registered on preview via `/api/nok/register`.

### 6.6 DUST budget and monitoring

Every write spends DUST and DUST regenerates slowly toward a cap. Monitor
`getDustBalance()` (exported from `wallet.ts`) and alert when `available` drops
near the per-tx cost; expose it on an admin endpoint. If the wallet runs dry,
`buildWalletAndWaitForFunds` throws on the next cold start and every write
fails until DUST accrues.

### 6.7 Blockfrost quota and flakiness

All indexer/RPC traffic goes through one Blockfrost project. Heavy re-syncs
(ephemeral filesystem, restarts) burn quota; `HTTP 000`/WS `1002` means
rate-limiting. The CLI's HTTP submit path already retries transport failures
and re-broadcasts until finalized (`submitViaHttp` in `wallet.ts`); the backend
inherits that. Budget a paid tier for production traffic.

---

## 7. Switch-over checklist

1. `nok-deployment.mainnet.json` shows `"status": "complete"` (all six verifier
   keys inserted). If not, finish the deploy first.
2. Blockfrost health (from `deploymain.md` §1): both endpoints return `200`.
3. Proof server reachable from the backend host: `curl …/health` → ok.
4. Backend env set per §3; `NOK_HASH_SALT` fixed and backed up with the admin
   secret and seed in the secret manager.
5. `Contract/contract/src/managed/nok` on the host is the deploy artefact, and
   the key-match check in §4 prints six `match` lines.
6. Workspace built: `Contract/cli/dist/nok-api.js` exists and
   `backend/node_modules/@k33p/nok-cli` is the symlink.
7. Persistent storage for `Contract/cli/.wallet-state/` and the private-state
   LevelDB, or accept a genesis sync on every restart.
8. Nobody runs `npm run admin` against mainnet while the backend is up.
9. Restart the backend and watch for:
   ```
   [NOK] Bootstrapping admin wallet on mainnet...
   DUST: spendable <n> (<k> coin(s)), maturing ...
   [NOK] Joined contract 0200…
   ```
10. Smoke test:
    ```bash
    # read — no proof, no DUST
    curl -s http://localhost:3501/api/nok/state -H "Authorization: Bearer <token>"
    curl -s http://localhost:3501/api/nok/check/<userId>

    # write — proof + mainnet tx; expect minutes, costs DUST
    curl -s -X POST http://localhost:3501/api/nok/register \
      -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
      -d '{"nokIdentifier":"+15551234567"}'
    curl -s http://localhost:3501/api/nok/check/<userId>     # now registered: true
    ```
11. Confirm on-chain (optional): the `contractAction` GraphQL query in
    `deploymain.md` §5 shows a new transaction for the address, and
    `/api/nok/state` shows `registeredCount` incremented.

---

## 8. Mobile app

Nothing on the mobile side depends on the network — it only ever talks to the
backend. To light up the existing NOK screens:

| Screen flow | Call |
|---|---|
| `did-creation` → after `POST /api/auth/signup` returns | poll `GET /api/auth/identity-status/:userId` (Bearer) until `state: "registered"`; show "securing your identity on Midnight" meanwhile |
| `profile/nok-setup/register-*` → save NOK | `POST /api/nok/register` `{ nokIdentifier }` (Bearer) |
| Show "NOK configured" badge | `GET /api/nok/check/:userId` |
| NOK-initiated recovery/login | `POST /api/nok/approve-login` `{ userId, nokIdentifier }` |

Because mainnet writes take minutes, design these screens around an
asynchronous "pending → confirmed" state rather than a spinner on the HTTP
call (ties into the queue decision in §6.1).

---

## 9. Troubleshooting (backend on mainnet)

| Symptom in `[NOK]` logs | Cause | Fix |
|---|---|---|
| `missing required env var NOK_CONTRACT_ADDRESS` | Only `MIDNIGHT_MAIN_NOK_ADDRESS` was set | Set `NOK_CONTRACT_ADDRESS` (§2) |
| `MIDNIGHT_BLOCKFROST_PROJECT_ID is required for mainnet` | Token missing, or `MIDNIGHT_NETWORK=mainnet` set without it | Add a Midnight **Mainnet** Blockfrost token |
| Wallet `DISCONNECTED … for 60s` | Preview/preprod token used on mainnet (403), or Blockfrost outage | Use a mainnet token; run the health check |
| `No spendable DUST in this wallet` | Wrong seed (not the deploy wallet), DUST still maturing, or a coin locked by a dead tx in the snapshot | Use the deploy seed; wait; or restart once with `WALLET_STATE_RESET=1` |
| `Insufficient Funds: could not balance dust` on a write | Admin CLI or a second backend instance writing from the same wallet in parallel | Stop the CLI; run a single backend instance (§6.2) |
| Signup returns `identityRegistration: "pending"` but `identity-status` stays `pending` for 10+ min | Queue is working through earlier writes, or the proof server / Blockfrost is slow | Check `[NOK]` logs for the queued write; `state: "failed"` carries the error |
| `ECONNREFUSED` / proof step hangs | Proof server down or unreachable from the host | Fix `MIDNIGHT_PROOF_SERVER_URL`; check `/health` |
| `joinNok` fails / proofs rejected after a rebuild | `managed/nok` recompiled → verifier keys differ from chain | Restore the deploy artefact (§4); never `npm run compact` for mainnet |
| Login returns `ZK_PROOF_INVALID` for every existing user | Users registered on preview; mainnet `identities` is empty | Backfill or lazy re-register (§6.5) |
| `no identity registered` / `commitment mismatch` for *new* users | `NOK_HASH_SALT` (or admin secret used as salt) changed between register and verify | Restore the original salt; never rotate it |
| First request after deploy takes 10+ min or times out | Genesis sync on an ephemeral filesystem | Persist `.wallet-state`; warm up at boot (§6.3) |
| `1010 … Custom error: 170` then retries | Stale DUST view at submit time | Transient; the retry/`waitForTip` logic handles it. Persistent ⇒ snapshot stale, reset once |

### Security reminders

- `nok-deployment.mainnet.json` holds the admin secret **and** the CMA signing
  key. Move both to the secret manager; the CMA key is the only thing that can
  ever add verifier keys to this contract.
- Never log `NOK_WALLET_SEED` or the Blockfrost token. The CLI prints only a
  seed fingerprint; keep it that way in the backend logger adapter.
- The preview admin secret in `nok_compact_deployment.md` is public — do not
  reuse it as `NOK_HASH_SALT` or anywhere on mainnet.
