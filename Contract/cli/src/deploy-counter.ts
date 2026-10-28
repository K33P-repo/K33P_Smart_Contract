// SPDX-License-Identifier: Apache-2.0
//
// CONTROL EXPERIMENT: deploy a trivial one-circuit counter contract through
// exactly the same wallet, TTL cap, dry run, HTTP submit, re-broadcast and
// snapshot-checkpoint path as the NOK deploy. If this lands and NOK does not,
// the problem is the NOK transaction; if neither lands, it is the stack/network.
//
//   npm run compact:counter          # once: compile contract/src/counter.compact
//   npm run deploy:counter           # same env as deploy (WALLET_SEED, Blockfrost, proof server)

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';

import { loadConfig, ACTIVE_NETWORK, IS_MAINNET } from './config.js';
import { createLogger } from './logger-utils.js';
import {
  buildWalletAndWaitForFunds,
  createWalletAndMidnightProvider,
  disposeWallet,
  setLogger,
  stopRebroadcast,
  waitForSpendableDust,
  waitForTip,
} from './wallet.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const managedDir = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'counter');

const config = loadConfig();
const logger = await createLogger(config.logDir);
setLogger(logger);

if (IS_MAINNET && process.env.CONFIRM_MAINNET_DEPLOY !== 'yes') {
  console.error('Refusing to deploy to mainnet without CONFIRM_MAINNET_DEPLOY=yes');
  process.exit(1);
}
const seed = process.env.WALLET_SEED?.trim();
if (!seed) {
  console.error('WALLET_SEED is required');
  process.exit(1);
}

// Compiled counter contract (built by `npm run compact:counter`).
const Counter: any = await import(path.join(managedDir, 'contract', 'index.js'));
const compiledCounter: any = (CompiledContract.make('counter', Counter.Contract) as any).pipe(
  (CompiledContract.withWitnesses as any)({}),
  (CompiledContract.withCompiledFileAssets as any)(managedDir),
);

console.log(`\n  Control deploy: counter contract → ${ACTIVE_NETWORK}\n`);
const walletContext = await buildWalletAndWaitForFunds(config, seed);

try {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(walletContext);
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const zkConfigProvider = new NodeZkConfigProvider(managedDir);
  const providers: any = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'counter-private-state',
      accountId,
      privateStoragePasswordProvider: () => `${Buffer.from(accountId, 'hex').toString('base64')}!`,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };

  await waitForTip(walletContext.wallet);
  if (!(await waitForSpendableDust(walletContext.wallet))) throw new Error('No spendable DUST coin.');

  const startedAt = Date.now();
  logger.info('Deploying counter contract...');
  const deployed: any = await walletContext.withTxCheckpoint(() =>
    deployContract(providers, {
      compiledContract: compiledCounter,
      privateStateId: 'counterPrivateState',
      initialPrivateState: {},
      args: [],
    }),
  );
  const address = deployed.deployTxData.public.contractAddress;
  console.log(`\n  ✓ COUNTER DEPLOYED in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  console.log(`    address: ${address}`);
  console.log(`    txId   : ${deployed.deployTxData.public.txId}`);
  console.log(`    block  : ${deployed.deployTxData.public.blockHeight}\n`);
} catch (e) {
  console.error(`\n  ✗ Counter deploy failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
} finally {
  await stopRebroadcast();
  await disposeWallet(walletContext);
}
