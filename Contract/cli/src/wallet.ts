// SPDX-License-Identifier: Apache-2.0
//
// Contract-agnostic wallet bootstrap for the Midnight PreProd/Preview networks.
// Builds a WalletFacade (shielded + unshielded + dust), waits for sync/funds,
// registers NIGHT for dust generation, and adapts it to the midnight-js
// WalletProvider & MidnightProvider interface used by deployContract.
//
// Adapted from the Midnight example-dao CLI (Apache-2.0).

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js/types';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { type Logger } from 'pino';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import { ApiPromise, HttpProvider } from '@polkadot/api';
import { u8aToHex } from '@polkadot/util';
import { createHash } from 'node:crypto';
import { type Config } from './config.js';
import {
  checkpointSnapshot,
  clearSnapshot,
  discardCheckpoint,
  loadSnapshot,
  rollbackToCheckpoint,
  saveSnapshot,
  type WalletSnapshot,
} from './wallet-state.js';
import { toHex } from '@midnight-ntwrk/midnight-js/utils';
import { getNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { Buffer } from 'buffer';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';

// Required for GraphQL subscriptions (wallet sync) to work in Node.js
// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
  /** Node JSON-RPC URL (HTTP). Used to submit transactions without the WebSocket. */
  nodeUrl: string;
  /** Persist the current sync state to disk (best-effort). */
  persist: () => Promise<void>;
  /** Periodic persistence timer; cleared by {@link disposeWallet}. */
  persistTimer?: ReturnType<typeof setInterval>;
  /**
   * Run a fee-paying tx with snapshot protection: checkpoint before, discard on
   * success, roll back + freeze persistence on failure so a DUST coin locked by
   * a dead tx is released for the next run (no genesis re-sync needed).
   */
  withTxCheckpoint: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Short, non-reversible fingerprint of a seed for display/logging. NEVER print
 * the seed itself — a leaked seed means stolen funds (deploymain.md §Security).
 */
const seedFingerprint = (seed: string): string =>
  createHash('sha256').update(seed, 'hex').digest('hex').slice(0, 16);

/**
 * Sign all unshielded offers in a transaction's intents with the correct proof
 * marker. Works around a wallet-SDK bug where signRecipe hardcodes 'pre-proof',
 * which fails for proven (UnboundTransaction) intents that contain 'proof' data.
 */
const signTransactionIntents = (
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void => {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>(
      'signature',
      proofMarker,
      'pre-binding',
      intent.serialize(),
    );

    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
};

/** Bridge the wallet-sdk-facade to the midnight-js contract API. */
export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      // Cap every intent's TTL well inside the ledger's global limit.
      //
      // midnight-ledger rejects a tx at block-authoring time if any intent's
      // ttl > block_time + global_ttl, where global_ttl is EXACTLY 3600 s —
      // and midnight-js stamps deploy/call intents with ttlOneHour() = now+3600 s.
      // That makes validity hinge on our clock vs the (slot-quantised)
      // validator block timestamp for the first seconds after building: the
      // mempool check tolerates it (it adds a slot margin) but the author's
      // pre_dispatch fails with 182 IntentTtlTooFarInFuture and EVICTS the tx
      // from the validator pool. Result: "accepted, in RPC pools, never
      // included" — forever. 30 min gives a huge margin and is still far
      // longer than inclusion takes. Intents are unsigned at this point, so
      // adjusting the TTL before balancing/signing is legitimate.
      const ttlCap = ttl ?? new Date(Date.now() + INTENT_TTL_MS);
      try {
        // `intents` is a WASM getter/setter pair: mutate the copies, then write
        // the map back. Intents are still unbound here (midnight-js balances
        // before binding), so writing `ttl` is allowed.
        const intents: Map<number, any> | undefined = (tx as any).intents;
        if (intents) {
          let changed = 0;
          for (const [seg, intent] of intents) {
            if (intent?.ttl instanceof Date && intent.ttl.getTime() > ttlCap.getTime()) {
              intent.ttl = ttlCap;
              intents.set(seg, intent);
              changed++;
            }
          }
          if (changed) {
            (tx as any).intents = intents;
            console.log(`  ↧ Capped ${changed} intent TTL(s) to ${INTENT_TTL_MS / 60_000} min (ledger global_ttl is exactly 60 min).`);
          }
        }
      } catch (e) {
        console.log(`  ⚠  Could not cap intent TTL (${String((e as any)?.message ?? e).slice(0, 80)}); continuing with SDK default.`);
      }
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttlCap },
      );

      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }

      return ctx.wallet.finalizeRecipe(recipe);
    },
    async submitTx(tx) {
      // Set SUBMIT_VIA_WS=1 to use the wallet SDK's native path (WebSocket
      // submit-and-watch-until-Finalized) instead of HTTP submission.
      if (process.env.SUBMIT_VIA_WS === '1') {
        return ctx.wallet.submitTransaction(tx) as any;
      }
      try {
        return (await submitViaHttp(ctx, tx as any)) as any;
      } catch (e) {
        // Some RPC endpoints (e.g. the official preview node) refuse JSON-RPC
        // over HTTP POST (403/405) and only serve WebSocket. Fall back to the
        // SDK's WS submit in that case; it is the same bytes.
        if (/\[40[35]\]/.test(firstLine(e))) {
          console.log(`  ↪ HTTP RPC refused the request (${firstLine(e).slice(0, 40)}); falling back to the SDK WebSocket submit.`);
          return ctx.wallet.submitTransaction(tx) as any;
        }
        throw e;
      }
    },
  };
};

