# NOK (Next-Of-Kin) Backend Integration

The K33P backend is the **admin** of the deployed Midnight NOK contract. It holds
the admin secret + funding wallet seed and submits `register` / `approve` calls
on a user's behalf. Mobile talks to the backend; only the backend touches the
contract.

## Architecture

```
keepmobile (NOK screens)
        │  HTTP  /api/nok/*
        ▼
backend/src/routes/nok-routes.ts
        │
        ▼
backend/src/services/nok-service.ts
        │  imports COMPILED build output (reference-only)
        ▼
@k33p/nok-cli  (Contract/cli/dist)  ──▶  Midnight NOK contract (preview)
```

The `Contract/` folder is **reference-only**: the backend depends on it via
`"@k33p/nok-cli": "file:../Contract/cli"` and imports its `dist/` build output.
No NOK integration code lives in the contract repo.

## Endpoints

| Method | Path | Auth | Body / Params | Purpose |
|--------|------|------|---------------|---------|
| POST | `/api/nok/register` | Bearer | `{ nokIdentifier }` (owner = token user) | Register a next-of-kin (`register_nok`) |
| POST | `/api/nok/approve-login` | public | `{ userId, nokIdentifier }` | Approve a NOK login (`approve_nok_login`) |
| GET | `/api/nok/check/:userId` | public | — | Is a NOK registered? (`check_nok_registered`) |
| GET | `/api/nok/state` | Bearer | — | Contract ledger state (admin pubkey, round, count) |

- `userId` — the stable K33P user id → `owner_identifier = ownerIdentifierToField(userId)`.
- `nokIdentifier` — the NOK's phone/email/id → `nok_hash = nokHashToField(nokIdentifier)`.
- Hashing is deterministic (SHA-256 → BLS12-381 field), so approve recomputes and matches register.

## Environment variables

Add to `backend/.env` (git-ignored):

```bash
# NOK / Midnight
NOK_NETWORK=preview                       # preview | preprod | standalone (default preview)
NOK_CONTRACT_ADDRESS=0ac8f33d66eff6e6b7e70ed32168477badc85de940ef1d117ca2416569de0373
NOK_ADMIN_SECRET=<64-hex admin secret>    # from Contract/cli/nok-deployment.json — move to a vault
NOK_WALLET_SEED=<hex funding wallet seed> # funded preview wallet; required for register/approve
PROOF_SERVER_URL=http://127.0.0.1:6300    # local proof server
```

> ⚠️ **Security:** the reused preview `adminSecret` is currently committed in
> `Contract/nok_compact_deployment.md` — treat it as compromised. For production,
> rotate it (redeploy with a fresh secret) and load it only from a secret vault.

## One-time build (generates the referenced dist output)

```bash
# from Contract/
npm install
npm run build:all              # compiles nok.compact + builds @k33p/nok-contract
npm run build -w @k33p/nok-cli # builds Contract/cli/dist (what the backend imports)

# from backend/
npm install                    # links @k33p/nok-cli via the file: dependency
```

## Proof server (required for write circuits)

```bash
docker run -p 6300:6300 midnightntwrk/proof-server -- \
  'midnight-proof-server --network preview'
```

## Manual test

```bash
# check (public)
curl http://localhost:3501/api/nok/check/k33p-user-123

# register (auth)
curl -X POST http://localhost:3501/api/nok/register \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"nokIdentifier":"+15551234567"}'

# approve-login (public)
curl -X POST http://localhost:3501/api/nok/approve-login \
  -H "Content-Type: application/json" \
  -d '{"userId":"k33p-user-123","nokIdentifier":"+15551234567"}'
```

## Notes / limitations

- First request triggers a wallet sync + contract join (slow); the joined
  contract is then cached for the process lifetime.
- Reads (`check`, `state`) still initialise the wallet context; if you need
  truly wallet-less reads, add a read-only provider path in `nok-service.ts`.
- The service targets **preview** by default to match the existing deployment.
