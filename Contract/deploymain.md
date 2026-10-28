# Midnight Mainnet deploy runbook

A general guide for deploying a compiled Compact smart contract to **Midnight
Mainnet** and pointing an app at it. Mainnet has no faucet and spends **real**
funds — every deploy and every on-chain write costs DUST and is irreversible.

Mainnet's official indexer/RPC are shut down, so everything routes through
**Blockfrost** (see the Midnight "indexer → Blockfrost migration" runbook). A
mainnet deploy connects a wallet (over Blockfrost), waits for it to fully sync,
generates a ZK proof via a proof server, and submits the deploy transaction.

---

## 1. Prerequisites

| Requirement | Env var / how | Notes |
|---|---|---|
| Blockfrost Midnight **Mainnet** project token | `MIDNIGHT_BLOCKFROST_PROJECT_ID` | Per-network — a preprod/preview token 403s on mainnet. Create a Midnight **Mainnet** project at blockfrost.io. |
| Proof server running | `MIDNIGHT_PROOF_SERVER_URL` (e.g. `http://127.0.0.1:6300`) | Required for every deploy (ZK proof). Must be reachable; `curl $URL/health` → `{"status":"ok"}`. Start it before deploying. |
| Funded mainnet wallet seed | `WALLET_SEED` (hex) | Must hold **DUST** (the fee token). Keep the seed secret. |
| Compiled ZK assets | `<managed-dir>/keys/*.verifier` (+ `contract/`, `zkir/`) | Produced by `compact compile` — do **not** compile with `--skip-zk` (that produces no keys). |
| Any contract constructor secrets/args | contract-specific | e.g. an admin/operator key the constructor needs. Save anything generated at deploy time — it may be required to manage the contract afterward. |

### Getting DUST on mainnet

There is **no mainnet faucet**. DUST is a non-transferable fee resource generated
by **registered NIGHT**. Two common sources:

- Hold unshielded NIGHT in the wallet and register it for DUST generation.
- Register **Cardano cNIGHT** mapped to the wallet's Midnight DUST address.

DUST accrues over ~hours to a cap, so a freshly registered wallet may show
little/no spendable DUST at first. A wallet can show `NIGHT 0` and still have
spendable DUST (e.g. when its DUST comes from cNIGHT). Confirm you have spendable
(ready, not just "maturing") DUST before deploying.

### Check Blockfrost is healthy before a run

```bash
PID=$(grep -E '^MIDNIGHT_BLOCKFROST_PROJECT_ID=' .env | sed 's/^[^=]*=//' | tr -d '"')
curl -s -o /dev/null -w 'node RPC %{http_code}\n' -X POST "https://rpc.midnight-mainnet.blockfrost.io?project_id=$PID" \
  -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}'
curl -s -o /dev/null -w 'indexer %{http_code}\n' -X POST "https://midnight-mainnet.blockfrost.io/api/v0?project_id=$PID" \
  -H 'Content-Type: application/json' -d '{"query":"{ block { height } }"}'
```
Both should be `200`. `000` = you're being rate-limited/blocked — wait (see Troubleshooting).

---

## 2. The deploy flow

A deploy script (Node + `tsx`) does, in order:

1. **Build config** targeting mainnet — Blockfrost indexer HTTP + WS and node RPC
   URLs, each with `?project_id=<token>`, plus the proof-server URL. The three
   Blockfrost services:
   | Service | URL |
   |---|---|
   | Indexer HTTP (GraphQL) | `https://midnight-mainnet.blockfrost.io/api/v0` |
   | Indexer WebSocket | `wss://midnight-mainnet.blockfrost.io/api/v0/ws` |
   | Node RPC | `https://rpc.midnight-mainnet.blockfrost.io` |
2. **Build + sync the wallet** from `WALLET_SEED` (derive shielded/unshielded/dust
   sub-wallets, then wait for `isSynced`). The first sync scans the whole chain
   (hundreds of thousands of events, several minutes).
3. **Compile the contract handle** from the managed ZK assets (verifier keys,
   prover keys, circuit IR) + its witnesses.
4. **`deployContract(providers, { compiledContract, privateStateId,
   initialPrivateState, args })`** — generates the proof, balances the tx with
   DUST, submits, and resolves the on-chain contract address.

On success a deploy prints the contract address. Put that address into your app
config / `.env` (see §4) and verify it on-chain (§5).

