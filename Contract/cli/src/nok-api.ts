// SPDX-License-Identifier: Apache-2.0
//
// NOK contract API: provider setup, deploy, join, and the register/approve/query
// operations. Modelled on the Midnight example-dao shadowdao API.

import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
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
}

// ─── Compiled contract definition ──────────────────────────────────────────────

const compiledNokContract: any = (CompiledContract.make('nok', Nok.Contract) as any).pipe(
  (CompiledContract.withWitnesses as any)(nokWitnesses),
  (CompiledContract.withCompiledFileAssets as any)(nokContractConfig.zkConfigPath),
);

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
): Promise<DeployedNokContract> {
  const adminPubKey = deriveAdminPubKey(adminSecret);
  const privateState = createNokPrivateState(adminSecret);

  log.info(`Deploying NOK contract... admin pubkey: ${Buffer.from(adminPubKey).toString('hex').slice(0, 16)}...`);

  // Admin public key is set in the constructor at deploy time (sealed).
  // `as any` bridges the SDK's very strict deploy generics; args are validated
  // by our own typed function signatures above.
  const deployed = (await deployContract(providers as any, {
    compiledContract: compiledNokContract as any,
    privateStateId: NokPrivateStateId,
    initialPrivateState: privateState,
    args: [adminPubKey],
  })) as DeployedNokContract;

  log.info(`NOK deployed at: ${deployed.deployTxData.public.contractAddress}`);
  return deployed;
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
