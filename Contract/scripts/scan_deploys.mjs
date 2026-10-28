// Scan Midnight mainnet blocks around a timestamp for ContractDeploy actions.
const PID = process.argv[2]; const TARGET = Date.parse(process.argv[3] ?? "2026-10-18T23:56:05Z");
const URL = `https://midnight-mainnet.blockfrost.io/api/v0?project_id=${PID}`;
const gql = async (q) => { const r = await fetch(URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }) }); return r.json(); };
const blk = async (h) => (await gql(`{ block(offset:{height:${h}}) { height timestamp transactions { hash contractActions { __typename address } } } }`)).data?.block;
const tip = (await gql(`{ block { height timestamp } }`)).data.block;
console.log(`tip: height=${tip.height} ts=${new Date(Number(tip.timestamp)).toISOString()}`);
// binary search for the block at/after TARGET
let lo = Math.max(1, tip.height - 20000), hi = tip.height, best = tip.height;
while (lo <= hi) { const mid = (lo + hi) >> 1; const b = await blk(mid); if (!b) { hi = mid - 1; continue; }
  if (Number(b.timestamp) >= TARGET) { best = mid; hi = mid - 1; } else lo = mid + 1; }
console.log(`first block at/after target: ${best}`);
const WIN = Number(process.argv[4] ?? 60);
let found = 0;
for (let h = best - 10; h <= best + WIN; h++) { const b = await blk(h); if (!b) continue;
  for (const t of b.transactions ?? []) for (const a of t.contractActions ?? []) {
    if (a.__typename === "ContractDeploy") { found++; console.log(`DEPLOY  block=${h}  ${new Date(Number(b.timestamp)).toISOString()}  tx=${t.hash}  address=${a.address}`); } } }
console.log(found ? `\n${found} ContractDeploy action(s) in window` : `\nno ContractDeploy in blocks ${best-10}..${best+WIN}`);
