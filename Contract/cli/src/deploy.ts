// SPDX-License-Identifier: Apache-2.0
//
// NOK deployment script. Endpoints come from the SHARED config module
// (./config.ts) — never hardcoded here (Issue 4).
//
//   npm run deploy                      # Preview (default)
//   MIDNIGHT_NETWORK=preprod npm run deploy
//   MIDNIGHT_NETWORK=mainnet npm run deploy    # REAL funds — see ../deploymain.md
//
// This script is fully NON-INTERACTIVE and NEVER prompts for (or prints) a seed.
// Secrets are read from the environment only:
//
//   WALLET_SEED        (required) hex seed of the funded wallet. Keep it secret.
//   NOK_ADMIN_SECRET   (optional) hex 32-byte admin secret. Generated if absent.
//
// Mainnet additionally requires (see ../deploymain.md):
//   MIDNIGHT_BLOCKFROST_PROJECT_ID   Blockfrost Midnight *Mainnet* project token
//   MIDNIGHT_PROOF_SERVER_URL        reachable proof server (ZK proofs)

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sampleSigningKey } from '@midnight-ntwrk/compact-runtime';

import { loadConfig, ACTIVE_NETWORK, IS_MAINNET, contractAddressEnvName } from './config.js';
import { createLogger } from './logger-utils.js';
import {
  buildWalletAndWaitForFunds,
  disposeWallet,
  setLogger,
  waitForTip,
  waitForSpendableDust,
  getDustBalance,
  lastSubmittedTxId,
  stopRebroadcast,
} from './wallet.js';
import {
  configureNokProviders,
  deployNok,
  generateAdminSecret,
  deriveAdminPubKey,
  insertDeferredVerifierKeys,
  missingVerifierKeys,
  ensureSigningKey,
  ALL_CIRCUITS,
  DEPLOY_CIRCUITS,
  DEFERRED_CIRCUITS,
} from './nok-api.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const DIV = '──────────────────────────────────────────────────────────────';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Bound the deploy so it can never hang silently. The window deliberately
// covers the full 30 min tx TTL (set in balanceTx): while we wait, the same
// bytes are re-broadcast every ~45s (see wallet.ts) in case Blockfrost's RPC
// node accepted the tx but failed to propagate it. Only once the TTL has
// passed is a brand-new deploy tx safe — a second tx spending the same DUST
// coin while the first could still land would conflict. Normal completion is
// 1–5 minutes; the long bound is the worst case, not the expectation.
const DEPLOY_TIMEOUT_MS = Number(process.env.DEPLOY_TIMEOUT_MS ?? 31 * 60_000);