/**
 * Submit a finalized transaction over the node's HTTP JSON-RPC instead of the
 * wallet SDK's WebSocket submit-and-watch.
 *
 * Why: the SDK's node client disconnects its WebSocket after loading metadata
 * and reconnects lazily at submit time with an INFINITE reconnection timeout.
 * Over Blockfrost that reconnect can stall, so `submitTransaction` hangs
 * forever and the tx never reaches the node (observed: proof generated, then
 * zero output for 25+ min, nothing on-chain). HTTP `author_submitExtrinsic`
 * is a single request/response — no socket to drop.
 *
 * This builds the exact same unsigned extrinsic the SDK builds
 * (`midnight.sendMnTransaction(hex(tx.serialize()))`), returns the Midnight tx
 * identifier (what the SDK's submitTransaction returns), and lets midnight-js
 * wait for finalization via the indexer (`watchForTxData`) — which is also
 * what midnight-js does after the SDK path, so the WS watch was redundant.
 *
 * Bonus: a node rejection comes back synchronously with its real reason
 * (e.g. "1010: Invalid Transaction: Custom error: 170") instead of being
 * swallowed as a generic "Transaction submission error".
 */
/** The identifier of the most recent tx submitted via HTTP in this process (for diagnostics). */
export let lastSubmittedTxId: string | undefined;

// Re-broadcast state. A tx accepted into a flaky RPC node's pool may never be
// propagated to block producers (observed on Blockfrost mainnet: accepted,
// then never included). Re-sending the IDENTICAL bytes is safe — same hash, so
// it cannot deploy twice: a node that has it answers "already imported"; a node
// that dropped it re-imports and gossips it. We re-send until the caller stops
// us (finalized) or the tx TTL passes.
const REBROADCAST_EVERY_MS = Number(process.env.REBROADCAST_EVERY_MS ?? 45_000);
const REBROADCAST_MAX_MS = 30 * 60_000; // matches the 30 min tx TTL set in balanceTx
let rebroadcast: { timer: ReturnType<typeof setInterval>; api: ApiPromise } | undefined;

/** Stop re-broadcasting (call once the tx is finalized or the process is done). */
export const stopRebroadcast = async (): Promise<void> => {
  if (!rebroadcast) return;
  clearInterval(rebroadcast.timer);
  const { api } = rebroadcast;
  rebroadcast = undefined;
  await api.disconnect().catch(() => undefined);
};

// polkadot's HttpProvider appends "\nFailed HTTP Request: {…full tx hex…}" to
// every error. The hex is ~10–30 KB of random digits, so matching patterns
// like "1010" against the WHOLE message gives false positives. Classify on the
// first line only.
const firstLine = (e: unknown): string => String((e as any)?.message ?? e).split('\n')[0];
const isAlreadyImported = (e: unknown): boolean => /already imported|\b1013\b/i.test(firstLine(e));

// A node VALIDITY rejection (1010 / Invalid Transaction / Custom error: N) is
// authoritative — never retry it, surface it. Everything else that fails at the
// HTTP layer (Blockfrost resets, 5xx, timeouts, "Failed HTTP Request") is
// transport flakiness and is safe to retry with the identical bytes.
const isValidityRejection = (e: unknown): boolean => /\b1010\b|Invalid Transaction|Custom error/i.test(firstLine(e));
const isTransportFailure = (e: unknown): boolean =>
  /Failed HTTP Request|fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|Bad Gateway|Gateway Time-?out|Service Unavailable|network|\[50[0-4]\]/i.test(
    `${firstLine(e)} ${String((e as any)?.message ?? e).includes('Failed HTTP Request') ? 'Failed HTTP Request' : ''}`,
  );

const SUBMIT_MAX_ATTEMPTS = Number(process.env.SUBMIT_MAX_ATTEMPTS ?? 8);

// The polkadot RPC layer logs EVERY rpc error via console.error, including the
// benign "1013: Transaction Already Imported" our re-broadcasts get, and it
// appends the full ~20 KB tx hex each time. That drowns the useful output.
// Filter just that message; everything else still prints.
{
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const s = args.map((a) => (typeof a === 'string' ? a : String((a as any)?.message ?? a))).join(' ');
    if (/Transaction Already Imported|^Failed HTTP Request: \{"method":"author_submitExtrinsic"/m.test(s) && !/Custom error/.test(s)) return;
    origError(...args);
  };
}

