#!/usr/bin/env python3
# cNIGHT -> DUST registration diagnostic (Cardano mainnet, no API key; uses the
# public Koios API).
#
# Source: Midnight servicedesk runbook "cnight-dust-duplicate-registration-runbook"
# (midnightntwrk/servicedesk, compiled 2026-09-12). Reproduced here so the K33P
# operator can diagnose "DUST balance reads 0 / DUST stopped generating".
#
# WHY THIS MATTERS: the cNgD pallet requires EXACTLY ONE live registration UTXO per
# Cardano stake key at the mapping validator. 2+ live UTXOs (or 0) => the wallet is
# treated as UNREGISTERED => no DUST, and any DUST fee proof is rejected by the node.
# Accrued DUST is never lost - it lives at the DUST address and resumes once exactly
# one registration exists.
#
# USAGE:  python3 cnight_dust_diag.py stake1...
# Expect "LIVE REGISTRATIONS: 1". Anything else is the problem.
import sys, json, time, datetime, urllib.request

KOIOS = "https://api.koios.rest/api/v1"
MV = "addr1w9e7ft4rrdd4rkdseguxr9hudfxyytm5ckh2qy0yhz7lfeg9lvhq7"  # mapping validator
CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def cb(data, frm, to, pad=True):
    acc = 0; bits = 0; ret = []; maxv = (1 << to) - 1
    for v in data:
        acc = (acc << frm) | v; bits += frm
        while bits >= to:
            bits -= to; ret.append((acc >> bits) & maxv)
    if pad and bits:
        ret.append((acc << (to - bits)) & maxv)
    return ret


def keyhash(a):
    pos = a.rfind('1'); d = [CHARSET.find(c) for c in a[pos + 1:]]
    return bytes(cb(d[:-6], 5, 8, False))[1:29].hex()  # header byte + 28-byte cred


def post(path, payload):
    req = urllib.request.Request(
        KOIOS + path, data=json.dumps(payload).encode(),
        headers={"accept": "application/json", "content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=90))


def datum_fields(h):  # -> (stakeKeyHash, dust_address) best-effort
    m = h.find("d8799f581c"); sc = dust = None
    if m != -1:
        sc = h[m + 10:m + 10 + 56]; rest = h[m + 10 + 56:]
        if rest.startswith("ff"):
            rest = rest[2:]
        if rest.startswith("58"):
            blen = int(rest[2:4], 16); dust = rest[4:4 + blen * 2]
    return sc, dust


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr); sys.exit(2)


if len(sys.argv) < 2:
    die("usage: cnight_dust_diag.py <your REAL stake address, e.g. stake1u9...>")
addr = sys.argv[1].strip()
if not addr.startswith("stake1"):
    die("argument must be a Cardano MAINNET stake address starting with 'stake1'")
# A real mainnet stake address is 59 chars of bech32; the data part uses only the
# bech32 charset. Reject placeholders like 'stake1...' so we never report a
# misleading 'LIVE REGISTRATIONS: 0' against an empty credential.
body = addr[len("stake1"):]
if len(addr) < 50 or any(c not in CHARSET for c in body):
    die("that does not look like a real stake address (did you paste the literal 'stake1...' placeholder?). "
        "Find your stake address in the Cardano wallet you registered cNIGHT from (Lace/Eternl -> staking/"
        "receive), or on cardanoscan.io from any of that wallet's addresses.")

tkh = keyhash(addr)
if len(tkh) != 56:
    die(f"could not derive a 28-byte stake credential from the address (got {len(tkh)} hex chars) - check the address.")
print("credential:", tkh, file=sys.stderr)
seen = {}; off = 0; lim = 1000
while True:  # dedup by (tx,ix): offset paging over a live set can overlap
    rows = post(f"/address_utxos?offset={off}&limit={lim}", {"_addresses": [MV], "_extended": True})
    if not rows:
        break
    for u in rows:
        seen[(u["tx_hash"], u["tx_index"])] = u
    if len(rows) < lim:
        break
    off += lim; time.sleep(0.3)
print("distinct live UTxOs at validator:", len(seen), file=sys.stderr)

m = []
for (tx, ix), u in seen.items():
    inl = u.get("inline_datum"); hx = inl.get("bytes") if isinstance(inl, dict) else None
    if not hx:
        continue
    sc, dust = datum_fields(hx)
    if sc == tkh:
        m.append({"tx": tx, "ix": ix, "block": u.get("block_height"), "time": u.get("block_time"), "dust": dust})
m.sort(key=lambda r: (r["block"] or 0))

refs = [f"{r['tx']}#{r['ix']}" for r in m]; st = {}
if refs:
    for r in post("/utxo_info", {"_utxo_refs": refs, "_extended": False}):
        st[(r["tx_hash"], r["tx_index"])] = r.get("is_spent")  # authoritative unspent check

print(f"\nLIVE REGISTRATIONS: {len(m)}\n")
print("| # | tx_hash#ix | Block | Timestamp (UTC) | dust_address | is_spent |")
print("|---|---|---|---|---|---|")
for i, r in enumerate(m, 1):
    ts = datetime.datetime.utcfromtimestamp(r["time"]).strftime("%Y-%m-%d %H:%M:%S")
    print(f"| {i} | `{r['tx']}#{r['ix']}` | {r['block']} | {ts} | `{r['dust']}` | {st.get((r['tx'], r['ix']))} |")

if len(m) == 1:
    print("\nOK: exactly one live registration. If DUST still reads 0, wait for it to accrue (hours to cap).")
elif len(m) == 0:
    print("\nPROBLEM: zero live registrations -> treated as unregistered -> no DUST. Register ONCE (see runbook).")
else:
    print(f"\nPROBLEM: {len(m)} live registrations (duplicates) -> treated as unregistered -> no DUST.")
    print("Remove duplicates so EXACTLY ONE remains (see runbook: fresh wallet, or targeted de-registration).")
