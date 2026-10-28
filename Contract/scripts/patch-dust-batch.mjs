// Make the DUST wallet's genesis-sync batch size configurable.
//
// @midnight-ntwrk/wallet-sdk-dust-wallet 3.0.0 hardcodes `const batchSize = 10`
// in dist/v1/Sync.js and exposes no option (the shielded wallet does expose
// `batchSize`). On mainnet the dust sub-wallet must apply ~650k+ ledger events
// from genesis, so 10-per-batch takes well over an hour, while the shielded
// wallet at batch 1000 finishes in minutes. This rewrites that one constant to
// read DUST_SYNC_BATCH_SIZE (default 1000). Idempotent; runs on postinstall so
// it survives `npm install`. Remove once the SDK exposes the option.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The package has an `exports` map, so require.resolve('.../package.json') is
// blocked — locate the file by path in the workspace's node_modules instead.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = path.join('node_modules', '@midnight-ntwrk', 'wallet-sdk-dust-wallet', 'dist', 'v1', 'Sync.js');
const candidates = [root, path.join(root, 'cli'), path.join(root, 'contract')].map((d) => path.join(d, rel));
const file = candidates.find((f) => existsSync(f));
if (!file) {
  console.log('[patch-dust-batch] dust-wallet not installed; skipping');
  process.exit(0);
}

const src = readFileSync(file, 'utf8');
const needle = 'const batchSize = 10;';
const replacement = 'const batchSize = Number(process.env.DUST_SYNC_BATCH_SIZE ?? 1000); /* patched: see scripts/patch-dust-batch.mjs */';

if (src.includes(replacement)) { console.log('[patch-dust-batch] already patched'); process.exit(0); }
if (!src.includes(needle)) { console.log('[patch-dust-batch] expected line not found (SDK changed?) — leaving file untouched'); process.exit(0); }

writeFileSync(file, src.replace(needle, replacement));
console.log(`[patch-dust-batch] patched ${file} (DUST_SYNC_BATCH_SIZE, default 1000)`);
