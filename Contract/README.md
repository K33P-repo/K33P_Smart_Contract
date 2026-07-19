# NOK — Next-Of-Kin access registry (Midnight / Compact)

A self-contained Compact smart contract and CLI for the **K33P** identity system.
An admin (the K33P backend) registers a hashed next-of-kin record for a user and
later approves a NOK-initiated login by proving a supplied hash matches.

- **`contract/`** — `@k33p/nok-contract`: the `nok.compact` contract + witnesses
- **`cli/`** — `@k33p/nok-cli`: deploy + admin tooling

Privacy model: the **admin secret** is a private witness that never leaves the
operator machine. The contract stores only the admin **public** key and hashed
records on-chain.

## Quick start

```bash
npm install
npm run compact -w @k33p/nok-contract   # compile the contract (ABI + ZK keys)
npm run build   -w @k33p/nok-contract   # build the TS bindings

npm run deploy  -w @k33p/nok-cli        # deploy to PreProd (default)
npm run admin   -w @k33p/nok-cli        # register / approve / query
```

Target a different network with `NOK_NETWORK=preview`. Point at a proof server
with `PROOF_SERVER_URL`.

## Full guide

See **[NOK-DEPLOYMENT.md](./NOK-DEPLOYMENT.md)** for the compatibility matrix,
ABI, key/secret handling, callable circuits, and K33P integration.

## Using this as its own repo

This folder is a workspace member of the parent project, so it builds and
deploys in place. To split it onto its own branch for K33P:

```bash
git subtree split --prefix=nok-nextofkin -b nok-standalone
```

The two `package.json` files declare their own dependencies, so the folder also
works stand-alone after a local `npm install`.

## Compact version

`nok.compact` targets **Compact language 0.23** (compiler 0.31, runtime 0.16).
The previous `pragma ... <= 0.18.0` upper bound — which blocked compilation on the
current toolchain — has been removed.

## License

Apache-2.0.