### Non-interactive deploys (no TTY)

Interactive menu CLIs don't work without a PTY. Drive a deploy headlessly by
reading the seed from env and skipping prompts — the pattern used here is an
`AUTO_DEPLOY=1` env flag that makes the CLI sync-then-deploy-then-exit:

```bash
AUTO_DEPLOY=1 node --env-file=./.env --import tsx <path>/<contract>-mainnet.ts
```

`node --env-file=./.env` loads the env (`tsx` does not do this itself). Point it
at the `.env` that holds `WALLET_SEED`, `MIDNIGHT_BLOCKFROST_PROJECT_ID` and
`MIDNIGHT_PROOF_SERVER_URL`.

### Sync-state persistence (makes retries fast)

A full genesis sync is slow and, over Blockfrost, can stall partway — and
deploy retries are common (see Troubleshooting). Persisting the wallet's synced
state lets a re-run **resume** (seconds) instead of re-syncing from genesis:

- After (and periodically during) sync, serialize each sub-wallet
  (`shielded`/`unshielded`/`dust` `serializeState()`) to disk, keyed by
  **network + a hash of the seed** (never write the seed itself).
- On startup, if a snapshot exists, `restore(serialized)` each sub-wallet instead
  of starting fresh (fall back to fresh if the snapshot is invalid).
- Snapshots are network+seed scoped so they never cross networks/wallets.
  Resuming on the **same** indexer is safe; resuming saved state across a
  *different* indexer corrupts cursors (the migration runbook's
  "values inserted non-linearly" error) — re-sync from scratch in that case.

Provide an escape hatch to ignore/clear snapshots (e.g. a `WALLET_STATE_RESET=1`
env flag) for when state is stale or corrupt.

---

## 3. Will the contract fit in one block?

Every circuit's verifier key goes into the deploy tx. A deploy writes roughly
**1.2× its total verifier-key bytes**, and the per-block limit is **50,000
`bytesWritten`** (mainnet/preprod/preview). A single tx can use only ~65% of a
block, so a contract with ~15+ circuits can overflow:

- **≥100% of a block:** `deployContract` throws `exceeded block limit in
  transaction fee computation` before submitting.
- **~65–100%:** the node rejects with RPC `1010 Transaction would exhaust the
  block limits` (often surfaced as a generic submission error).

Size it **offline** (no wallet/node/key needed) by pricing a synthetic deploy of
the verifier keys with the ledger cost model against the block limits — see
servicedesk **PR #217** (`measure-deploy-cost.mjs`). If it's over, deploy in
**batches**: deploy a subset of circuits, then add the remaining verifier keys
one per tx via CMA-signed maintenance updates (`submitInsertVerifierKeyTx`) —
`batch-deploy.ts` in the same PR. Keep the contract-maintenance-authority (CMA)
key or the deploy can never be finished.

---

## 4. Wire the app to the deployed contract (per-network)

To let mainnet and non-mainnet addresses coexist in one `.env`, resolve
deployed-contract addresses **per network**:

- `MIDNIGHT_NETWORK=mainnet` → read `MIDNIGHT_MAIN_<NAME>_ADDRESS`
- otherwise → read `MIDNIGHT_<NAME>_ADDRESS` (preview/preprod unchanged)

After a deploy:

1. Put the printed address in `.env` as `MIDNIGHT_MAIN_<NAME>_ADDRESS=...`
2. To run the app on mainnet, set:
   ```
   MIDNIGHT_NETWORK=mainnet
   NEXT_PUBLIC_MIDNIGHT_NETWORK_ID=mainnet
   ```
3. **Restart** the app — the server wallet is typically cached per process.

On mainnet the app runtime should pay fees from the **same funded wallet**
(`WALLET_SEED`). Runtime on-chain writes also full-sync the wallet and prove per
write, so they're slow and need the proof server up; apply the same sync-state
persistence to the runtime if you want writes to be snappy across restarts.

---

## 5. Verify a deploy on-chain

