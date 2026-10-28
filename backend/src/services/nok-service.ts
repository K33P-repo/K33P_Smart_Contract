// SPDX-License-Identifier: Apache-2.0
//
// NOK (Next-Of-Kin) admin service for the K33P backend.
//
// The K33P backend is the *admin* of the deployed Midnight NOK contract: it
// holds the admin secret + funding wallet seed and submits register / approve
// transactions on a user's behalf. This module is a thin, server-friendly
// wrapper around the tested contract API that lives in the NOK CLI package
// (`@k33p/nok-cli`). We import that package's COMPILED build output so the
// K33P_Smart_Contract/Contract folder stays reference-only.
//
// Prerequisites (see backend/NOK_INTEGRATION.md):
//   1. Build the contract + CLI once:  (from Contract/)  npm install && npm run build:all && npm run build -w @k33p/nok-cli
//   2. A reachable proof server (PROOF_SERVER_URL, default http://127.0.0.1:6300)
//   3. A funded wallet seed (NOK_WALLET_SEED) for write circuits.
//
// Environment variables:
//   NOK_NETWORK          preview | preprod | standalone   (default: preview)
//   NOK_CONTRACT_ADDRESS the deployed contract address     (required)
//   NOK_ADMIN_SECRET     64-hex admin secret               (required)
//   NOK_WALLET_SEED      hex funding wallet seed           (required for writes)
//   PROOF_SERVER_URL     proof server URL                  (default 127.0.0.1:6300)

import { logger } from '../utils/logger.js';

// NOTE: deep imports into the CLI's compiled `dist/`. The CLI package has no
// `exports` map, so these subpaths resolve directly to its build output. Run
// `npm run build -w @k33p/nok-cli` in Contract/ to generate them.
import {
  configureNokProviders,
  joinNok,
  registerNok,
  approveNokLogin,
  isNokRegistered,
  getNokLedgerState,
  registerIdentity,
  verifyLogin,
  isIdentityRegistered,
} from '@k33p/nok-cli/dist/nok-api.js';
import {
  ownerIdentifierToField,
  nokHashToField,
  userIdentifierToField,
  credentialCommitmentToField,
} from '@k33p/nok-cli/dist/hash.js';
import { loadConfig } from '@k33p/nok-cli/dist/config.js';
import { buildWalletAndWaitForFunds } from '@k33p/nok-cli/dist/wallet.js';

// The CLI functions expect a pino-style logger. Adapt the backend's winston
// logger to that shape so we get NOK logs in the normal backend log stream.
const nokLogger: any = {
  info: (msg: unknown, ...rest: unknown[]) => logger.info(`[NOK] ${String(msg)}`, ...rest),
  warn: (msg: unknown, ...rest: unknown[]) => logger.warn(`[NOK] ${String(msg)}`, ...rest),
  error: (msg: unknown, ...rest: unknown[]) => logger.error(`[NOK] ${String(msg)}`, ...rest),
  debug: (msg: unknown, ...rest: unknown[]) => logger.debug?.(`[NOK] ${String(msg)}`, ...rest),
  trace: () => {},
  fatal: (msg: unknown, ...rest: unknown[]) => logger.error(`[NOK] ${String(msg)}`, ...rest),
  child: () => nokLogger,
};

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`NOK: missing required env var ${name}`);
  return v;
}

// Lazily-built, cached singletons. The wallet sync + join is expensive, so we
// do it once on first use and reuse the joined contract for all operations.
let initPromise: Promise<{ providers: any; deployed: any; contractAddress: string }> | null = null;

