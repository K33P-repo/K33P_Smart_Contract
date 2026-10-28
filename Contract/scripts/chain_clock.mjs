// How far behind wall-clock are mainnet block timestamps? Reads the best head
// straight from the node RPC (no indexer lag) a few times and compares the
// block's timestamp inherent with our local clock.
//
//   node scripts/chain_clock.mjs <MIDNIGHT_BLOCKFROST_PROJECT_ID>
//
// Matters because the ledger validates two things against the block timestamp:
//   - DUST spend declared time (ctime) must be <= tblock          (else 170)
//   - intent ttl must be <= tblock + 3600 s; midnight-js uses now+3600 (else 182)
// If blocks run N seconds behind wall-clock, a tx stamped with "now" is
// N seconds "in the future" for the author that tries to include it.
import { ApiPromise, HttpProvider } from '@polkadot/api';

const [PID] = process.argv.slice(2);
const api = await ApiPromise.create({ provider: new HttpProvider(process.env.RPC_URL ?? `https://rpc.midnight-mainnet.blockfrost.io?project_id=${PID}`), noInitWarn: true });
try {
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const head = await api.rpc.chain.getHeader();
    const block = await api.rpc.chain.getBlock(head.hash);
    const ts = block.block.extrinsics.find((x) => x.method.section === 'timestamp' && x.method.method === 'set');
    const blockMs = ts ? Number(ts.method.args[0].toString()) : NaN;
    const now = Date.now();
    console.log(`#${head.number}  block ts ${new Date(blockMs).toISOString()}  now ${new Date(now).toISOString()}  now-block = ${((now - blockMs) / 1000).toFixed(1)}s  (rpc rtt ${now - t0}ms)`);
    await new Promise((r) => setTimeout(r, 6000));
  }
  console.log('\nA 6s block time means a fresh head is normally 0–6s old (+rtt). Consistently >10s = block timestamps lag wall-clock.');
} finally {
  await api.disconnect().catch(() => undefined);
}
