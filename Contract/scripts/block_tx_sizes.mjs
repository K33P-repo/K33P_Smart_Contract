// What is mainnet actually including? For the last N blocks, print each tx's
// serialized size and contract-action type. If nothing above a certain size
// is ever included, large txs (e.g. a contract deploy) are starving at
// block-authoring time even though the runtime calls them Valid + Ready.
//
//   node scripts/block_tx_sizes.mjs <MIDNIGHT_BLOCKFROST_PROJECT_ID> [blocks=40]
const [PID, N = '40'] = process.argv.slice(2);
const URL = `https://midnight-mainnet.blockfrost.io/api/v0?project_id=${PID}`;
const gql = async (q) => (await (await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }) })).json()).data;
const tip = (await gql(`{ block { height } }`)).block.height;
let maxSize = 0, txCount = 0, deploys = 0; const hist = {};
for (let h = tip; h > tip - Number(N); h--) {
  const b = (await gql(`{ block(offset:{height:${h}}) { height timestamp transactions { hash raw contractActions { __typename address } } } }`))?.block;
  if (!b) continue;
  for (const t of b.transactions ?? []) {
    const size = t.raw ? (t.raw.length - (t.raw.startsWith('0x') ? 2 : 0)) / 2 : 0;
    const kinds = (t.contractActions ?? []).map((a) => a.__typename).join('+') || 'plain';
    txCount++; maxSize = Math.max(maxSize, size); if (kinds.includes('ContractDeploy')) deploys++;
    const bucket = size < 2000 ? '<2KB' : size < 5000 ? '2-5KB' : size < 10000 ? '5-10KB' : size < 20000 ? '10-20KB' : '>20KB';
    hist[bucket] = (hist[bucket] ?? 0) + 1;
    if (size >= 5000 || kinds.includes('Deploy')) console.log(`block ${h}  ${size}B  ${kinds}  ${t.hash.slice(0, 16)}…`);
  }
}
console.log(`\nlast ${N} blocks (to #${tip}): ${txCount} txs, ${deploys} ContractDeploy, largest tx = ${maxSize} bytes`);
console.log('size histogram:', hist);