```bash
PID=$(grep -E '^MIDNIGHT_BLOCKFROST_PROJECT_ID=' .env | sed 's/^[^=]*=//' | tr -d '"')
ADDR=<deployed address>
curl -s -X POST "https://midnight-mainnet.blockfrost.io/api/v0" \
  -H "project_id: $PID" -H 'Content-Type: application/json' \
  -d "{\"query\":\"{ contractAction(address: \\\"$ADDR\\\") { address transaction { hash block { height } } } }\"}"
```
A `contractAction` with a `transaction.block.height` = it's live.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `MIDNIGHT_BLOCKFROST_PROJECT_ID is required ...` at startup | token missing/empty in `.env` (watch for duplicate empty lines — last one wins) | Set a single mainnet token; verify with `node --env-file=.env -e "console.log(process.env.MIDNIGHT_BLOCKFROST_PROJECT_ID?.length)"` |
| Deploy/sync: `HTTP 000`, or WS floods `1002 :: non-101 status` | Blockfrost **rate-limiting/quota** (heavy repeated full syncs) | Stop; wait (minutes → daily reset); rely on sync persistence so you don't re-sync from genesis; consider a higher Blockfrost tier |
| `subscribeRuntimeVersion ... 1000 Normal Closure` / `Wallet.Sync: [object Object]` | Harmless WS resubscribes (per the migration runbook) | Ignore — only a problem if progress is frozen with **no** advancement for ~10+ min |
| Sync stalls partway, no progress for 10+ min | Transient Blockfrost stream drop that didn't resume | Kill and re-run — it resumes from the last snapshot |
| Deploy fails: `Encountered unexpected error: An unknown error occurred` or `request to ...blockfrost.io... failed` | Transient Blockfrost **indexer** hiccup during the deploy's balancing/confirm step (bigger contracts = longer window = more likely) | Re-run (cheap with persistence); it succeeds in a stable window |
| App on-chain op: **out of dust** | Wrong/unfunded wallet seed, or `MIDNIGHT_NETWORK` not `mainnet`, or DUST not yet matured | Ensure `MIDNIGHT_NETWORK=mainnet` and the funded wallet is used; confirm spendable DUST; restart the app |
| `exceeded block limit in transaction fee computation` or node `1010 ... exhaust the block limits` | Contract too large for one block (~15+ circuits / >65% of the 50,000 `bytesWritten` limit) | Batch the deploy — see §3 and servicedesk PR #217 |

### Security

Deploy logs can print the wallet seed and (in WS URLs) the Blockfrost token. If a
seed/token is exposed in shared logs, **rotate the token and move funds to a fresh
wallet**. Never commit `.env`, wallet sync-state snapshots, or any generated
wallet-seed file.




# Deploying contracts with our `WALLET_SEED` (DUST-funded)

How to deploy any of the Compact contracts in `contract/` using the wallet seed in
`.env`, paying fees with the DUST that wallet already holds. This is the concrete,
repo-specific version of the general `mainnet-deploy-runbook.md` — read that for
the "why"; this doc is the "what to type".

All commands run **inside WSL** from the repo root unless stated otherwise.

---

## 0. TL;DR

```bash
# 1. proof server up?
curl -s "$(grep -E '^MIDNIGHT_PROOF_SERVER_URL=' .env | cut -d= -f2-)/health"   # {"status":"ok"}

# 2. build the contract you want (compile Compact + package; ~5 min)
cd contract && npm run build:shadowpollsv2

# 3. deploy, non-interactive, using the seed from ../.env
AUTO_DEPLOY=1 node --env-file=../.env --import tsx cli/shadowpollsv2-mainnet.ts

# 4. paste the printed "App env:" line into .env, set MIDNIGHT_NETWORK, restart app
```

---

## 1. How the seed is picked up

Every deploy CLI (`contract/cli/*-preview.ts`, `*-mainnet.ts`) resolves the seed the
same way:

1. `process.env.WALLET_SEED`
2. else `process.env.MIDNIGHT_WALLET_SEED`
3. else it **reads `../.env` directly** (`seedFromDotenv()` — `contract/cli/*.ts`) and
   takes the first of `WALLET_SEED=` / `MIDNIGHT_WALLET_SEED=` it finds.

So as long as `.env` at the repo root has `MIDNIGHT_WALLET_SEED` (it does — same
value as `WALLET_SEED`), you do **not** need to export anything. The CLI then:

- derives the three sub-wallets (shielded / unshielded NIGHT / **dust**) from the
  hex seed via HD derivation, account 0 index 0 (`deriveKeysFromSeed` in
  `contract/cli/api.ts`),
- restores a cached sync snapshot from `contract/.wallet-state/<network>-<seedhash>/`
  if one exists (so re-runs take seconds, not a full chain scan),
- syncs, prints a wallet overview (seed + addresses), and returns.

