// SPDX-License-Identifier: Apache-2.0
//
// NOK contract API: provider setup, deploy, join, and the register/approve/query
// operations. Modelled on the Midnight example-dao shadowdao API.

import * as CompactRuntime from '@midnight-ntwrk/compact-runtime';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { deployContract, findDeployedContract, submitInsertVerifierKeyTx } from '@midnight-ntwrk/midnight-js/contracts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { assertIsContractAddress } from '@midnight-ntwrk/midnight-js/utils';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { type Logger } from 'pino';
import { randomBytes } from 'node:crypto';

import type { ContractProviders, DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';

import { type WalletContext, createWalletAndMidnightProvider } from './wallet.js';
import { type Config, nokContractConfig } from './config.js';

import { Nok, type NokPrivateState, nokWitnesses, createNokPrivateState } from '@k33p/nok-contract';

// ─── Types ────────────────────────────────────────────────────────────────────

type NokContract = Nok.Contract<NokPrivateState>;
const NokPrivateStateId = 'nokPrivateState' as const;
type NokProviders = ContractProviders<NokContract>;
type DeployedNokContract = DeployedContract<NokContract> | FoundContract<NokContract>;

export interface NokLedgerState {
  admin: Uint8Array;
  round: bigint;
  registeredCount: bigint;
  registeredIdentityCount: bigint;
}

// ─── Compiled contract definition ──────────────────────────────────────────────

const compiledNokContract: any = (CompiledContract.make('nok', Nok.Contract) as any).pipe(
  (CompiledContract.withWitnesses as any)(nokWitnesses),
  (CompiledContract.withCompiledFileAssets as any)(nokContractConfig.zkConfigPath),
);

// ─── Batched deploy (mainnet block-weight limit) ────────────────────────────────
//
// A deploy carries one verifier key per exported circuit. With all 6 circuits
// the deploy tx is ~15 KB and is too heavy for a single mainnet block slot: the
// mempool accepts it (validate_transaction says Valid+Ready) but block authors
// skip it at pre_dispatch's weight check, forever. Midnight's own guidance:
// "Deploy the contract with the circuits that fit, then add the remaining
// verifier keys with signed maintenance updates." So we deploy with a subset
// of circuits (DEPLOY_CIRCUITS, default = the 3 NOK circuits, ~9.7 KB tx) and
// insert the rest one per transaction (~6 KB each) afterwards.

/** Every provable circuit the contract exports (must match managed/nok/keys). */
export const ALL_CIRCUITS = [
  'register_nok',
  'approve_nok_login',
  'check_nok_registered',
  'register_identity',
  'verify_login',
  'check_identity_registered',
] as const;
export type CircuitId = (typeof ALL_CIRCUITS)[number];

/** Circuits whose verifier keys ship IN the deploy tx (override with DEPLOY_CIRCUITS=a,b,c). */
export const DEPLOY_CIRCUITS: readonly CircuitId[] = (
  process.env.DEPLOY_CIRCUITS ?? 'register_nok,approve_nok_login,check_nok_registered'
)
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is CircuitId => (ALL_CIRCUITS as readonly string[]).includes(s));

/** Circuits added after deploy via submitInsertVerifierKeyTx. */
export const DEFERRED_CIRCUITS: readonly CircuitId[] = ALL_CIRCUITS.filter((c) => !DEPLOY_CIRCUITS.includes(c));

// Same contract, restricted to DEPLOY_CIRCUITS for the deploy transaction:
//  1. only those circuits are reported as provable, so midnight-js fetches and
//     attaches only their verifier keys;
//  2. the initial on-chain state is REBUILT with only their operations. The
//     compiled `initialState()` registers an (empty) operation for every
//     exported circuit, and the ledger rejects a deploy that has an operation
//     without a verifier key (error 110 VerifierKeyNotSet). ContractState has
//     no remove method, so copy data/authority/balance into a fresh state and
//     set only the operations we are shipping. The deferred circuits are added
//     later by submitInsertVerifierKeyTx (which creates the operation + key).
// The ledger data layout and constructor are untouched.
class NokDeployContract extends (Nok.Contract as any) {
  constructor(witnesses: any) {
    super(witnesses);
    const pick = (o: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(o).filter(([k]) => (DEPLOY_CIRCUITS as readonly string[]).includes(k)));
    (this as any).impureCircuits = pick((this as any).impureCircuits);
    (this as any).provableCircuits = pick((this as any).provableCircuits);
  }

