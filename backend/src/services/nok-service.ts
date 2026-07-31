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
} from '@k33p/nok-cli/dist/nok-api.js';
import { ownerIdentifierToField, nokHashToField } from '@k33p/nok-cli/dist/hash.js';
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

export interface NokResult {
  userId: string;
  ownerIdentifier: string;
  registered?: boolean;
  approved?: boolean;
}

/** Register a next-of-kin record for a K33P user. Admin write op. */
export async function registerNokForUser(userId: string, nokIdentifier: string): Promise<NokResult> {
  const { deployed } = await getContext();
  const ownerField = ownerIdentifierToField(userId);
  const nokField = nokHashToField(nokIdentifier);
  await registerNok(deployed, ownerField, nokField, nokLogger);
  return { userId, ownerIdentifier: ownerField.toString(), registered: true };
}

/** Approve a NOK-initiated login for a K33P user. Admin write op. */
export async function approveNokLoginForUser(userId: string, nokIdentifier: string): Promise<NokResult> {
  const { deployed } = await getContext();
  const ownerField = ownerIdentifierToField(userId);
  const nokField = nokHashToField(nokIdentifier);
  const approved = await approveNokLogin(deployed, ownerField, nokField, nokLogger);
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
  };
}