The seed is a **64-char hex string** (32 bytes), not a mnemonic. Keep the same seed
for deploys *and* the app runtime: the app pays its own on-chain writes
(create/activate/close/vote) from `MIDNIGHT_WALLET_SEED`, so the DUST must be on
the same wallet the contract was deployed from.

---

## 2. Where the DUST comes from (and why mainnet vs preview behave differently)

DUST is Midnight's non-transferable fee token. It is **generated over time by
registered NIGHT**, it is not sent to you. Two sources:

| Source | How it reaches our wallet | Used on |
|---|---|---|
| Unshielded **tNIGHT** in the wallet, registered on-chain for dust generation | Faucet → `mn_addr_…` → the CLI auto-registers UTXOs (`registerForDustGeneration`) → DUST accrues | Preview |
| **cNIGHT on Cardano**, mapped to the wallet's Midnight **dust address** | Done once on the Cardano side; DUST then accrues to our dust address with **0 native NIGHT** in the wallet | Mainnet |

This is why the two CLI flavours call `buildWalletAndWaitForFunds` differently:

- **Preview CLIs** use the default `requireNightFunds: true`: after sync, if
  unshielded balance is `0` they block on "Waiting for incoming tokens" until tNIGHT
  arrives, then register the UTXOs for dust generation and block again until
  `dust.balance > 0`.
- **Mainnet CLIs** pass `requireNightFunds: false`: they **skip** both waits, because
  our mainnet wallet is funded via cNIGHT and legitimately shows `NIGHT 0`. The
  AUTO path prints `[auto] Spendable DUST: <n>` right before deploying — if that is
  `0`, stop; the deploy will fail with an out-of-dust/balancing error.

Notes on DUST behaviour that bite during deploys:

- DUST **matures** — a freshly registered wallet shows coins but little spendable
  balance. `getDustBalance()` distinguishes `available` (spendable now) from
  `pending`. Only `available` matters.
- A pending transaction **locks** the dust coin it is spending. If you fire two
  deploys back-to-back (or the app is mid-write with the same seed) the second
  sees `⚠ locked by pending tx` / 0 available until the first finalises.
- DUST accrues to a **cap** proportional to registered NIGHT; a big contract deploy
  (v2 survey, DAO v1) can need a sizeable chunk. Check before, not after.

### Find the addresses to fund

```bash
# unshielded NIGHT receive address (mn_addr_…) — preview faucet target
npm run scripts:wallet:address

# dust address — printed in the "Wallet Overview" block of any deploy CLI once synced
#   Dust
#   └─ Address: mn_dust_…
```

The dust address is what a cNIGHT→Midnight mapping needs to target on mainnet.

---

## 3. Prerequisites per network

| | Preview | Mainnet |
|---|---|---|
| Config class | `PreviewConfig` (public indexer/RPC) | `MainnetConfig` (Blockfrost; throws if token missing) |
| Required env | `MIDNIGHT_WALLET_SEED`, `MIDNIGHT_PROOF_SERVER_URL` | + `MIDNIGHT_BLOCKFROST_PROJECT_ID` (**mainnet** project token) |
| Funding | tNIGHT from https://faucet.midnight.network/ → auto-registered | Pre-existing DUST (cNIGHT-backed) — no faucet, no auto-registration |
| Cost | free | **real, irreversible** |

Common to both:

- **Proof server reachable** at `MIDNIGHT_PROOF_SERVER_URL` (or `PROOF_SERVER_URL`),
  `curl $URL/health` → `{"status":"ok"}`. The Preview default is a WSL-host IP
  (`172.22.96.1:6300`) — override it in `.env` if your Docker proof server lives
  elsewhere. Versions must match ledger v8 → `proof-server:8.x`.
- **Compiled ZK assets** in `contract/src/managed/<name>/` (`keys/`, `zkir/`,
  `contract/`). Run the matching `build:*` first; never `--skip-zk`.

Blockfrost smoke test (mainnet only):

```bash
PID=$(grep -E '^MIDNIGHT_BLOCKFROST_PROJECT_ID=' .env | cut -d= -f2- | tr -d '"')
curl -s -o /dev/null -w 'rpc %{http_code}\n' -X POST "https://rpc.midnight-mainnet.blockfrost.io?project_id=$PID" \
  -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"system_chain","params":[]}'
curl -s -o /dev/null -w 'indexer %{http_code}\n' -X POST "https://midnight-mainnet.blockfrost.io/api/v0?project_id=$PID" \
  -H 'Content-Type: application/json' -d '{"query":"{ block { height } }"}'
```