/** Intent TTL applied to every tx we balance (must stay well under the ledger's 3600 s global_ttl). */
export const INTENT_TTL_MS = Number(process.env.INTENT_TTL_MINUTES ?? 30) * 60_000;

// ── Authoring-time dry run ─────────────────────────────────────────────────────
// The mempool check (validate_transaction) is deliberately light: it does NOT
// evaluate intent TTLs or block weight. Block authors run the full
// `apply_extrinsic`, and if that fails they silently drop the tx from their
// pool while RPC nodes keep it — the tx then looks "accepted" but is never
// included. `BlockBuilder_apply_extrinsic` through `state_call` is read-only
// and runs the exact authoring-time checks, so we use it as a preflight and
// as a periodic probe while waiting for finalization.
const INVALID_TX = ['Call', 'Payment', 'Future', 'Stale', 'BadProof', 'AncientBirthBlock', 'ExhaustsResources', 'Custom', 'BadMandatory', 'MandatoryValidation', 'BadSigner'];
type DryRun = { ok: true } | { ok: false; kind: 'ExhaustsResources' | 'Custom' | 'Other'; code?: number; detail: string };
const dryRunApply = async (api: ApiPromise, hex: string): Promise<DryRun> => {
  const head = await api.rpc.chain.getHeader();
  const at = await api.rpc.chain.getBlockHash(head.number.toNumber());
  const raw = await api.rpc.state.call('BlockBuilder_apply_extrinsic', hex, at);
  const u8 = raw.toU8a(true);
  if (u8[0] === 0) return u8[1] === 0 ? { ok: true } : { ok: false, kind: 'Other', detail: `dispatch error ${u8aToHex(u8.subarray(1))}` };
  if (u8[1] === 0) {
    const v = u8[2];
    if (v === 6) return { ok: false, kind: 'ExhaustsResources', detail: 'Invalid::ExhaustsResources (does not fit the block weight budget)' };
    if (v === 7) return { ok: false, kind: 'Custom', code: u8[3], detail: `Invalid::Custom(${u8[3]}) — Midnight ledger error ${u8[3]} (docs.midnight.network/nodes/error-codes)` };
    return { ok: false, kind: 'Other', detail: `Invalid::${INVALID_TX[v] ?? v}` };
  }
  return { ok: false, kind: 'Other', detail: `Unknown::${u8[2]}` };
};

