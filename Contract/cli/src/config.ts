// SPDX-License-Identifier: Apache-2.0
//
// ─── SINGLE SHARED NETWORK CONFIG (Issue 4) ──────────────────────────────────
//
// Both deploy.ts and admin.ts import their endpoints from here. The deprecated
// `testnet-02` endpoints are gone. The DEFAULT target is PreProd — the current
// supported Midnight test network — matching the compatibility matrix:
//   https://docs.midnight.network/relnotes/support-matrix
//
// To retarget the whole toolchain (deploy + admin) to a different network, set
// MIDNIGHT_NETWORK (preferred, per the mainnet runbook) or the legacy NOK_NETWORK
// env var. Never copy endpoints into individual scripts again.
//
// MAINNET uses Blockfrost for the indexer + node RPC (the official mainnet
// indexer/RPC are shut down). See ../deploymain.md. Every mainnet endpoint is
// authenticated with a per-network Blockfrost token appended as
// `?project_id=<token>` and read from MIDNIGHT_BLOCKFROST_PROJECT_ID.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js/network-id';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Where the compiled ZK assets (prover/verifier keys, zkir) live. */
export const nokContractConfig = {
  privateStateStoreName: 'nok-private-state',
  zkConfigPath: path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'nok'),
};

export interface Config {
  readonly network: NetworkId;
  readonly logDir: string;
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
}

/** PreProd — the current supported Midnight test network. This is the default. */
export class PreprodConfig implements Config {
  network: NetworkId = 'preprod';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod', `${new Date().toISOString()}.log`);
  indexer = 'https://indexer.preprod.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preprod.midnight.network';
  // The proof server runs locally (or wherever PROOF_SERVER_URL points).
  proofServer = process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';
  constructor() {
    setNetworkId(this.network);
  }
}

/** Preview — only use if you specifically need it (see the support matrix). */
export class PreviewConfig implements Config {
  network: NetworkId = 'preview';
  logDir = path.resolve(currentDir, '..', 'logs', 'preview', `${new Date().toISOString()}.log`);
  indexer = 'https://indexer.preview.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preview.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preview.midnight.network';
  proofServer = process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';
  constructor() {
    setNetworkId(this.network);
  }
}

/**
 * Midnight MAINNET via Blockfrost. Spends REAL funds — see ../deploymain.md.
 *
 * The official mainnet indexer/RPC are offline, so the indexer (GraphQL + WS)
 * and node RPC all route through Blockfrost, each authenticated with a
 * per-network token (`?project_id=<token>`). A preprod/preview token 403s here.
 */
export class MainnetConfig implements Config {
  network: NetworkId = 'mainnet';
  logDir = path.resolve(currentDir, '..', 'logs', 'mainnet', `${new Date().toISOString()}.log`);
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  constructor() {
    const projectId = process.env.MIDNIGHT_BLOCKFROST_PROJECT_ID?.trim();
    if (!projectId) {
      throw new Error(
        'MIDNIGHT_BLOCKFROST_PROJECT_ID is required for mainnet. Create a Midnight ' +
          'Mainnet project at blockfrost.io and set it in your .env (a preprod/preview token 403s on mainnet).',
      );
    }
    const q = `?project_id=${projectId}`;
    this.indexer = `https://midnight-mainnet.blockfrost.io/api/v0${q}`;
    this.indexerWS = `wss://midnight-mainnet.blockfrost.io/api/v0/ws${q}`;
    this.node = `https://rpc.midnight-mainnet.blockfrost.io${q}`;
    // Proof server is required for every deploy (ZK proof). Keep it reachable.
    this.proofServer =
      process.env.MIDNIGHT_PROOF_SERVER_URL?.trim() ||
      process.env.PROOF_SERVER_URL?.trim() ||
      'http://127.0.0.1:6300';
    setNetworkId(this.network);
  }
}

/** Local standalone stack (docker-compose) for offline testing. */
export class StandaloneConfig implements Config {
  network: NetworkId = 'undeployed';
  logDir = path.resolve(currentDir, '..', 'logs', 'standalone', `${new Date().toISOString()}.log`);
  indexer = 'http://127.0.0.1:8088/api/v3/graphql';
  indexerWS = 'ws://127.0.0.1:8088/api/v3/graphql/ws';
  node = 'http://127.0.0.1:9944';
  proofServer = 'http://127.0.0.1:6300';
  constructor() {
    setNetworkId(this.network);
  }
}

// ─── The one place the target network is chosen ─────────────────────────────
// Default is Preview. Override at runtime with (preferred, per deploymain.md):
//   MIDNIGHT_NETWORK=mainnet npm run deploy
// The legacy NOK_NETWORK var is still honoured as a fallback.
export type NetworkName = 'preprod' | 'preview' | 'standalone' | 'mainnet';

export const ACTIVE_NETWORK: NetworkName =
  ((process.env.MIDNIGHT_NETWORK ?? process.env.NOK_NETWORK)?.trim().toLowerCase() as NetworkName | undefined) ??
  'preview';

/** True when the active target is real-funds mainnet. */
export const IS_MAINNET = ACTIVE_NETWORK === 'mainnet';

/**
 * Per-network env var name an app/CLI reads a deployed contract address from.
 * Mainnet addresses live under MIDNIGHT_MAIN_<NAME>_ADDRESS so they can coexist
 * with preview/preprod addresses in one .env (deploymain.md §4).
 */
export function contractAddressEnvName(name: string): string {
  const upper = name.toUpperCase();
  return IS_MAINNET ? `MIDNIGHT_MAIN_${upper}_ADDRESS` : `MIDNIGHT_${upper}_ADDRESS`;
}

/** Resolve the active Config instance. Both deploy.ts and admin.ts call this. */
export function loadConfig(): Config {
  switch (ACTIVE_NETWORK) {
    case 'mainnet':
      return new MainnetConfig();
    case 'preview':
      return new PreviewConfig();
    case 'standalone':
      return new StandaloneConfig();
    case 'preprod':
    default:
      return new PreprodConfig();
  }
}
