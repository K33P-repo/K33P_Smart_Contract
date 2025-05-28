# K33P Decentralized Identity System

## Overview

This project implements a decentralized identity (DID) system on the Cardano blockchain using Aiken smart contracts. The system allows users to sign up and log in by locking 2 ADA into a smart contract. Their biometric, passkey, and phone data is hashed off-chain and stored on-chain as datum. Only an authorized backend can refund the stake. Zero-knowledge proofs (ZKPs) ensure that login credentials match previously committed data without revealing them.

## Architecture

The system consists of the following components:

1. **Smart Contract (Aiken)** - Validator for signup & refund
2. **Frontend Integration** - Using Lucid SDK for wallet connection
3. **Backend API** - Express/Prisma for handling API endpoints
4. **Zero-Knowledge Proof Integration** - Off-chain ZK library
5. **Database** - PostgreSQL for user and session management

## Smart Contract Structure

```aiken
type IdentityDatum {
  phone_hash: ByteArray,
  biometric_hash: ByteArray,
  passkey_hash: ByteArray,
}

validator {
  fn validate_identity(datum: IdentityDatum, redeemer: IdentityRedeemer, ctx: ScriptContext) -> Bool {
    // Validation logic for identity management
  }
}
```

## Project Organization

- `validators/` - Contains the Aiken validators for identity management
- `lib/` - Supporting functions and utilities
- `tests/` - Test cases for the smart contracts

## Building

```sh
aiken build
```

## Testing

You can run the tests with:

```sh
aiken check
```

To run specific tests:

```sh
aiken check -m identity
```

## Frontend Integration

The frontend uses Lucid SDK to interact with the Cardano blockchain:

- Connect user wallets
- Create transactions for signup (locking 2 ADA)
- Handle user authentication with ZK proofs

## Backend API

The backend provides the following endpoints:

- `/fetch-utxo` - Fetch UTXOs at script address
- `/refund` - Issue refund (must be backend-signed)
- `/verify-zk-login` - Verify ZK proof for login

## Zero-Knowledge Proof Integration

The system uses zero-knowledge proofs to verify user identity without revealing sensitive information:

- Generate commitment of hashed values during signup
- Generate ZK proof of knowledge during login
- Verify proofs on the backend

## Database Schema

**Users Table:**
- id | wallet_address | phone_hash | biometric_hash | passkey_hash | zk_commitment

**Sessions Table:**
- id | wallet_address | firebase_token | expires_at

## Security Considerations

- All sensitive data is hashed before being stored on-chain
- Zero-knowledge proofs ensure privacy during authentication
- Only authorized backend can refund stakes
- 2 ADA stake requirement prevents spam accounts
