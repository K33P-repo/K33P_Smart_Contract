// SPDX-License-Identifier: Apache-2.0
//
// Wallet sync-state persistence (deploymain.md §2).
//
// A full genesis sync is slow and, over Blockfrost, can stall partway — and
// deploy retries are common. Persisting each sub-wallet's serialized state lets
// a re-run RESUME (seconds) instead of re-syncing from scratch.
//
// SECURITY: snapshots are keyed by network + a hash of the seed. The seed itself
// is NEVER written to disk. Snapshots are network+seed scoped so they can never
// cross networks/wallets (resuming saved state across a *different* indexer
// corrupts cursors — see the migration runbook).
//
// Escape hatch: set WALLET_STATE_RESET=1 to ignore/clear any existing snapshot
// (use when state is stale or corrupt).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Snapshots live outside git (see .gitignore). */
export const STATE_DIR = path.resolve(currentDir, '..', '.wallet-state');

export interface WalletSnapshot {
  readonly shielded: string;
  readonly unshielded: string;
  readonly dust: string;
}

const seedFingerprint = (seed: string): string =>
  createHash('sha256').update(seed, 'hex').digest('hex').slice(0, 16);

const snapshotPath = (network: string, seed: string): string =>
  path.join(STATE_DIR, `${network}-${seedFingerprint(seed)}.json`);

/** Remove any snapshot for this network+seed. */
export function clearSnapshot(network: string, seed: string): void {
  const p = snapshotPath(network, seed);
  if (existsSync(p)) rmSync(p, { force: true });
}

/**
 * Load a previously persisted snapshot, or `undefined` if none exists / it is
 * invalid / WALLET_STATE_RESET=1 is set. On WALLET_STATE_RESET it also deletes
 * the stale snapshot so later saves start clean.
 */
export function loadSnapshot(network: string, seed: string): WalletSnapshot | undefined {
  if (process.env.WALLET_STATE_RESET === '1') {
    clearSnapshot(network, seed);
    return undefined;
  }
  // A leftover pre-tx checkpoint means the previous run died (Ctrl-C, crash)
  // while a fee-paying tx was in flight: the live snapshot may hold the DUST
  // coin as pending for a tx that never landed. Prefer the checkpoint.
  if (existsSync(checkpointPath(network, seed))) {
    rollbackToCheckpoint(network, seed);
    console.log('  ↩  Found a pre-transaction checkpoint from an interrupted run — restored it (DUST coin released).');
  }
  const p = snapshotPath(network, seed);
  if (!existsSync(p)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as Partial<WalletSnapshot>;
    if (
      typeof parsed.shielded === 'string' &&
      typeof parsed.unshielded === 'string' &&
      typeof parsed.dust === 'string'
    ) {
      return parsed as WalletSnapshot;
    }
  } catch {
    /* fall through — treat as no snapshot */
  }
  return undefined;
}

// ─── Pre-transaction checkpoint ────────────────────────────────────────────────
//
// Balancing a tx marks the DUST coin it spends as *pending* in the wallet's
// in-memory state. If that tx never lands (dropped, too heavy for a block,
// timed out) the periodic snapshot has still persisted the lock, and the next
// run sees "0 DUST coins" until a full re-sync. So: copy the current snapshot
// aside right BEFORE building a fee-paying tx, and if the tx fails, put it
// back — the coin is unlocked there and the next run resumes from that point.

const checkpointPath = (network: string, seed: string): string => `${snapshotPath(network, seed)}.pre-tx`;

/** Save the current snapshot as the pre-tx checkpoint (no-op without a snapshot). */
export function checkpointSnapshot(network: string, seed: string): boolean {
  const p = snapshotPath(network, seed);
  if (!existsSync(p)) return false;
  writeFileSync(checkpointPath(network, seed), readFileSync(p));
  return true;
}

/** Restore the pre-tx checkpoint over the live snapshot. Returns false if there is none. */
export function rollbackToCheckpoint(network: string, seed: string): boolean {
  const c = checkpointPath(network, seed);
  if (!existsSync(c)) return false;
  writeFileSync(snapshotPath(network, seed), readFileSync(c));
  rmSync(c, { force: true });
  return true;
}

/** Drop the checkpoint after the tx is confirmed (the live snapshot is now the truth). */
export function discardCheckpoint(network: string, seed: string): void {
  rmSync(checkpointPath(network, seed), { force: true });
}

/** Persist a snapshot (atomic write) for this network+seed. */
export function saveSnapshot(network: string, seed: string, snapshot: WalletSnapshot): void {
  mkdirSync(STATE_DIR, { recursive: true });
  const p = snapshotPath(network, seed);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(snapshot));
  // Rename is atomic on the same filesystem; avoids a half-written snapshot.
  writeFileSync(p, readFileSync(tmp));
  rmSync(tmp, { force: true });
}
