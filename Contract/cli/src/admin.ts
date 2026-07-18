// SPDX-License-Identifier: Apache-2.0
//
// NOK admin console. Endpoints come from the SHARED config module (./config.ts)
// — never hardcoded here (Issue 4). Hashes are computed automatically from
// human-readable identifiers (Issue 5) — never typed by hand.
//
//   npm run admin                 # PreProd (default)
//   NOK_NETWORK=preview npm run admin
//
// If cli/nok-deployment.json exists (written by deploy.ts) its contractAddress
// and adminSecret are used as defaults.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { loadConfig, ACTIVE_NETWORK } from './config.js';
import { createLogger } from './logger-utils.js';
import { buildWalletAndWaitForFunds, buildFreshWallet, setLogger } from './wallet.js';
import {
  configureNokProviders,
  joinNok,
  registerNok,
  approveNokLogin,
  isNokRegistered,
  getNokLedgerState,
  generateAdminSecret,
} from './nok-api.js';
import { ownerIdentifierToField, nokHashToField } from './hash.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const DIV = '──────────────────────────────────────────────────────────────';

const config = loadConfig();
const logger = await createLogger(config.logDir);
setLogger(logger);

// Load deploy defaults if present
const deployInfoPath = path.resolve(currentDir, '..', 'nok-deployment.json');
let defaultAddress = '';
let defaultAdminSecret = '';
if (existsSync(deployInfoPath)) {
  try {
    const info = JSON.parse(readFileSync(deployInfoPath, 'utf8'));
    defaultAddress = info.contractAddress ?? '';
    defaultAdminSecret = info.adminSecret ?? '';
  } catch { /* ignore */ }
}

const rli = createInterface({ input, output, terminal: true });

console.log(`\n  NOK admin console — network: ${ACTIVE_NETWORK}\n`);

// Wallet
const seedEnv = process.env.NOK_WALLET_SEED?.trim();
const walletContext = seedEnv
  ? await buildWalletAndWaitForFunds(config, seedEnv)
  : await (async () => {
      const seed = (await rli.question('  Wallet seed (hex, Enter to generate fresh): ')).trim();
      return seed.length >= 32 ? buildWalletAndWaitForFunds(config, seed) : buildFreshWallet(config);
    })();

// Contract + admin secret
const addrIn = (await rli.question(`  Contract address${defaultAddress ? ` [${defaultAddress.slice(0, 16)}...]` : ''}: `)).trim();
const contractAddress = addrIn || defaultAddress;
if (!contractAddress) {
  console.error('  ✗ No contract address provided.');
  rli.close();
  process.exit(1);
}

const secretIn = (await rli.question('  Admin secret (hex, Enter to use saved/generate): ')).trim();
const adminSecret =
  secretIn.length >= 64
    ? Buffer.from(secretIn, 'hex')
    : defaultAdminSecret.length >= 64
      ? Buffer.from(defaultAdminSecret, 'hex')
      : generateAdminSecret();

const providers = await configureNokProviders(walletContext, config, logger);

const MENU = `
${DIV}
  NOK Admin — ${contractAddress.slice(0, 20)}...
${DIV}
  [1] Register a next-of-kin
  [2] Approve a NOK login
  [3] Check if an owner is registered
  [4] View contract state
  [5] Exit
${DIV}
> `;

let running = true;
while (running) {
  const choice = (await rli.question(MENU)).trim();
  try {
    switch (choice) {
      case '1': {
        const owner = (await rli.question('  K33P user handle (id/phone/wallet): ')).trim();
        const nok = (await rli.question('  Next-of-kin identifier (phone/email/id): ')).trim();
        const ownerField = ownerIdentifierToField(owner);
        const nokField = nokHashToField(nok);
        console.log(`  owner Field: ${ownerField}`);
        console.log(`  nok   Field: ${nokField}`);
        const joined = await joinNok(providers, contractAddress, adminSecret, logger);
        await registerNok(joined, ownerField, nokField, logger);
        console.log('  ✓ Registered\n');
        break;
      }
      case '2': {
        const owner = (await rli.question('  K33P user handle: ')).trim();
        const nok = (await rli.question('  Next-of-kin identifier: ')).trim();
        const joined = await joinNok(providers, contractAddress, adminSecret, logger);
        const ok = await approveNokLogin(joined, ownerIdentifierToField(owner), nokHashToField(nok), logger);
        console.log(ok ? '  ✓ Login approved\n' : '  ✗ Not approved\n');
        break;
      }
      case '3': {
        const owner = (await rli.question('  K33P user handle: ')).trim();
        const ok = await isNokRegistered(providers, contractAddress, ownerIdentifierToField(owner), logger);
        console.log(ok ? '  ✓ Registered\n' : '  ✗ Not registered\n');
        break;
      }
      case '4': {
        const state = await getNokLedgerState(providers, contractAddress, logger);
        if (state) {
          console.log(`\n${DIV}`);
          console.log(`  Address  : ${contractAddress}`);
          console.log(`  Admin PK : ${Buffer.from(state.admin).toString('hex')}`);
          console.log(`  Round    : ${state.round}`);
          console.log(`  Records  : ${state.registeredCount}`);
          console.log(`${DIV}\n`);
        } else {
          console.log('  Could not read contract state.\n');
        }
        break;
      }
      case '5':
        running = false;
        break;
      default:
        console.log(`  Invalid choice: ${choice}\n`);
    }
  } catch (e) {
    console.log(`  ✗ Failed: ${e instanceof Error ? e.message : String(e)}\n`);
  }
}

try { await walletContext.wallet.stop(); } catch { /* ignore */ }
rli.close();
console.log('\n  Goodbye.\n');