async function getContext() {
  if (!initPromise) {
    initPromise = (async () => {
      const contractAddress = requireEnv('NOK_CONTRACT_ADDRESS');
      const adminSecretHex = requireEnv('NOK_ADMIN_SECRET');
      const walletSeed = requireEnv('NOK_WALLET_SEED');
      const adminSecret = new Uint8Array(Buffer.from(adminSecretHex, 'hex'));
      if (adminSecret.length !== 32) {
        throw new Error('NOK_ADMIN_SECRET must be 32 bytes (64 hex chars)');
      }

      const config = loadConfig();
      logger.info(`[NOK] Bootstrapping admin wallet on ${config.network}...`);
      const walletContext = await buildWalletAndWaitForFunds(config, walletSeed);
      const providers = await configureNokProviders(walletContext, config, nokLogger);
      const deployed = await joinNok(providers, contractAddress, adminSecret, nokLogger);
      logger.info(`[NOK] Joined contract ${contractAddress.slice(0, 16)}...`);
      return { providers, deployed, contractAddress };
    })().catch((err) => {
      // Reset so a later request can retry after fixing config/infra.
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

// ─── Write queue ──────────────────────────────────────────────────────────────
//
// Every write circuit is a fee-paying transaction from ONE operator wallet. On
// mainnet that wallet typically holds a single DUST coin, and the wallet SDK
// marks it `pending` from balancing until the tx is finalized (1–5 min). Two
// concurrent writes therefore cannot both be balanced: the second fails with
// "could not balance dust". All writes are serialized through this queue so
// they run strictly one at a time, in arrival order. A failed write does not
// block the ones behind it.

let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.catch((err) => {
    logger.error(`[NOK] write "${label}" failed: ${err instanceof Error ? err.message : String(err)}`);
  });
  return run;
}

export interface NokResult {
  userId: string;
  ownerIdentifier: string;
  registered?: boolean;
  approved?: boolean;
}

/** Register a next-of-kin record for a K33P user. Admin write op. */
export async function registerNokForUser(userId: string, nokIdentifier: string): Promise<NokResult> {
  const ownerField = ownerIdentifierToField(userId);
  const nokField = nokHashToField(nokIdentifier);
  await enqueueWrite(`register_nok:${userId}`, async () => {
    const { deployed } = await getContext();
    await registerNok(deployed, ownerField, nokField, nokLogger);
  });
  return { userId, ownerIdentifier: ownerField.toString(), registered: true };
}

/** Approve a NOK-initiated login for a K33P user. Admin write op. */
export async function approveNokLoginForUser(userId: string, nokIdentifier: string): Promise<NokResult> {
  const ownerField = ownerIdentifierToField(userId);
  const nokField = nokHashToField(nokIdentifier);
  const approved = await enqueueWrite(`approve_nok_login:${userId}`, async () => {
    const { deployed } = await getContext();
    return approveNokLogin(deployed, ownerField, nokField, nokLogger);
  });
  return { userId, ownerIdentifier: ownerField.toString(), approved };
}

/** Read-only: is a NOK registered for this K33P user? */
export async function checkNokRegisteredForUser(userId: string): Promise<NokResult> {
  const { providers, contractAddress } = await getContext();
  const ownerField = ownerIdentifierToField(userId);
  const registered = await isNokRegistered(providers, contractAddress, ownerField, nokLogger);
  return { userId, ownerIdentifier: ownerField.toString(), registered };
}

/** Read-only: contract ledger state (admin pubkey, round, record count). */
export async function getNokContractState() {
  const { providers, contractAddress } = await getContext();
  const state = await getNokLedgerState(providers, contractAddress, nokLogger);
  if (!state) return null;
  return {
    contractAddress,
    adminPubKey: Buffer.from(state.admin).toString('hex'),
    round: state.round.toString(),
    registeredCount: state.registeredCount.toString(),
    registeredIdentityCount: state.registeredIdentityCount.toString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Identity registry (K33P authentication) — real server-side ZK
// ═══════════════════════════════════════════════════════════════════════════
//
// These wrap the identity circuits on the SAME deployed contract as NOK. The
// commitment is a string produced by the backend from the user's credential
// hashes; both register and verify derive the identical Field from it (the
// HMAC salt comes from NOK_HASH_SALT / NOK_ADMIN_SECRET via the hash helper),
// so a login proof succeeds iff the presented credentials match what was
// committed at signup.

export interface IdentityResult {
  userId: string;
  userField: string;
  registered?: boolean;
  verified?: boolean;
}

/** Register a user's credential commitment on-chain at signup. Admin write op. */
export async function registerIdentityForUser(userId: string, commitment: string): Promise<IdentityResult> {
  const userField = userIdentifierToField(userId);
  const commitmentField = credentialCommitmentToField(commitment);
  await enqueueWrite(`register_identity:${userId}`, async () => {
    const { deployed } = await getContext();
    await registerIdentity(deployed, userField, commitmentField, nokLogger);
  });
  return { userId, userField: userField.toString(), registered: true };
}

export type IdentityRegistrationState = 'pending' | 'registered' | 'failed';

export interface IdentityRegistrationStatus {
  userId: string;
  state: IdentityRegistrationState;
  queuedAt: string;
  completedAt?: string;
  error?: string;
}

// In-memory status of background registrations. Lost on restart — the
// authoritative answer is always `checkIdentityRegisteredForUser` (on-chain).
const identityRegistrations = new Map<string, IdentityRegistrationStatus>();

/**
 * Queue a user's identity registration WITHOUT waiting for the on-chain
 * transaction. Returns immediately so request handlers (signup) can respond
 * while the proof + mainnet inclusion (1–5 min) happen in the background.
 * Use `getIdentityRegistrationStatus` / `checkIdentityRegisteredForUser` to
 * find out when it has landed.
 */
export function enqueueIdentityRegistration(userId: string, commitment: string): IdentityRegistrationStatus {
  const status: IdentityRegistrationStatus = { userId, state: 'pending', queuedAt: new Date().toISOString() };
  identityRegistrations.set(userId, status);
  logger.info(`[NOK] Queued identity registration for ${userId}`);
  registerIdentityForUser(userId, commitment).then(
    () => {
      status.state = 'registered';
      status.completedAt = new Date().toISOString();
      logger.info(`[NOK] Identity registered on Midnight for ${userId}`);
    },
    (err) => {
      status.state = 'failed';
      status.completedAt = new Date().toISOString();
      status.error = err instanceof Error ? err.message : String(err);
      logger.error(`[NOK] Background identity registration failed for ${userId}: ${status.error}`);
    },
  );
  return status;
}

/** Status of a background registration queued in this process, if any. */
export function getIdentityRegistrationStatus(userId: string): IdentityRegistrationStatus | undefined {
  return identityRegistrations.get(userId);
}

/** Verify a login by producing a real ZK proof that the commitment matches. */
export async function verifyLoginForUser(userId: string, commitment: string): Promise<IdentityResult> {
  const userField = userIdentifierToField(userId);
  const commitmentField = credentialCommitmentToField(commitment);
  const verified = await enqueueWrite(`verify_login:${userId}`, async () => {
    const { deployed } = await getContext();
    return verifyLogin(deployed, userField, commitmentField, nokLogger);
  });
  return { userId, userField: userField.toString(), verified };
}

/** Read-only: is a K33P identity registered on-chain for this user? */
export async function checkIdentityRegisteredForUser(userId: string): Promise<IdentityResult> {
  const { providers, contractAddress } = await getContext();
  const userField = userIdentifierToField(userId);
  const registered = await isIdentityRegistered(providers, contractAddress, userField, nokLogger);
  return { userId, userField: userField.toString(), registered };
}