const submitViaHttp = async (
  ctx: WalletContext,
  tx: { serialize: () => Uint8Array; identifiers: () => string[] },
): Promise<string> => {
  const serialized = tx.serialize();
  const identifiers = tx.identifiers();
  const txId = identifiers.at(-1);
  if (!txId) throw new Error('submitViaHttp: transaction has no identifiers');

  // Creating the API fetches chain metadata over the same (flaky) HTTP RPC, so
  // give it the same transport retries as the submit itself.
  let api: ApiPromise | undefined;
  for (let attempt = 1; attempt <= SUBMIT_MAX_ATTEMPTS && !api; attempt++) {
    try {
      api = await ApiPromise.create({ provider: new HttpProvider(ctx.nodeUrl), noInitWarn: true });
    } catch (e) {
      if (!isTransportFailure(e) || attempt === SUBMIT_MAX_ATTEMPTS) throw e;
      const waitMs = Math.min(8_000 * attempt, 30_000);
      console.log(`  ⚠  RPC metadata fetch failed (attempt ${attempt}/${SUBMIT_MAX_ATTEMPTS}) — Blockfrost flaking; retrying in ${waitMs / 1000}s…`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  if (!api) throw new Error('submitViaHttp: could not connect to the node RPC');
  const client: ApiPromise = api;
  const hex = u8aToHex(serialized);
  const send = () => (client.tx as any).midnight.sendMnTransaction(hex).send();
  // The extrinsic hash is deterministic from the bytes, so we know it before
  // sending — useful for logging even if the first send attempt fails.
  const extrinsic = (client.tx as any).midnight.sendMnTransaction(hex);
  const hashHex: string = extrinsic.hash.toHex();
  // Full SCALE-encoded extrinsic (envelope + call), which is what
  // BlockBuilder_apply_extrinsic expects — NOT the raw ledger tx bytes.
  const extrinsicHex: string = extrinsic.toHex();

  // Preflight: run the authoring-time checks BEFORE submitting. A ledger error
  // here is deterministic — submitting would only park the tx in RPC pools
  // while every block author drops it. ExhaustsResources is advisory only
  // (the dry run inherits the previous block's consumed weight, so it can be
  // a false positive); we warn and still submit.
  if (process.env.SKIP_DRY_RUN !== '1') {
    try {
      const dr = await dryRunApply(client, extrinsicHex);
      if (dr.ok) console.log('  ✓ Dry run (authoring-time apply_extrinsic): OK — tx is includable right now.');
      else if (dr.kind === 'ExhaustsResources') console.log(`  ⚠  Dry run: ${dr.detail}. May be an artefact of the previous block's weight; submitting anyway.`);
      else if (dr.kind === 'Custom' && dr.code === 170) {
        // Expected for a just-built tx: the dry run applies against the LAST
        // block's timestamp, and the DUST spend's declared time (now) is later
        // than that. Real authors use the new block's timestamp. The mempool
        // (which simulates the next block time) is the authoritative check.
        console.log('  ⚠  Dry run: 170 (DUST time window vs last block timestamp) — expected for a fresh tx; submitting.');
      } else {
        await client.disconnect().catch(() => undefined);
        throw new Error(`Dry run rejected the transaction before submission: ${dr.detail}. Not submitting (authors would drop it).`);
      }
    } catch (e) {
      if (String((e as any)?.message ?? e).startsWith('Dry run rejected')) throw e;
      console.log(`  ⚠  Dry run unavailable (${String((e as any)?.message ?? e).split('\n')[0].slice(0, 100)}); submitting anyway.`);
    }
  }

  // Submit with retries on TRANSPORT failures only. With HttpProvider there are
  // no subscriptions: `.send()` performs author_submitExtrinsic. Re-sending the
  // identical bytes is idempotent (same hash): "already imported" means a prior
  // attempt actually got through despite the failed HTTP response.
  let submitted = false;
  for (let attempt = 1; attempt <= SUBMIT_MAX_ATTEMPTS && !submitted; attempt++) {
    try {
      await send();
      submitted = true;
    } catch (e) {
      if (isAlreadyImported(e)) {
        console.log(`  ✓ Node already has the transaction (an earlier attempt got through).`);
        submitted = true;
        break;
      }
      if (isValidityRejection(e) || !isTransportFailure(e) || attempt === SUBMIT_MAX_ATTEMPTS) {
        await client.disconnect().catch(() => undefined);
        throw e;
      }
      const waitMs = Math.min(8_000 * attempt, 30_000);
      console.log(
        `  ⚠  Submit attempt ${attempt}/${SUBMIT_MAX_ATTEMPTS} failed at the HTTP layer ` +
          `(${String((e as any)?.message ?? e).slice(0, 80)}) — Blockfrost flaking; retrying in ${waitMs / 1000}s…`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  // Log the FULL identifiers: they are what you need to look the tx up on the
  // indexer if the finalization watch times out.
  getLogger()?.info(`Submitted via HTTP RPC: extrinsic=${hashHex} txId=${txId}`);
  console.log(
    `  ✓ Submitted (HTTP RPC) — node accepted the transaction.\n` +
      `     extrinsic: ${hashHex}\n` +
      `     txId     : ${txId}\n` +
      `     Waiting for finalization via indexer (re-broadcasting every ${REBROADCAST_EVERY_MS / 1000}s until then)…`,
  );
  lastSubmittedTxId = txId;

  // Keep the API alive and re-broadcast the same bytes until stopped.
  await stopRebroadcast();
  const startedAt = Date.now();
  let ticks = 0;
  const timer = setInterval(() => {
    if (Date.now() - startedAt > REBROADCAST_MAX_MS) {
      void stopRebroadcast();
      return;
    }
    // Every ~3 min, re-run the authoring-time dry run so we can SEE whether
    // the parked tx is still includable or why authors are skipping it.
    if (++ticks % 4 === 0 && process.env.SKIP_DRY_RUN !== '1') {
      dryRunApply(client, extrinsicHex).then(
        (dr) => console.log(`\n  ⟳ dry run @${Math.round((Date.now() - startedAt) / 60_000)}min: ${dr.ok ? 'OK (includable)' : dr.detail}`),
        () => undefined,
      );
    }
    send().then(
      () => getLogger()?.info(`Re-broadcast ${hashHex} accepted (node had dropped it)`),
      (e: unknown) => {
        if (isAlreadyImported(e)) return; // node already has it — the desired steady state
        const msg = firstLine(e);
        getLogger()?.warn(`Re-broadcast ${hashHex} failed: ${msg}`);
        if (isValidityRejection(e)) {
          console.log(`\n  ⚠  Re-broadcast rejected as invalid (${msg.slice(0, 120)}) — the tx likely expired or conflicts; stopping re-broadcast.`);
          void stopRebroadcast();
        } else {
          // transport blip (Blockfrost reset etc.) — keep re-broadcasting
          console.log(`\n  ⚠  Re-broadcast attempt failed at the HTTP layer (${msg.slice(0, 60)}); will retry.`);
        }
      },
    );
  }, REBROADCAST_EVERY_MS);
  if (typeof timer.unref === 'function') timer.unref();
  rebroadcast = { timer, api: client };

  return txId;
};

// Best-effort, shape-agnostic description of per-sub-wallet sync progress so a
// long mainnet sync is visibly *advancing* rather than silently stalled (the
// runbook says a stall is only a problem with no advancement for ~10+ min).
// Compact, bounded dump of an object's primitive fields (bigint-safe) so we can
// see the real syncProgress shape the SDK exposes instead of guessing.
const shapeOf = (o: any, depth = 0): string => {
  if (o === null || o === undefined) return String(o);
  if (typeof o === 'bigint') return `${o}n`;
  if (typeof o !== 'object') return JSON.stringify(o);
  if (depth >= 2) return '{…}';
  const entries = Object.entries(o).slice(0, 8).map(([k, v]) => `${k}:${shapeOf(v, depth + 1)}`);
  return `{${entries.join(',')}}`;
};

// Real wallet-sdk syncProgress shape (observed on mainnet, wallet-sdk 3.x/4.x):
//   shielded/dust: { appliedIndex, highestIndex, highestRelevantIndex,
//                    highestRelevantWalletIndex, isConnected, isStrictlyComplete, isCompleteWithin }
//   unshielded:    { appliedId, highestTransactionId, isConnected, isStrictlyComplete, isCompleteWithin }
// "applied" = what the wallet has processed; "highest" = the indexer's tip.
// `isConnected:false` means the wallet cannot reach the indexer/node at all
// (e.g. a rejected Blockfrost token) — nothing will ever advance in that state.
interface SubProgress {
  connected: boolean;
  applied?: bigint;
  highest?: bigint;
  strict: boolean;
}

const toBig = (v: unknown): bigint | undefined =>
  v === undefined || v === null ? undefined : BigInt(v as any);

const progressOf = (sub: any): SubProgress | undefined => {
  const sp = sub?.syncProgress ?? sub?.progress;
  if (!sp) return undefined;
  return {
    connected: sp.isConnected === true,
    applied: toBig(sp.appliedIndex ?? sp.appliedId),
    highest: toBig(sp.highestIndex ?? sp.highestTransactionId),
    strict: sp.isStrictlyComplete === true,
  };
};

let shapeLogged = false;

const describeSyncProgress = (s: any): string => {
  const parts: string[] = [];
  let anySignal = false;
  for (const name of ['shielded', 'unshielded', 'dust'] as const) {
    const p = progressOf(s?.[name]);
    if (!p) continue;
    anySignal = true;
    // Always surface the applied counter: over Blockfrost the indexer never
    // reports a tip (highest stays 0), so `applied` ticking up is the only
    // visible evidence that sync is advancing rather than stalled.
    const applied = p.applied !== undefined ? `applied=${p.applied}` : 'applied=?';
    const label = !p.connected
      ? `DISCONNECTED ${applied}`
      : p.strict
        ? `synced ${applied}`
        : p.highest !== undefined && p.highest > 0n
          ? `${p.applied ?? '?'}/${p.highest}`
          : applied;
    parts.push(`${name}=${label}`);
  }
  // One-time raw dump if the known fields produced nothing (shape drift guard).
  if (!shapeLogged && !anySignal) {
    shapeLogged = true;
    const raw = (['shielded', 'unshielded', 'dust'] as const)
      .map((n) => `${n}.syncProgress=${shapeOf(s?.[n]?.syncProgress ?? s?.[n]?.progress)}`)
      .join('  ');
    process.stdout.write(`\n    [sync-shape] ${raw}\n`);
  }
  return parts.length ? parts.join('  ') : `isSynced=${String(s?.isSynced)}`;
};

export const waitForSync = (wallet: WalletFacade) => {
  let lastLog = 0;
  let disconnectedSince: number | undefined;
  let warnedDisconnected = false;
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.tap((state: any) => {
        const now = Date.now();
        if (!state.isSynced && now - lastLog >= 15_000) {
          lastLog = now;
          process.stdout.write(`\n    sync progress: ${describeSyncProgress(state)}\n`);
        }
        // If every sub-wallet that reports progress says it is NOT connected,
        // the wallet cannot reach the indexer/node (typically a rejected
        // Blockfrost token, or Blockfrost rate-limiting/outage). The spinner
        // would otherwise run forever — say so loudly after 60s.
        const probes = (['shielded', 'unshielded', 'dust'] as const)
          .map((n) => progressOf(state?.[n]))
          .filter((p): p is SubProgress => p !== undefined);
        const allDisconnected = probes.length > 0 && probes.every((p) => !p.connected);
        if (!allDisconnected) {
          disconnectedSince = undefined;
          warnedDisconnected = false;
          return;
        }
        disconnectedSince ??= now;
        if (!warnedDisconnected && now - disconnectedSince >= 60_000) {
          warnedDisconnected = true;
          process.stdout.write(
            `\n  ⚠  Wallet has been DISCONNECTED from the indexer/node for 60s — sync cannot advance.\n` +
              `     Likely causes: a rejected Blockfrost token (403 "Network token mismatch"), or Blockfrost\n` +
              `     rate-limiting/outage. Check: MIDNIGHT_BLOCKFROST_PROJECT_ID in .env is a Midnight MAINNET\n` +
              `     token, and run the health check in deploymain.md §1 (both endpoints must return 200).\n`,
          );
        }
      }),
      Rx.filter((state) => state.isSynced),
    ),
  );
};

// `isSynced` can be true while a sub-wallet's view still lags the node tip
// (indexer behind over Blockfrost). A DUST fee proof built in that window is
// rejected by the node (InvalidDustSpendProof / status Invalid). This waits
// until every sub-wallet that exposes syncProgress reports synced with zero
// apply/source lag — i.e. genuinely caught up — before we build a transaction.
// Falls back to plain isSynced after `timeoutMs` so a quirky state shape can't
// hang a deploy forever.
const subWalletAtTip = (sub: any): boolean => {
  const p = progressOf(sub);
  if (!p) return true; // no progress info exposed → nothing to wait on
  if (!p.connected) return false; // can't be at tip if we can't reach the indexer
  if (p.strict) return true; // SDK says strictly complete
  // Over Blockfrost the indexer does not populate highestIndex (observed: stays
  // 0n while connected), so there is nothing to measure against — fall back to
  // isSynced (checked by the caller) instead of stalling until the timeout.
  if (p.highest === undefined || p.highest === 0n) return true;
  // Applied events have caught up to the indexer's tip (small tolerance: a live
  // indexer naturally trails by an event or two).
  const TOLERANCE = 2n;
  return (p.applied ?? 0n) + TOLERANCE >= p.highest;
};

export const waitForTip = async (wallet: WalletFacade, timeoutMs = 3 * 60_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastLog = 0;
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(3_000),
      Rx.tap((s: any) => {
        const now = Date.now();
        if (now - lastLog >= 15_000) {
          lastLog = now;
          process.stdout.write(`\n    tip check: ${describeSyncProgress(s)}\n`);
        }
      }),
      Rx.filter((s: any) => {
        // Blockfrost's indexer backs off progress updates on idle subscriptions,
        // so `isSynced` (unshielded) can lag ~5 min after a tx even though the
        // wallet is effectively current. The deadline must therefore apply
        // regardless of isSynced — never block on that flag alone.
        if (Date.now() >= deadline) return true;
        if (!s.isSynced) return false;
        return subWalletAtTip(s.shielded) && subWalletAtTip(s.unshielded) && subWalletAtTip(s.dust);
      }),
    ),
  );
};

// Wait until at least one DUST coin is *available* (not pending). With a single
// DUST coin, any in-flight or failed submission marks it pending and a new tx
// cannot be balanced ("Insufficient Funds: could not balance dust") until the
// wallet releases it. Resolves `true` when a coin is available, `false` on
// timeout (caller decides how to report it).
// Per the Blockfrost migration runbook: wait for the thing you need (an
// available DUST coin), NOT for `isSynced` — on Blockfrost the unshielded
// sub-wallet's synced flag can stay false ~5 min after a tx while the DUST
// change coin is already visible. The 6 min default covers that backoff.
export const waitForSpendableDust = async (wallet: WalletFacade, timeoutMs = 6 * 60_000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  let lastLog = 0;
  const state: any = await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(3_000),
      Rx.tap((s: any) => {
        const now = Date.now();
        if (s.dust.availableCoins.length === 0 && now - lastLog >= 15_000) {
          lastLog = now;
          process.stdout.write(
            `\n    waiting for DUST coin release: available=${s.dust.availableCoins.length} pending=${s.dust.pendingCoins.length}\n`,
          );
        }
      }),
      Rx.filter((s: any) => s.dust.availableCoins.length > 0 || Date.now() >= deadline),
    ),
  );
  return state.dust.availableCoins.length > 0;
};

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

