// Look up a Midnight transaction on the mainnet indexer by its identifier (the
// `txId` the deploy prints after "Submitted (HTTP RPC)"). Tells you whether a
// submitted deploy actually landed — and prints the contract address if so.
//
//   node scripts/check_tx.mjs <MIDNIGHT_BLOCKFROST_PROJECT_ID> <txId>
const [PID, TXID] = process.argv.slice(2);
if (!PID || !TXID) { console.error("usage: check_tx.mjs <blockfrost project id> <txId>"); process.exit(2); }
const URL = `https://midnight-mainnet.blockfrost.io/api/v0?project_id=${PID}`;
const q = `{ transactions(offset:{identifier:"${TXID}"}) { hash block { height timestamp } contractActions { __typename address } } }`;
let res;
for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    const r = await fetch(URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }) });
    res = await r.json(); break;
  } catch (e) { console.error(`attempt ${attempt}: ${e.cause?.code ?? e.message} (Blockfrost unstable) — retrying…`); await new Promise(s => setTimeout(s, 4000)); }
}
if (!res) { console.error("could not reach the indexer"); process.exit(1); }
if (res.errors) { console.error("indexer error:", JSON.stringify(res.errors)); process.exit(1); }
const txs = res.data?.transactions ?? [];
if (txs.length === 0) { console.log(`NOT FOUND on the indexer: ${TXID}\n(not finalized yet, or dropped after its ~30 min TTL)`); process.exit(0); }
for (const t of txs) {
  console.log(`FOUND  hash=${t.hash}  block=${t.block?.height}  ${t.block ? new Date(Number(t.block.timestamp)).toISOString() : ""}`);
  for (const a of t.contractActions ?? []) console.log(`  ${a.__typename}  address=${a.address}`);
}