Both `200` or don't start.

---

## 4. Contract → build → deploy → env var

Run from `contract/`. `npm run deploy:*` invokes `tsx` directly and does **not**
load `.env` into `process.env`; that's fine for the seed (the CLI reads `../.env`
itself) but **not** for `MIDNIGHT_BLOCKFROST_PROJECT_ID` / `MIDNIGHT_PROOF_SERVER_URL`.
Prefer the `node --env-file=../.env --import tsx <cli>` form shown in the table for
anything beyond a Preview default setup.

| Contract | Build | Deploy (Preview) | Deploy (Mainnet) | App env var written |
|---|---|---|---|---|
| Shadow Polls (legacy, single-question) | `npm run build:shadowpolls` | `cli/shadow-polls-preview.ts` | `cli/shadow-polls-mainnet.ts` | `MIDNIGHT_SHADOWPOLLS_ADDRESS` / `MIDNIGHT_MAIN_SHADOWPOLLS_ADDRESS` |
| Shadow Polls v1 (multi-question) | `npm run build:shadowpollv1` | `cli/shadowpollv1-preview.ts` | — (no mainnet CLI yet) | `MIDNIGHT_SHADOWPOLLSV1_ADDRESS` |
| Shadow Polls v2 (segments / multi-select / stars) | `npm run build:shadowpollsv2` | `cli/shadowpollsv2-preview.ts` | `cli/shadowpollsv2-mainnet.ts` | `MIDNIGHT_SHADOWPOLLSV2_ADDRESS` / `MIDNIGHT_MAIN_SHADOWPOLLSV2_ADDRESS` |
| Shadow Feedback | `npm run build:shadowfeedback` | `cli/shadowfeedback-preview.ts` | `cli/shadowfeedback-mainnet.ts` | `MIDNIGHT_SHADOWFEEDBACK_ADDRESS` / `MIDNIGHT_MAIN_SHADOWFEEDBACK_ADDRESS` |
| Shadow DAO v1 | `npm run build:shadowdaov1` | `cli/shadowdaov1-preview.ts` | `cli/shadowdaov1-mainnet.ts` | `MIDNIGHT_SHADOWDAOV1_ADDRESS` / `MIDNIGHT_MAIN_SHADOWDAOV1_ADDRESS` |
| Shadow DAO / DAO1 (older) | `build:shadowdao`, `build:shadowdao1` | `cli/shadowdao-preview.ts`, `cli/shadowdao1-preview.ts` (+ `*-preprod.ts`) | — | `MIDNIGHT_SHADOWDAO_ADDRESS`, … |

Each `npm run deploy:<name>:<net>` script in `contract/package.json` is just
`tsx cli/<file>.ts`; the table lists the file so you can use either form.

### 4a. Interactive (TTY) deploy

```bash
cd contract
node --env-file=../.env --import tsx cli/shadowpollsv2-mainnet.ts
```

Wallet menu → **`[3] Use WALLET_SEED from environment / .env`** (only shown when a
seed was found). It syncs, prints the overview, then the main menu shows
`DUST: <spendable>` in the header — that number is your go/no-go. Choose
`[1] Deploy`; mainnet CLIs make you type `deploy` to confirm.

### 4b. Non-interactive (`AUTO_DEPLOY=1`) — what to use from scripts / no PTY

```bash
cd contract
AUTO_DEPLOY=1 node --env-file=../.env --import tsx cli/shadowpollsv2-mainnet.ts
```

Flow: restore wallet from seed → sync → print spendable DUST → deploy once →
print address + `App env:` line → exit 0 (even on failure — read the output).
Requires the seed in env/`.env`; exits 1 otherwise. `AUTO_DEPLOY` exists on the
mainnet CLIs; the preview CLIs are menu-driven.

### 4c. Constructor secrets — save them

Some contracts take an operator/admin key at deploy time and **cannot be managed
without it afterwards**:

- **Shadow Polls v2 / Feedback / DAO v1**: operator secret for the block-height
  oracle. In AUTO mode it is taken from `SHADOWPOLLS_OPERATOR_SECRET`, else
  `MIDNIGHT_ADMIN_SECRET`, else a fresh one is **generated and printed**. Use
  `MIDNIGHT_ADMIN_SECRET` so the running app (which calls `update_block_height`
  with the same key) matches the deployed contract. If it was generated, copy it
  into `.env` immediately.