class DeployTimeoutError extends Error {
  constructor(ms: number) {
    super(`Deploy did not complete within ${Math.round(ms / 60_000)} min (the transaction was not observed as finalized on the indexer).`);
    this.name = 'DeployTimeoutError';
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new DeployTimeoutError(ms)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

// Walk an Error's `cause` chain (Effect wraps errors several levels deep).
const errorChain = (e: unknown): unknown[] => {
  const out: unknown[] = [];
  let cur: any = e;
  for (let i = 0; cur && i < 10; i++) {
    out.push(cur);
    cur = cur.cause;
  }
  return out;
};

// A deploy is worth retrying when the node rejected the tx for a *state-timing*
// reason rather than a structural one. Two ways that surfaces:
//   1. Immediate RPC rejection "1010 ... Custom error: 170" (InvalidDustSpendProof):
//      the DUST fee proof was built against a stale DUST state.
//   2. Accepted into the pool, then status `Invalid` → the SDK throws
//      TransactionInvalidError("Transaction is invalid and was rejected by the
//      node") and DISCARDS the node's reason. In practice this is the same
//      stale-DUST race caught at block-building time instead of at submit.
// Both resolve by re-syncing to tip and rebuilding/re-proving the transaction.
const isRetryableRejection = (e: unknown): boolean => {
  for (const err of errorChain(e)) {
    const tag = (err as any)?._tag;
    const msg = `${(err as any)?.message ?? ''} ${String(err)}`;
    if (tag === 'TransactionInvalidError') return true;
    if (/Custom error:\s*170|InvalidDustSpendProof/i.test(msg)) return true;
    if (/invalid and was rejected by the node/i.test(msg)) return true;
  }
  return false;
};

const config = loadConfig();
const logger = await createLogger(config.logDir);
setLogger(logger);

console.log(`\n  NOK deployment — network: ${ACTIVE_NETWORK}\n`);

// 1) Wallet seed — environment only. We never prompt for or echo the seed.
const seed = process.env.WALLET_SEED?.trim();
if (!seed || seed.length < 32) {
  console.error(
    '  ✗ WALLET_SEED is not set (or too short).\n' +
      '    Provide the funded wallet seed via the WALLET_SEED environment variable\n' +
      '    (e.g. in a gitignored .env loaded with `node --env-file=.env`). The CLI\n' +
      '    never prompts for or prints the seed.',
  );
  process.exit(1);
}

// Mainnet is irreversible and spends real DUST — require an explicit opt-in so a
// stray MIDNIGHT_NETWORK can't trigger a costly deploy by accident.
if (IS_MAINNET && process.env.CONFIRM_MAINNET_DEPLOY !== 'yes') {
  console.error(
    '  ✗ Refusing to deploy to MAINNET without confirmation.\n' +
      '    Mainnet spends REAL funds and is irreversible (see ../deploymain.md).\n' +
      '    Set CONFIRM_MAINNET_DEPLOY=yes to proceed.',
  );
  process.exit(1);
}

// Optional proof-server preflight — a deploy cannot produce a ZK proof without it.
try {
  const health = await fetch(new URL('/health', config.proofServer).toString()).then((r) => r.ok).catch(() => false);
  if (!health) {
    console.log(`  ⚠  Proof server at ${config.proofServer} did not report healthy — continuing, but a deploy will fail if it is unreachable.`);
  }
} catch {
  /* non-fatal preflight */
}

const walletContext = await buildWalletAndWaitForFunds(config, seed);

// 2) Admin secret — environment only; generated (and shown once) if absent.
const adminEnv = process.env.NOK_ADMIN_SECRET?.trim();
let adminSecret: Uint8Array;
if (adminEnv && adminEnv.length >= 64) {
  adminSecret = Buffer.from(adminEnv, 'hex');
  console.log('  Using admin secret from NOK_ADMIN_SECRET.\n');
} else {
  adminSecret = generateAdminSecret();
  console.log(`\n  Generated admin secret: ${Buffer.from(adminSecret).toString('hex')}`);
  console.log('  ⚠  SAVE THIS NOW — it is required to register/approve NOKs and is shown only once.\n');
}

// Persist the admin secret BEFORE deploying. The final nok-deployment file is
// only written on success; if the tx lands but the finalization watch times out
// (Blockfrost instability), this pending file is the durable copy of the secret
// that controls the contract. Gitignored (nok-deployment*.json).
const pendingPath = path.resolve(currentDir, '..', `nok-deployment.${ACTIVE_NETWORK}.pending.json`);
const outPath = path.resolve(currentDir, '..', `nok-deployment.${ACTIVE_NETWORK}.json`);

// Contract Maintenance Authority (CMA) key. Generated up front so it can be
// persisted BEFORE the deploy tx is submitted: it is the only key that can add
// the deferred verifier keys, so if it were lost the deploy could never be
// completed (runbook caveat #1). On resume, reuse the saved one.
const savedRecord: Record<string, any> | undefined = (() => {
  for (const p of [outPath, pendingPath]) if (existsSync(p)) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { /* ignore */ } }
  return undefined;
})();
const cmaSigningKey: string =
  process.env.CMA_SIGNING_KEY?.trim() || (process.env.RESUME_CONTRACT_ADDRESS && savedRecord?.cmaSigningKey) || sampleSigningKey();

const writePending = (extra: Record<string, unknown> = {}) =>
  writeFileSync(
    pendingPath,
    JSON.stringify(
      {
        network: ACTIVE_NETWORK,
        adminPubKey: Buffer.from(deriveAdminPubKey(adminSecret)).toString('hex'),
        adminSecret: Buffer.from(adminSecret).toString('hex'),
        cmaSigningKey,
        deployCircuits: DEPLOY_CIRCUITS,
        deferredCircuits: DEFERRED_CIRCUITS,
        startedAt: new Date().toISOString(),
        status: 'pending',
        ...extra,
      },
      null,
      2,
    ),
  );
writePending();
console.log(`  Admin secret + CMA signing key saved to ${pendingPath} (pending; finalized file written on success).\n`);

// 3) Deploy — retry on error 170 (stale DUST spend proof). Each deployNok call
//    rebuilds + re-proves + re-balances the tx, so a retry after re-syncing
//    produces a fresh DUST proof against the current ledger state.
try {
  const providers = await configureNokProviders(walletContext, config, logger);

  // Shared pre-flight before any fee-paying tx: at tip + an available DUST coin.
  const readyForTx = async (): Promise<void> => {
    await waitForTip(walletContext.wallet);
    const ok = await waitForSpendableDust(walletContext.wallet);
    if (!ok) {
      const d = await getDustBalance(walletContext.wallet);
      throw new Error(
        d.pendingCoins > 0
          ? `No available DUST coin (${d.pendingCoins} pending). A previous submission locked it; wait for the tx TTL or re-run with WALLET_STATE_RESET=1.`
          : 'No DUST coins at all. Re-run with WALLET_STATE_RESET=1 (stale snapshot) or check the cNIGHT→DUST registration.',
      );
    }
  };

  const adminPubKeyHex = Buffer.from(deriveAdminPubKey(adminSecret)).toString('hex');
  const writeDeployment = (contractAddress: string, extra: Record<string, unknown>) =>
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          network: ACTIVE_NETWORK,
          contractAddress,
          adminPubKey: adminPubKeyHex,
          adminSecret: Buffer.from(adminSecret).toString('hex'),
          cmaSigningKey,
          deployCircuits: DEPLOY_CIRCUITS,
          deferredCircuits: DEFERRED_CIRCUITS,
          ...extra,
        },
        null,
        2,
      ),
    );

  // ── Resume mode: contract already deployed, only the deferred verifier keys
  //    are missing (e.g. the process died between deploy and inserts). ────────
  let contractAddress: string;
  const resumeAddress = process.env.RESUME_CONTRACT_ADDRESS?.trim();
  if (resumeAddress) {
    contractAddress = resumeAddress;
    console.log(`  Resuming: skipping deploy, completing verifier-key inserts for ${contractAddress}\n`);
    // The store normally still has the CMA key from the deploy; if not (fresh
    // machine / wiped store) restore it from the saved record or CMA_SIGNING_KEY.
    await ensureSigningKey(providers, contractAddress, cmaSigningKey);
  } else {
    const MAX_ATTEMPTS = 5;
    let deployed: Awaited<ReturnType<typeof deployNok>> | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // At tip (valid DUST proof) and an available DUST coin (not locked by a
    // previous in-flight/failed submission) before building a fee-paying tx.
    await readyForTx();
    try {
      deployed = await walletContext.withTxCheckpoint(() =>
        withTimeout(deployNok(providers, adminSecret, logger, cmaSigningKey), DEPLOY_TIMEOUT_MS),
      );
      break;
    } catch (e) {
      if (e instanceof DeployTimeoutError) {
        // Do NOT blindly retry (that could deploy twice). Say precisely what is
        // known: whether the node accepted a submission, and how to check it.
        const submitted = lastSubmittedTxId;
        // Record what was submitted alongside the admin secret so nothing is lost.
        writePending({ status: submitted ? 'submitted-unconfirmed' : 'timed-out-before-submit', txId: submitted ?? null, timedOutAt: new Date().toISOString() });
        console.error(
          `\n  ✗ ${e.message}\n` +
            (submitted
              ? `     The node ACCEPTED the transaction (txId ${submitted}) and it was re-broadcast for the\n` +
                `     full TTL, but it was never observed as finalized. Confirm before doing anything:\n` +
                `       node scripts/check_tx.mjs <MIDNIGHT_BLOCKFROST_PROJECT_ID> ${submitted}\n` +
                `     • finalized → use the printed contract address; do NOT redeploy.\n` +
                `     • not found → the tx expired (TTL passed), so a fresh deploy is now safe: re-run npm run deploy,\n` +
                `       ideally when the Blockfrost health check (deploymain.md §1) is consistently 200/200.\n`
              : `     No submission was accepted by the node (timed out before/while submitting).\n` +
                `     Verify nothing landed, then re-run:\n` +
                `       node scripts/scan_deploys.mjs <MIDNIGHT_BLOCKFROST_PROJECT_ID> <ISO time of "Deploying NOK contract..." line>\n`),
        );
        throw e;
      }
      if (!isRetryableRejection(e) || attempt === MAX_ATTEMPTS) throw e;
      const waitMs = 20_000 * attempt; // back off: 20s, 40s, 60s, 80s
      console.log(
        `  ⚠  Node rejected the deploy tx (state-timing rejection: stale DUST view / status Invalid).\n` +
          `     Attempt ${attempt}/${MAX_ATTEMPTS}: re-syncing to tip and retrying in ${waitMs / 1000}s…`,
      );
      // Deliberately do NOT persist here: the wallet currently marks the DUST
      // coin as pending for the rejected tx, and snapshotting that state would
      // carry the lock into the next run ("could not balance dust").
      await sleep(waitMs);
    }
  }
    if (!deployed) throw new Error('Deploy failed: node kept rejecting the transaction after all retries.');

    contractAddress = deployed.deployTxData.public.contractAddress;
    // Persist + print the address IMMEDIATELY — before the (multi-tx) insert
    // phase — so a failure there can never lose it. Gitignored file.
    writeDeployment(contractAddress, { deployedAt: new Date().toISOString(), status: 'deployed-inserting-keys' });
    rmSync(pendingPath, { force: true });
    console.log(`\n  ✓ Contract deployed at ${contractAddress}  (saved to ${outPath})`);
    console.log(`    Now inserting ${DEFERRED_CIRCUITS.length} deferred verifier key(s) — one tx each.`);
    console.log(`    Until all are in: do NOT recompile the contract, and do not point the backend at it yet\n`);
  }

  // ── Insert the deferred verifier keys (idempotent: only what is missing). ──
  const inserted = await withTimeout(
    insertDeferredVerifierKeys(
      providers,
      contractAddress,
      logger,
      async (circuitId, i, total) => {
        console.log(`  → verifier key ${i + 1}/${total}: ${circuitId}`);
        await readyForTx();
      },
      (fn) => walletContext.withTxCheckpoint(() => withTimeout(fn(), DEPLOY_TIMEOUT_MS)),
    ),
    DEPLOY_TIMEOUT_MS * Math.max(1, DEFERRED_CIRCUITS.length),
  );
  const stillMissing = await missingVerifierKeys(providers, contractAddress);
  if (stillMissing.length > 0) {
    writeDeployment(contractAddress, { status: 'deployed-keys-incomplete', missingCircuits: stillMissing });
    throw new Error(
      `Contract is deployed at ${contractAddress} but ${stillMissing.length} verifier key(s) are still missing: ` +
        `${stillMissing.join(', ')}. Re-run with RESUME_CONTRACT_ADDRESS=${contractAddress} to insert them.`,
    );
  }
  writeDeployment(contractAddress, { status: 'complete', completedAt: new Date().toISOString(), insertedNow: inserted });

  const addrEnvName = contractAddressEnvName('NOK');
  console.log(`\n${DIV}`);
  console.log('  ✓ NOK deployed — all circuits live');
  console.log(`  Network : ${ACTIVE_NETWORK}`);
  console.log(`  Address : ${contractAddress}`);
  console.log(`  Admin PK: ${adminPubKeyHex}`);
  console.log(`  Circuits: ${ALL_CIRCUITS.join(', ')}`);
  console.log(`  Saved   : ${outPath}`);
  console.log(`${DIV}`);
  console.log('  Wire your app to this contract by adding to .env:');
  console.log(`    ${addrEnvName}=${contractAddress}`);
  console.log(`${DIV}\n`);
} catch (e) {
  // e.message is just the outer "Transaction submission error" and hides the
  // node's real reason. Print the FULL chain (String(e)) which ends with the
  // node response, e.g. "... 1010: Invalid Transaction: Custom error: N", plus
  // the stack, so the actual ledger error code is visible.
  console.error(`  ✗ Deploy failed: ${e instanceof Error ? e.message : String(e)}`);
  console.error('  ── full error chain ─────────────────────────────────────────');
  console.error(String(e));
  if (e instanceof Error && e.stack) console.error(e.stack);
  try {
    console.error('  ── serialized ───────────────────────────────────────────────');
    console.error(JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}), 2));
  } catch {
    /* ignore non-serializable errors */
  }
  process.exitCode = 1;
} finally {
  await stopRebroadcast();
  await disposeWallet(walletContext);
}