// Genesis sync applies indexer events in batches; the SDK default is 10, which
// crawls on a mature chain (mainnet is ~3M blocks). Raise it — override with
// SYNC_BATCH_SIZE if needed. (Same tuning the votechain CLI uses.)
const SYNC_BATCH_SIZE = Number(process.env.SYNC_BATCH_SIZE ?? 1000);

const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  batchSize: SYNC_BATCH_SIZE,
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet from seed');
  }
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys');
  }
  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

const formatBalance = (balance: bigint): string => balance.toLocaleString();

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
};

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }

  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    // On mainnet there is no NIGHT to register (DUST comes from cNIGHT), so
    // "0 DUST coins" here almost always means the local snapshot is wrong —
    // typically a previous stalled/failed submission marked the only coin as
    // spent and that state was persisted. Waiting won't fix that; a bounded
    // wait then hands off to the DUST preflight, which prints the remedy
    // (WALLET_STATE_RESET=1). Preview keeps waiting: DUST genuinely generates
    // there after the faucet.
    const isMainnet = getNetworkId() === 'mainnet';
    const deadline = Date.now() + (isMainnet ? 90_000 : Number.MAX_SAFE_INTEGER);
    await withStatus('Waiting for dust tokens to generate', () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n || Date.now() >= deadline),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });

  await withStatus('Waiting for dust tokens to generate', () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    ),
  );
};