---

## 5. After the deploy

1. Copy the printed `App env: MIDNIGHT_[MAIN_]<NAME>_ADDRESS=…` into `.env`.
   Mainnet addresses live under `MIDNIGHT_MAIN_*` so they can coexist with the
   Preview ones; `lib/midnight/config.ts` picks the right set from `MIDNIGHT_NETWORK`.
2. Set the network the app should run on, keeping the two in sync:
   ```
   MIDNIGHT_NETWORK=mainnet            # preview | preprod | mainnet
   NEXT_PUBLIC_MIDNIGHT_NETWORK_ID=mainnet
   ```
   On preprod/mainnet, unset `MIDNIGHT_*_ADDRESS` ⇒ that contract runs store-only;
   the hardcoded fallbacks in `DEPLOYED_ADDRESSES` are **Preview only**.
3. **Restart the app** — the server wallet is cached per process.
4. Verify on-chain (mainnet):
   ```bash
   PID=$(grep -E '^MIDNIGHT_BLOCKFROST_PROJECT_ID=' .env | cut -d= -f2- | tr -d '"')
   ADDR=<deployed address>
   curl -s -X POST "https://midnight-mainnet.blockfrost.io/api/v0" \
     -H "project_id: $PID" -H 'Content-Type: application/json' \
     -d "{\"query\":\"{ contractAction(address: \\\"$ADDR\\\") { address transaction { hash block { height } } } }\"}"
   ```
   or, for any network, `MIDNIGHT_NETWORK=<net> node --env-file=.env scripts/diagnose-midnight-sync.mjs`.

---

## 6. Troubleshooting (seed / DUST specific)

| Symptom | Cause | Fix |
|---|---|---|
| `AUTO_DEPLOY=1 requires WALLET_SEED or MIDNIGHT_WALLET_SEED` | Neither in env nor in `../.env` (CLI looks one directory **up** from `cwd`) | Run from `contract/`, or `--env-file=../.env` |
| Preview CLI stuck on `Waiting for incoming tokens` | Wallet has 0 tNIGHT | Send faucet tNIGHT to the printed `mn_addr_…`; it continues automatically |
| Preview CLI stuck on `Waiting for dust tokens to generate` | UTXOs just registered, DUST not matured | Wait (minutes); it polls every 5 s |
| Mainnet `[auto] Spendable DUST: 0` then deploy fails balancing | cNIGHT not mapped to **this** seed's dust address, DUST still maturing, or locked by a pending tx | Check the `Dust └─ Address` in the overview matches the mapping; wait; make sure the app isn't mid-write with the same seed |
| `MIDNIGHT_BLOCKFROST_PROJECT_ID is required…` | Ran via `npm run deploy:*:mainnet` without `--env-file`, or empty/duplicate line in `.env` (last one wins) | Use the `node --env-file=../.env --import tsx` form; `node --env-file=.env -e "console.log(process.env.MIDNIGHT_BLOCKFROST_PROJECT_ID?.length)"` |
| Wallet overview shows a different address than expected | Different seed resolved (`WALLET_SEED` wins over `MIDNIGHT_WALLET_SEED`) | Keep both equal in `.env`, or unset one |
| Sync never finishes / "values inserted non-linearly" | Stale snapshot in `contract/.wallet-state/` from another indexer | `WALLET_STATE_RESET=1 AUTO_DEPLOY=1 node --env-file=../.env --import tsx cli/<x>.ts` |
| Proof step hangs or `ECONNREFUSED :6300` | Proof server down / wrong host from WSL | `curl $MIDNIGHT_PROOF_SERVER_URL/health`; fix the URL in `.env` |
| `exceeded block limit…` / RPC `1010` | Contract too large for one block | See `mainnet-deploy-runbook.md` §3 (batch deploy) |

### Security

- The deploy CLIs **print the seed** in the Wallet Overview and the Blockfrost
  token appears in WS URLs in logs under `contract/logs/<network>/`. Don't paste
  those logs anywhere shared; if you do, rotate the token and move funds to a new seed.
- Menu option "Show wallet seed" is masked unless `SHOW_SECRETS=1`.
- Never commit `.env`, `contract/.wallet-state/`, or `contract/logs/`.
