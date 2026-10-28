// Derive stake1 from an addr1q base address, then count live cNIGHT->DUST
// registrations for that stake credential (port of the servicedesk runbook).
const ADDR = process.argv[2];
const KOIOS = "https://api.koios.rest/api/v1";
const MV = "addr1w9e7ft4rrdd4rkdseguxr9hudfxyytm5ckh2qy0yhz7lfeg9lvhq7";
const CS = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const polymod = (v) => { let c = 1; for (const x of v) { const b = c >> 25; c = ((c & 0x1ffffff) << 5) ^ x;
  for (let i = 0; i < 5; i++) if ((b >> i) & 1) c ^= [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3][i]; } return c; };
const hrpExpand = (h) => [...[...h].map(c => c.charCodeAt(0) >> 5), 0, ...[...h].map(c => c.charCodeAt(0) & 31)];
const conv = (data, from, to, pad) => { let acc = 0, bits = 0; const out = []; const max = (1 << to) - 1;
  for (const v of data) { acc = (acc << from) | v; bits += from; while (bits >= to) { bits -= to; out.push((acc >> bits) & max); } }
  if (pad && bits) out.push((acc << (to - bits)) & max); return out; };
const b32decode = (s) => { const p = s.lastIndexOf("1"); const hrp = s.slice(0, p); const d = [...s.slice(p + 1)].map(c => CS.indexOf(c));
  return { hrp, bytes: Uint8Array.from(conv(d.slice(0, -6), 5, 8, false)) }; };
const b32encode = (hrp, bytes) => { const d = conv([...bytes], 8, 5, true); const pm = polymod([...hrpExpand(hrp), ...d, 0,0,0,0,0,0]) ^ 1;
  const chk = []; for (let i = 0; i < 6; i++) chk.push((pm >> (5 * (5 - i))) & 31); return hrp + "1" + [...d, ...chk].map(x => CS[x]).join(""); };
const hex = (u) => [...u].map(b => b.toString(16).padStart(2, "0")).join("");

if (!ADDR || !ADDR.startsWith("addr1")) { console.error("usage: diag.mjs addr1q..."); process.exit(2); }
const { bytes } = b32decode(ADDR);
const type = bytes[0] >> 4, net = bytes[0] & 15;
console.log(`address header: type=${type} network=${net === 1 ? "mainnet" : net} len=${bytes.length}`);
if (type !== 0 || bytes.length !== 57) { console.error("not a type-0 base address with an embedded stake key hash"); process.exit(2); }
const stakeHash = bytes.slice(29, 57);
const stakeAddr = b32encode("stake", Uint8Array.from([0xe1, ...stakeHash]));
const cred = hex(stakeHash);
console.log(`stake address : ${stakeAddr}`);
console.log(`stake cred    : ${cred}`);

const post = async (path, body) => (await fetch(KOIOS + path, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const datumFields = (h) => { const m = h.indexOf("d8799f581c"); if (m < 0) return [null, null]; const sc = h.slice(m + 10, m + 66); let rest = h.slice(m + 66);
  if (rest.startsWith("ff")) rest = rest.slice(2); let dust = null; if (rest.startsWith("58")) { const n = parseInt(rest.slice(2, 4), 16); dust = rest.slice(4, 4 + n * 2); } return [sc, dust]; };

const seen = new Map(); let off = 0; const lim = 1000;
for (;;) { const rows = await post(`/address_utxos?offset=${off}&limit=${lim}`, { _addresses: [MV], _extended: true });
  if (!Array.isArray(rows) || rows.length === 0) break; for (const u of rows) seen.set(`${u.tx_hash}#${u.tx_index}`, u);
  if (rows.length < lim) break; off += lim; await new Promise(r => setTimeout(r, 300)); }
console.log(`distinct live UTxOs at validator: ${seen.size}`);
const m = [];
for (const [ref, u] of seen) { const hx = u.inline_datum && typeof u.inline_datum === "object" ? u.inline_datum.bytes : null; if (!hx) continue;
  const [sc, dust] = datumFields(hx); if (sc === cred) m.push({ ref, block: u.block_height, time: u.block_time, dust }); }
m.sort((a, b) => (a.block ?? 0) - (b.block ?? 0));
let spent = {}; if (m.length) { const info = await post("/utxo_info", { _utxo_refs: m.map(r => r.ref), _extended: false });
  for (const r of info) spent[`${r.tx_hash}#${r.tx_index}`] = r.is_spent; }
console.log(`\nLIVE REGISTRATIONS: ${m.length}\n`);
for (const r of m) console.log(`  ${r.ref}  block=${r.block}  ${new Date(r.time * 1000).toISOString()}  dust=${r.dust}  is_spent=${spent[r.ref]}`);