const printWalletSummary = (seed: string, state: any, unshieldedKeystore: UnshieldedKeystore) => {
  const networkId = getNetworkId();
  const nightLabel = networkId === 'mainnet' ? 'Night' : 'tNight';
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

  // Address encoding is display-only — guard it so an SDK version mismatch in
  // the bech32m helpers (address-format vs the wallet SDK's address objects)
  // can never crash the deploy flow. Same guard the votechain CLI uses.
  const safeEncode = (fn: () => string): string => {
    try {
      return fn();
    } catch {
      return '(unavailable — display only)';
    }
  };

  const shieldedAddress = safeEncode(() => {
    const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
    const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
    return MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();
  });
  const dustAddress = safeEncode(() => MidnightBech32m.encode(networkId, state.dust.address).toString());

  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}
  Seed fingerprint: ${seedFingerprint(seed)}  (seed itself is never shown)
${DIV}

  Shielded (ZSwap)
  └─ Address: ${shieldedAddress}

  Unshielded
  ├─ Address: ${unshieldedKeystore.getBech32Address()}
  └─ Balance: ${formatBalance(unshieldedBalance)} ${nightLabel}

  Dust
  └─ Address: ${dustAddress}

${DIV}`);
};

/**
 * Build the WalletFacade. When `snapshot` is provided each sub-wallet is
 * RESTORED from the persisted sync state (resume) instead of started fresh.
 */
const initWalletFacade = async (
  config: Config,
  shieldedSecretKeys: ledger.ZswapSecretKeys,
  dustSecretKey: ledger.DustSecretKey,
  unshieldedKeystore: UnshieldedKeystore,
  snapshot: WalletSnapshot | undefined,
): Promise<WalletFacade> => {
  const walletConfig = {
    ...buildShieldedConfig(config),
    ...buildUnshieldedConfig(config),
    ...buildDustConfig(config),
  };
  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (cfg) =>
      snapshot ? ShieldedWallet(cfg).restore(snapshot.shielded) : ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg) =>
      snapshot
        ? UnshieldedWallet(cfg).restore(snapshot.unshielded)
        : UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg) =>
      snapshot
        ? DustWallet(cfg).restore(snapshot.dust)
        : DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  return wallet;
};

export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  console.log('');

  const network = getNetworkId();
  const isMainnet = network === 'mainnet';
  let snapshot = loadSnapshot(network, seed);

  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await withStatus(
    snapshot ? 'Restoring wallet from saved sync state' : 'Building wallet',
    async () => {
      const keys = deriveKeysFromSeed(seed);
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

      let wallet: WalletFacade;
      try {
        wallet = await initWalletFacade(config, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, snapshot);
      } catch (e) {
        // A stale/corrupt snapshot can break restore — clear it and re-sync fresh.
        if (snapshot) {
          clearSnapshot(network, seed);
          snapshot = undefined;
          wallet = await initWalletFacade(config, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, undefined);
        } else {
          throw e;
        }
      }

      return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
    },
  );

  // Persist sync state so retries resume instead of re-syncing from genesis.
  // `frozen` is set after a tx failure + rollback: the in-memory wallet still
  // holds the DUST coin as pending for the dead tx, and persisting that again
  // would re-poison the snapshot we just restored.
  let frozen = false;
  const persist = async (): Promise<void> => {
    if (frozen) return;
    try {
      const [shielded, unshielded, dust] = await Promise.all([
        wallet.shielded.serializeState(),
        wallet.unshielded.serializeState(),
        wallet.dust.serializeState(),
      ]);
      saveSnapshot(network, seed, { shielded, unshielded, dust });
    } catch {
      /* best-effort — a failed snapshot must never abort a deploy */
    }
  };

  // Run a fee-paying tx with snapshot protection: persist + checkpoint before,
  // discard the checkpoint on success, roll back (and freeze persistence) on
  // failure so the spent-locally-but-not-on-chain DUST coin is released for the
  // next run without a genesis re-sync.
  const withTxCheckpoint = async <T>(fn: () => Promise<T>): Promise<T> => {
    await persist();
    const had = checkpointSnapshot(network, seed);
    try {
      const result = await fn();
      await persist();
      discardCheckpoint(network, seed);
      return result;
    } catch (e) {
      frozen = true;
      if (had && rollbackToCheckpoint(network, seed)) {
        console.log('  ↩  Rolled the wallet snapshot back to its pre-transaction state (DUST coin released for the next run).');
      }
      throw e;
    }
  };
  const persistTimer = setInterval(() => void persist(), 30_000);
  if (typeof persistTimer.unref === 'function') persistTimer.unref();

  const DIV = '──────────────────────────────────────────────────────────────';
  if (isMainnet) {
    // Mainnet has NO faucet. DUST is generated by registered NIGHT / cNIGHT.
    console.log(`
