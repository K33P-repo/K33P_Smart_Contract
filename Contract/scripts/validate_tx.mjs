// Ask the Midnight runtime to validate an extrinsic (read-only, nothing is
// submitted). Explains WHY a pool-accepted tx is not being included:
//   Valid   -> prints priority / requires / provides / longevity. A non-empty
//              `requires` that nothing `provides` means it sits in the FUTURE
//              queue forever.
//   Invalid -> prints the ledger error code (e.g. Custom(170)).
//
//   node scripts/validate_tx.mjs <MIDNIGHT_BLOCKFROST_PROJECT_ID> [0xhex | path-to-hex-file]
//   (defaults to scripts/.last_extrinsic.hex)
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiPromise, HttpProvider } from '@polkadot/api';
import { hexToU8a, u8aToHex, u8aConcat, compactFromU8a } from '@polkadot/util';

// Manual SCALE decode of TransactionValidity = Result<ValidTransaction, TransactionValidityError>.
const INVALID = ['Call', 'Payment', 'Future', 'Stale', 'BadProof', 'AncientBirthBlock', 'ExhaustsResources', 'Custom', 'BadMandatory', 'MandatoryValidation', 'BadSigner'];
const UNKNOWN = ['CannotLookup', 'NoUnsignedValidator', 'Custom'];
// compactFromU8a returns [bytesConsumed, value]
const readVecBytes = (u8, off) => { const [n, len] = compactFromU8a(u8.subarray(off)); off += n; const out = []; for (let i = 0; i < len.toNumber(); i++) { const [n2, l2] = compactFromU8a(u8.subarray(off)); off += n2; out.push(u8aToHex(u8.subarray(off, off + l2.toNumber()))); off += l2.toNumber(); } return [out, off]; };
const decodeValidity = (u8) => {
  if (u8[0] === 1) { // Err
    const kind = u8[1]; const v = u8[2];
    if (kind === 0) return { ok: false, error: `Invalid::${INVALID[v] ?? v}${v === 7 ? `(${u8[3]})` : ''}` };
    return { ok: false, error: `Unknown::${UNKNOWN[v] ?? v}${v === 2 ? `(${u8[3]})` : ''}` };
  }
  let off = 1; const dv = new DataView(u8.buffer, u8.byteOffset);
  const priority = dv.getBigUint64(off, true); off += 8;
  let requires, provides; [requires, off] = readVecBytes(u8, off); [provides, off] = readVecBytes(u8, off);
  const longevity = dv.getBigUint64(off, true); off += 8; const propagate = u8[off] === 1;
  return { ok: true, priority, requires, provides, longevity, propagate };
};

const [PID, src] = process.argv.slice(2);
if (!PID) { console.error('usage: validate_tx.mjs <project id> [0xhex|file]'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
let hex = src ?? path.join(here, '.last_extrinsic.hex');
if (!hex.startsWith('0x')) { if (!existsSync(hex)) { console.error(`no hex and file not found: ${hex}`); process.exit(2); } hex = readFileSync(hex, 'utf8').trim(); }
console.log(`extrinsic: ${hex.slice(0, 22)}… (${(hex.length - 2) / 2} bytes)`);

const api = await ApiPromise.create({ provider: new HttpProvider(`https://rpc.midnight-mainnet.blockfrost.io?project_id=${PID}`), noInitWarn: true });
try {
  const head = await api.rpc.chain.getHeader();
  const blockHash = await api.rpc.chain.getBlockHash(head.number.toNumber());
  console.log(`validating against block #${head.number} ${blockHash.toHex().slice(0, 18)}…`);
  // validate_transaction(source: TransactionSource, tx: Extrinsic, block_hash: Hash)
  // The hex from author_submitExtrinsic IS the SCALE-encoded extrinsic (length-
  // prefixed), so pass it through byte-for-byte: 0x02 (External) || tx || hash.
  const data = u8aConcat(new Uint8Array([2]), hexToU8a(hex), blockHash.toU8a());
  const raw = await api.rpc.state.call('TaggedTransactionQueue_validate_transaction', u8aToHex(data));
  const u8 = raw.toU8a(true);
  console.log(`raw validity: ${u8aToHex(u8).slice(0, 80)}${u8.length > 40 ? '…' : ''}`);
  const v = decodeValidity(u8);
  if (v.ok) {
    console.log(`\nVALID  priority=${v.priority}  longevity=${v.longevity}  propagate=${v.propagate}`);
    console.log(`  requires (${v.requires.length}): ${v.requires.join(', ') || '-'}`);
    console.log(`  provides (${v.provides.length}): ${v.provides.join(', ') || '-'}`);
    if (v.requires.length) console.log('  -> non-empty `requires`: the tx waits on another tag; if nothing provides it, it sits in the FUTURE queue and is never included.');
    else console.log('  -> runtime says this tx is READY to include right now. If it still is not being included, the problem is propagation (RPC node not gossiping) or block-author policy, not validity.');
  } else {
    console.log(`\nINVALID: ${v.error}  (codes: https://docs.midnight.network/nodes/error-codes)`);
  }
} finally {
  await api.disconnect().catch(() => undefined);
}
