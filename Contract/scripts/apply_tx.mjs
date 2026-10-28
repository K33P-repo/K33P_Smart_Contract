// Dry-run an extrinsic through the runtime's BlockBuilder_apply_extrinsic
// (read-only state_call, nothing is submitted). This runs the same checks a
// block AUTHOR runs when it tries to include the tx — including the block
// weight check and the ledger apply — so it can explain why a pool-accepted,
// "Valid + Ready" tx never gets into a block.
//
//   node scripts/apply_tx.mjs <MIDNIGHT_BLOCKFROST_PROJECT_ID> [0xhex | file]   (default scripts/.last_extrinsic.hex)
//
// Result decoding (ApplyExtrinsicResult = Result<Result<(), DispatchError>, TransactionValidityError>):
//   0x0000…       Ok(Ok)                        -> would apply fine in an empty block
//   0x0001…       Ok(Err(DispatchError))        -> dispatch failed (module error etc.)
//   0x01 00 NN    Err(Invalid(NN))               -> 06=ExhaustsResources (too heavy), 07 NN=Custom(NN) ledger error
//   0x01 01 NN    Err(Unknown(NN))
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiPromise, HttpProvider } from '@polkadot/api';
import { hexToU8a, u8aToHex } from '@polkadot/util';

const INVALID = ['Call', 'Payment', 'Future', 'Stale', 'BadProof', 'AncientBirthBlock', 'ExhaustsResources', 'Custom', 'BadMandatory', 'MandatoryValidation', 'BadSigner'];
const [PID, src] = process.argv.slice(2);
if (!PID) { console.error('usage: apply_tx.mjs <project id> [0xhex|file]'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
let hex = src ?? path.join(here, '.last_extrinsic.hex');
if (!hex.startsWith('0x')) { if (!existsSync(hex)) { console.error(`file not found: ${hex}`); process.exit(2); } hex = readFileSync(hex, 'utf8').trim(); }
console.log(`extrinsic: ${hex.slice(0, 22)}… (${(hex.length - 2) / 2} bytes)`);

const rpc = process.env.RPC_URL ?? `https://rpc.midnight-mainnet.blockfrost.io?project_id=${PID}`;
const api = await ApiPromise.create({ provider: new HttpProvider(rpc), noInitWarn: true });
try {
  const head = await api.rpc.chain.getHeader();
  const at = await api.rpc.chain.getBlockHash(head.number.toNumber());
  console.log(`applying against state of block #${head.number} ${at.toHex().slice(0, 18)}…`);
  const raw = await api.rpc.state.call('BlockBuilder_apply_extrinsic', hex, at);
  const u8 = raw.toU8a(true);
  console.log(`raw ApplyExtrinsicResult: ${u8aToHex(u8)}`);
  if (u8[0] === 0) {
    console.log(u8[1] === 0 ? '\nOK: the tx APPLIES cleanly (would be included in an empty block). Not a validity/weight problem.' : `\nDISPATCH ERROR: ${u8aToHex(u8.subarray(1))}`);
  } else if (u8[1] === 0) {
    const v = u8[2];
    console.log(`\nREJECTED AT APPLY: Invalid::${INVALID[v] ?? v}${v === 7 ? `(${u8[3]})  <- Midnight ledger error code ${u8[3]}` : ''}`);
    if (v === 6) console.log('   ExhaustsResources = the tx does not fit the block weight budget: block authors skip it forever (pool keeps it).');
  } else {
    console.log(`\nREJECTED AT APPLY: Unknown::${u8[2]}`);
  }
} catch (e) {
  console.log('\nstate_call failed:', String(e?.message ?? e).split('\n')[0]);
} finally {
  await api.disconnect().catch(() => undefined);
}
