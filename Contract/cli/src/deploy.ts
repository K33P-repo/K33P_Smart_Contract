// SPDX-License-Identifier: Apache-2.0
//
// NOK deployment script. Endpoints come from the SHARED config module
// (./config.ts) — never hardcoded here (Issue 4).
//
//   npm run deploy                 # PreProd (default)
//   NOK_NETWORK=preview npm run deploy
//
// Optional env:
//   NOK_WALLET_SEED   hex seed to reuse a funded wallet (else a fresh one)
//   NOK_ADMIN_SECRET  hex 32-byte admin secret (else generated)

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { loadConfig, ACTIVE_NETWORK } from './config.js';
import { createLogger } from './logger-utils.js';
import { buildWalletAndWaitForFunds, buildFreshWallet, setLogger } from './wallet.js';
import { configureNokProviders, deployNok, generateAdminSecret, deriveAdminPubKey } from './nok-api.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const DIV = '──────────────────────────────────────────────────────────────';

const config = loadConfig();
const logger = await createLogger(config.logDir);
setLogger(logger);

console.log(`\n  NOK deployment — network: ${ACTIVE_NETWORK}\n`);

const rli = createInterface({ input, output, terminal: true });

// 1) Wallet
const seedEnv = process.env.NOK_WALLET_SEED?.trim();
const walletContext = seedEnv
  ? await buildWalletAndWaitForFunds(config, seedEnv)
  : await (async () => {
      const seed = (await rli.question('  Wallet seed (hex, Enter to generate fresh): ')).trim();
      return seed.length >= 32 ? buildWalletAndWaitForFunds(config, seed) : buildFreshWallet(config);
    })();

// 2) Admin secret
const adminEnv = process.env.NOK_ADMIN_SECRET?.trim();
let adminSecret: Uint8Array;
if (adminEnv && adminEnv.length >= 64) {
  adminSecret = Buffer.from(adminEnv, 'hex');
  console.log('  Using admin secret from NOK_ADMIN_SECRET.\n');
} else {
  const provided = (await rli.question('  Admin secret (hex, Enter to generate): ')).trim();
  if (provided.length >= 64) {
    adminSecret = Buffer.from(provided, 'hex');
  } else {
    adminSecret = generateAdminSecret();
    console.log(`\n  Generated admin secret: ${Buffer.from(adminSecret).toString('hex')}`);
    console.log('  ⚠  SAVE THIS — it is required to register/approve NOKs!\n');
  }
}

// 3) Deploy
try {
  const providers = await configureNokProviders(walletContext, config, logger);
  const deployed = await deployNok(providers, adminSecret, logger);
  const contractAddress = deployed.deployTxData.public.contractAddress;
  const adminPubKey = deriveAdminPubKey(adminSecret);

  const info = {
    network: ACTIVE_NETWORK,
    contractAddress,
    adminPubKey: Buffer.from(adminPubKey).toString('hex'),
    adminSecret: Buffer.from(adminSecret).toString('hex'),
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.resolve(currentDir, '..', 'nok-deployment.json');
  writeFileSync(outPath, JSON.stringify(info, null, 2));

  console.log(`\n${DIV}`);
  console.log('  ✓ NOK deployed');
  console.log(`  Network : ${ACTIVE_NETWORK}`);
  console.log(`  Address : ${contractAddress}`);
  console.log(`  Admin PK: ${info.adminPubKey}`);
  console.log(`  Saved   : ${outPath}`);
  console.log(`${DIV}\n`);
} catch (e) {
  console.error(`  ✗ Deploy failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
} finally {
  try { await walletContext.wallet.stop(); } catch { /* ignore */ }
  rli.close();
}