${DIV}
  Wallet Overview                            Network: ${network}
${DIV}
  Seed fingerprint: ${seedFingerprint(seed)}  (seed itself is never shown)

  Unshielded (NIGHT) address:
  ${unshieldedKeystore.getBech32Address()}

  Fees are paid in DUST (no faucet on mainnet). Ensure this wallet has
  spendable DUST from registered NIGHT or mapped Cardano cNIGHT before deploying.
${DIV}
`);
  } else {
    console.log(`
${DIV}
  Wallet Overview                            Network: ${network}
${DIV}
  Seed fingerprint: ${seedFingerprint(seed)}  (seed itself is never shown)

  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address()}

  Fund your wallet with tNight from the faucet:
  https://faucet.${network}.midnight.network/
${DIV}
`);
  }

  const syncedState = await withStatus('Syncing with network', () => waitForSync(wallet));
  await persist();
  printWalletSummary(seed, syncedState, unshieldedKeystore);

  // On mainnet a wallet can show NIGHT 0 and still have spendable DUST (e.g. when
  // DUST comes from cNIGHT), so do NOT block on an incoming NIGHT balance there.
  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n && !isMainnet) {
    const fundedBalance = await withStatus('Waiting for incoming tokens', () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);
  await persist();

  // DUST preflight (deploymain.md §1): fees are paid in DUST and only *spendable*
  // (ready, not "maturing") DUST counts. Surface it so an invalid-transaction
  // rejection is never a mystery, and on mainnet refuse to spend a proof on a
  // deploy that cannot pay for itself.
  const dust = await getDustBalance(wallet);
  console.log(
    `  DUST: spendable ${formatBalance(dust.available)} (${dust.availableCoins} coin(s))` +
      `, maturing ${formatBalance(dust.pending)} (${dust.pendingCoins} coin(s))\n`,
  );
  if (isMainnet && dust.available === 0n) {
    // We throw before the context is returned, so the caller's disposeWallet
    // never runs — shut the wallet down here or open subscriptions keep the
    // process alive.
    clearInterval(persistTimer);
    await wallet.stop().catch(() => undefined);
    throw new Error(
      'No spendable DUST in this wallet. Mainnet fees are paid in DUST (no faucet). ' +
        (dust.pendingCoins > 0
          ? `You have ${dust.pendingCoins} DUST coin(s) that are pending, not available. This is usually a ` +
            'coin LOCKED by a previous in-flight/failed submission (common with a single DUST coin), ' +
            'carried over in the saved sync snapshot. Re-run with WALLET_STATE_RESET=1 to re-sync from ' +
            'on-chain truth and release it; or wait for the tx TTL (~30 min) to expire.'
          : 'This wallet shows 0 DUST coins. MOST LIKELY: the saved sync snapshot is stale — a previous ' +
            'stalled/failed submission marked your DUST coin as spent locally even though nothing landed ' +
            'on-chain. Fix: re-run with WALLET_STATE_RESET=1 (re-syncs from on-chain truth; fast with ' +
            'SYNC_BATCH_SIZE=1000). To confirm nothing landed: node scripts/scan_deploys.mjs <token> <time>. ' +
            'ONLY if a clean re-sync still shows 0 DUST: check you have EXACTLY ONE live cNIGHT→DUST ' +
            'registration (node scripts/cnight_dust_diag.mjs addr1q…), then wait for DUST to accrue.'),
    );
  }

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore, nodeUrl: config.node, persist, persistTimer, withTxCheckpoint };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> =>
  await buildWalletAndWaitForFunds(config, toHex(Buffer.from(generateRandomSeed())));

/** Persist final state, stop the periodic timer, and shut the wallet down. */
export const disposeWallet = async (ctx: WalletContext): Promise<void> => {
  if (ctx.persistTimer) clearInterval(ctx.persistTimer);
  try {
    await ctx.persist();
  } catch {
    /* ignore */
  }
  try {
    await ctx.wallet.stop();
  } catch {
    /* ignore */
  }
};

export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint; availableCoins: number; pendingCoins: number }> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.balance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  const pending = state.dust.pendingCoins.reduce((sum, c) => sum + c.initialValue, 0n);
  return { available, pending, availableCoins, pendingCoins };
};

let _logger: Logger | undefined;
export function setLogger(logger: Logger) {
  _logger = logger;
}
export function getLogger(): Logger | undefined {
  return _logger;
}
