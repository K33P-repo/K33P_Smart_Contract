// SPDX-License-Identifier: Apache-2.0
//
// NOK admin console. Endpoints come from the SHARED config module (./config.ts)
// — never hardcoded here (Issue 4). Hashes are computed automatically from
// human-readable identifiers (Issue 5) — never typed by hand.
//
//   npm run admin                       # Preview (default)
//   MIDNIGHT_NETWORK=preprod npm run admin
//   MIDNIGHT_NETWORK=mainnet npm run admin
//
// Secrets are read from the environment / the gitignored deployment file only.
// The wallet seed is NEVER prompted for or printed:
//   WALLET_SEED        (required) hex seed of the funded wallet. Keep it secret.
//   NOK_ADMIN_SECRET   (optional) hex admin secret; else taken from the
//                      per-network nok-deployment.<network>.json written at deploy.
// The contract address is taken from MIDNIGHT_[MAIN_]NOK_ADDRESS, the deployment
// file, or (as a convenience) an interactive prompt — it is not sensitive.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { loadConfig, ACTIVE_NETWORK, contractAddressEnvName } from './config.js';
import { createLogger } from './logger-utils.js';
import { buildWalletAndWaitForFunds, disposeWallet, setLogger } from './wallet.js';
import {
  configureNokProviders,
  joinNok,
  registerNok,
  approveNokLogin,
  isNokRegistered,
  getNokLedgerState,
} from './nok-api.js';
import { ownerIdentifierToField, nokHashToField } from './hash.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const DIV = '──────────────────────────────────────────────────────────────';

const config = loadConfig();
const logger = await createLogger(config.logDir);
setLogger(logger);

// Load deploy defaults if present — prefer the per-network file, fall back to
// the legacy single-file name for older deploys.
let defaultAddress = '';
let defaultAdminSecret = '';
for (const name of [`nok-deployment.${ACTIVE_NETWORK}.json`, 'nok-deployment.json']) {
  const p = path.resolve(currentDir, '..', name);
  if (!existsSync(p)) continue;
  try {
    const info = JSON.parse(readFileSync(p, 'utf8'));
    if (!info.network || info.network === ACTIVE_NETWORK) {
      defaultAddress = info.contractAddress ?? '';
      defaultAdminSecret = info.adminSecret ?? '';
      break;
    }
  } catch { /* ignore */ }
}

const rli = createInterface({ input, output, terminal: true });

console.log(`\n  NOK admin console — network: ${ACTIVE_NETWORK}\n`);

// Wallet seed — environment only. We never prompt for or echo the seed.
const seed = process.env.WALLET_SEED?.trim();
if (!seed || seed.length < 32) {
  console.error(
    '  ✗ WALLET_SEED is not set (or too short). Provide the funded wallet seed via\n' +
      '    the WALLET_SEED environment variable (e.g. a gitignored .env). The CLI\n' +
      '    never prompts for or prints the seed.',
  );
  rli.close();
  process.exit(1);
}
const walletContext = await buildWalletAndWaitForFunds(config, seed);

// Contract address — env var, deployment file, or (non-sensitive) prompt.
const addrEnvName = contractAddressEnvName('NOK');
const addrEnv = process.env[addrEnvName]?.trim();
const addrFallback = addrEnv || defaultAddress;
const addrIn = (await rli.question(`  Contract address${addrFallback ? ` [${addrFallback.slice(0, 16)}...]` : ''}: `)).trim();
const contractAddress = addrIn || addrFallback;
if (!contractAddress) {
  console.error(`  ✗ No contract address. Set ${addrEnvName}, deploy first, or enter one.`);
  await disposeWallet(walletContext);
  rli.close();
  process.exit(1);
}

// Admin secret — env var or the gitignored deployment file. We do NOT invent one:
// a mismatched admin secret would make every write silently unauthorized.
const secretEnv = process.env.NOK_ADMIN_SECRET?.trim();
const adminSecretHex = secretEnv && secretEnv.length >= 64 ? secretEnv : defaultAdminSecret;
if (!adminSecretHex || adminSecretHex.length < 64) {
  console.error('  ✗ No admin secret available. Set NOK_ADMIN_SECRET or run from a host with the deployment file.');
  await disposeWallet(walletContext);
  rli.close();
  process.exit(1);
}
const adminSecret = Buffer.from(adminSecretHex, 'hex');

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
        const ownerField = ownerIdentifierToField(owner, adminSecret);
        const nokField = nokHashToField(nok, adminSecret);
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
        const ok = await approveNokLogin(joined, ownerIdentifierToField(owner, adminSecret), nokHashToField(nok, adminSecret), logger);
        console.log(ok ? '  ✓ Login approved\n' : '  ✗ Not approved\n');
        break;
      }
      case '3': {
        const owner = (await rli.question('  K33P user handle: ')).trim();
        const ok = await isNokRegistered(providers, contractAddress, ownerIdentifierToField(owner, adminSecret), logger);
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

await disposeWallet(walletContext);
rli.close();
console.log('\n  Goodbye.\n');
