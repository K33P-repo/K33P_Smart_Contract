// SPDX-License-Identifier: Apache-2.0
//
// ─── SINGLE SHARED NETWORK CONFIG (Issue 4) ──────────────────────────────────
//
// Both deploy.ts and admin.ts import their endpoints from here. The deprecated
// `testnet-02` endpoints are gone. The DEFAULT target is PreProd — the current
// supported Midnight test network — matching the compatibility matrix:
//   https://docs.midnight.network/relnotes/support-matrix
//
// To retarget the whole toolchain (deploy + admin) to a different network, edit
// ONE thing: `ACTIVE_NETWORK` below (or set the NOK_NETWORK env var). Never copy
// endpoints into individual scripts again.

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
// Default is Preview. Override at runtime with:  NOK_NETWORK=preprod npm run admin
export type NetworkName = 'preprod' | 'preview' | 'standalone';

export const ACTIVE_NETWORK: NetworkName =
  (process.env.NOK_NETWORK as NetworkName | undefined) ?? 'preview';

/** Resolve the active Config instance. Both deploy.ts and admin.ts call this. */
export function loadConfig(): Config {
  switch (ACTIVE_NETWORK) {
    case 'preview':
      return new PreviewConfig();
    case 'standalone':
      return new StandaloneConfig();
    case 'preprod':
    default:
      return new PreprodConfig();
  }
}