  initialState(...args: any[]): any {
    const result = super.initialState(...args);
    const full = result.currentContractState;
    const trimmed = new CompactRuntime.ContractState();
    trimmed.data = full.data;
    trimmed.maintenanceAuthority = full.maintenanceAuthority;
    trimmed.balance = full.balance;
    for (const name of full.operations()) {
      if (typeof name === 'string' && (DEPLOY_CIRCUITS as readonly string[]).includes(name)) {
        trimmed.setOperation(name, full.operation(name));
      }
    }
    return { ...result, currentContractState: trimmed };
  }
}

const compiledNokDeployContract: any = (CompiledContract.make('nok', NokDeployContract as any) as any).pipe(
  (CompiledContract.withWitnesses as any)(nokWitnesses),
  (CompiledContract.withCompiledFileAssets as any)(nokContractConfig.zkConfigPath),
);

/** Read a circuit's verifier key from the compiled ZK assets. */
export function readVerifierKey(circuitId: CircuitId): Uint8Array {
  return new Uint8Array(readFileSync(path.join(nokContractConfig.zkConfigPath, 'keys', `${circuitId}.verifier`)));
}

// ─── Cryptographic helpers ──────────────────────────────────────────────────────

/** Generate a fresh 32-byte admin secret. Store it securely — it controls the DAO. */
export function generateAdminSecret(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

/** Derive the on-chain admin PUBLIC key from the admin secret (pure circuit). */
export function deriveAdminPubKey(adminSecret: Uint8Array): Uint8Array {
  return Nok.pureCircuits.publicKey(adminSecret);
}

// ─── Provider setup ───────────────────────────────────────────────────────────

export async function configureNokProviders(
  walletContext: WalletContext,
  config: Config,
  _log: Logger,
): Promise<NokProviders> {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(walletContext);
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, 'hex').toString('base64')}!`;

  // IMPORTANT: httpClientProofProvider MUST receive the zkConfigProvider as its
  // 2nd argument, otherwise key material cannot be resolved and the proof server
  // rejects the request.
  const zkConfigProvider = new NodeZkConfigProvider(nokContractConfig.zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: nokContractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    // NodeZkConfigProvider keys circuits by string; the provider type wants a
    // branded ProvableCircuitId. They are structurally identical at runtime.
    zkConfigProvider: zkConfigProvider as any,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
}

// ─── Deploy ─────────────────────────────────────────────────────────────────────

export async function deployNok(
  providers: NokProviders,
  adminSecret: Uint8Array,
  log: Logger,
  signingKey?: string,
): Promise<DeployedNokContract> {
  const adminPubKey = deriveAdminPubKey(adminSecret);
  const privateState = createNokPrivateState(adminSecret);

  log.info(
    `Deploying NOK contract (batched: ${DEPLOY_CIRCUITS.length} of ${ALL_CIRCUITS.length} circuits in the deploy tx)... ` +
      `admin pubkey: ${Buffer.from(adminPubKey).toString('hex').slice(0, 16)}...`,
  );

  // Admin public key is set in the constructor at deploy time (sealed).
  // `as any` bridges the SDK's very strict deploy generics; args are validated
  // by our own typed function signatures above. The deploy uses the TRIMMED
  // contract so the tx fits a mainnet block; remaining verifier keys are added
  // by insertDeferredVerifierKeys().
  const deployed = (await deployContract(providers as any, {
    compiledContract: compiledNokDeployContract as any,
    privateStateId: NokPrivateStateId,
    initialPrivateState: privateState,
    args: [adminPubKey],
    // Contract Maintenance Authority key. Pre-generated by the caller and
    // persisted BEFORE submission: it is the only key that can insert the
    // deferred verifier keys, so losing it means the deploy can never finish.
    ...(signingKey ? { signingKey } : {}),
  })) as DeployedNokContract;

  log.info(`NOK deployed at: ${deployed.deployTxData.public.contractAddress}`);
  return deployed;
}

/**
 * Which deferred circuits still lack a verifier key on-chain. Reads the live
 * contract state so this is idempotent / resumable: re-running after a partial
 * failure only inserts what is missing.
 */
export async function missingVerifierKeys(providers: NokProviders, contractAddress: string): Promise<CircuitId[]> {
  assertIsContractAddress(contractAddress);
  const state = await providers.publicDataProvider.queryContractState(contractAddress as ContractAddress);
  if (!state) throw new Error(`missingVerifierKeys: no contract state found at ${contractAddress}`);
  // Safety: every key already on-chain must equal the compiled one. A mismatch
  // means the contract was recompiled mid-deploy; inserting more keys would
  // produce a contract that can never be joined. Refuse, like the runbook says.
  const mismatched = ALL_CIRCUITS.filter((c) => {
    const op = (state as any).operation(c);
    return op && Buffer.from(op.verifierKey).toString('hex') !== Buffer.from(readVerifierKey(c)).toString('hex');
  });
  if (mismatched.length) {
    throw new Error(
      `On-chain verifier key(s) differ from the compiled build for: ${mismatched.join(', ')}. ` +
        'The contract was recompiled after deploy. Do not insert more keys; redeploy from a single build.',
    );
  }
  return DEFERRED_CIRCUITS.filter((c) => !(state as any).operation(c));
}

/**
 * Make sure the Contract Maintenance Authority key for `contractAddress` is in
 * the private-state store (where submitInsertVerifierKeyTx looks it up). On a
 * resume with a fresh store, restore it from the saved deployment record.
 */
export async function ensureSigningKey(providers: NokProviders, contractAddress: string, savedKey?: string): Promise<void> {
  const psp: any = providers.privateStateProvider;
  const existing = await psp.getSigningKey(contractAddress);
  if (existing) return;
  if (!savedKey) {
    throw new Error(
      `No maintenance (CMA) signing key for ${contractAddress} in the private-state store and none saved. ` +
        'Without it the deferred verifier keys cannot be inserted.',
    );
  }
  await psp.setSigningKey(contractAddress, savedKey);
}

/**
 * Add the deferred circuits' verifier keys to the deployed contract, one
 * signed maintenance transaction per circuit (each ~6 KB, which mainnet blocks
 * include readily). Uses the FULL compiled contract and the maintenance
 * authority (signing key) that deployContract stored in the private-state
 * provider for this address — so it must run with the same providers /
 * private-state store as the deploy.
 *
 * `beforeEach` lets the caller wait for sync + an available DUST coin between
 * transactions (each one spends DUST and its change must be observed first).
 */
export async function insertDeferredVerifierKeys(
  providers: NokProviders,
  contractAddress: string,
  log: Logger,
  beforeEach?: (circuitId: CircuitId, index: number, total: number) => Promise<void>,
  runTx: <T>(fn: () => Promise<T>) => Promise<T> = (fn) => fn(),
): Promise<CircuitId[]> {
  const todo = await missingVerifierKeys(providers, contractAddress);
  if (todo.length === 0) {
    log.info('All verifier keys already present on-chain.');
    return [];
  }
  log.info(`Inserting ${todo.length} deferred verifier key(s): ${todo.join(', ')}`);
  const done: CircuitId[] = [];
  for (const [i, circuitId] of todo.entries()) {
    if (beforeEach) await beforeEach(circuitId, i, todo.length);
    log.info(`Inserting verifier key ${i + 1}/${todo.length}: ${circuitId}`);
    await runTx(() =>
      submitInsertVerifierKeyTx(
        providers as any,
        compiledNokContract as any,
        contractAddress as ContractAddress,
        circuitId as any,
        readVerifierKey(circuitId) as any,
      ),
    );
    done.push(circuitId);
    log.info(`Verifier key inserted: ${circuitId}`);
  }
  return done;
}

// ─── Join existing ──────────────────────────────────────────────────────────────

export async function joinNok(
  providers: NokProviders,
  contractAddress: string,
  adminSecret: Uint8Array,
  log: Logger,
): Promise<DeployedNokContract> {
  assertIsContractAddress(contractAddress);
  const privateState = createNokPrivateState(adminSecret);

  log.info(`Joining NOK at ${contractAddress}...`);
  const found = (await findDeployedContract(providers as any, {
    compiledContract: compiledNokContract as any,
    privateStateId: NokPrivateStateId,
    contractAddress: contractAddress as ContractAddress,
    initialPrivateState: privateState,
  })) as DeployedNokContract;
  log.info('Joined successfully');
  return found;
}

// ─── Admin write ops ──────────────────────────────────────────────────────────

/** Register a next-of-kin record. Both args are pre-hashed Field values. */
export async function registerNok(
  deployed: DeployedNokContract,
  ownerIdentifier: bigint,
  nokHash: bigint,
  log: Logger,
): Promise<void> {
  log.info(`Registering NOK for owner ${ownerIdentifier.toString().slice(0, 12)}...`);
  await (deployed.callTx as any).register_nok(ownerIdentifier, nokHash);
  log.info('NOK registered');
}

/** Approve a NOK-initiated login by proving the supplied hash matches. */
export async function approveNokLogin(
  deployed: DeployedNokContract,
  ownerIdentifier: bigint,
  nokHash: bigint,
  log: Logger,
): Promise<boolean> {
  log.info(`Approving NOK login for owner ${ownerIdentifier.toString().slice(0, 12)}...`);
  const result = await (deployed.callTx as any).approve_nok_login(ownerIdentifier, nokHash);
  log.info('NOK login approved');
  return (result as any).public?.result ?? true;
}

// ─── Identity write ops (K33P authentication) ────────────────────────────────────

/** Register a credential commitment for a K33P user. Both args are Field values. */
export async function registerIdentity(
  deployed: DeployedNokContract,
  userId: bigint,
  commitment: bigint,
  log: Logger,
): Promise<void> {
  log.info(`Registering identity for user ${userId.toString().slice(0, 12)}...`);
  await (deployed.callTx as any).register_identity(userId, commitment);
  log.info('Identity registered');
}

/** Verify a login by producing a ZK proof that the supplied commitment matches. */
export async function verifyLogin(
  deployed: DeployedNokContract,
  userId: bigint,
  commitment: bigint,
  log: Logger,
): Promise<boolean> {
  log.info(`Verifying login for user ${userId.toString().slice(0, 12)}...`);
  const result = await (deployed.callTx as any).verify_login(userId, commitment);
  log.info('Login verified');
  return (result as any).public?.result ?? true;
}

// ─── Read ops ───────────────────────────────────────────────────────────────────

export async function getNokLedgerState(
  providers: NokProviders,
  contractAddress: string,
  _log: Logger,
): Promise<NokLedgerState | null> {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress as ContractAddress);
  if (!contractState) return null;

  const ls = Nok.ledger(contractState.data);
  return {
    admin: ls.admin,
    round: ls.round,
    registeredCount: ls.noks.size(),
    registeredIdentityCount: ls.identities.size(),
  };
}

/** Read-only membership check against the public ledger state. */
export async function isNokRegistered(
  providers: NokProviders,
  contractAddress: string,
  ownerIdentifier: bigint,
  _log: Logger,
): Promise<boolean> {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress as ContractAddress);
  if (!contractState) return false;
  const ls = Nok.ledger(contractState.data);
  return ls.noks.member(ownerIdentifier);
}

/** Read-only: is a K33P identity registered for this user? */
export async function isIdentityRegistered(
  providers: NokProviders,
  contractAddress: string,
  userId: bigint,
  _log: Logger,
): Promise<boolean> {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress as ContractAddress);
  if (!contractState) return false;
  const ls = Nok.ledger(contractState.data);
  return ls.identities.member(userId);
}
