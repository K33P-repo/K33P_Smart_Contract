# NOK Access dApp — Midnight Network Integration

This branch contains the Next of Kin (NOK) Access System implemented on the Midnight Network using Compact smart contracts and zero-knowledge–friendly hashing.

The purpose of this module is to allow a registered NOK to gain controlled access to a user’s account only when the real user has been inactive for 180 days. All validation is enforced on-chain while preserving privacy.

---

## Overview

The system provides a decentralized inactivity-based access mechanism using the Midnight network.

### Key Features
- Compact smart contract that stores:
  - A hash of the registered NOK details.
  - A hash of a proof message indicating “180 days inactivity reached.”
- Privacy-friendly design: no raw personal data ever appears on-chain.
- Node.js backend submits all transactions (users do not interact with wallets).
- Scripts for deployment and contract interaction.

---

## How It Works

### 1. NOK Registration
- The real user provides NOK details (e.g., name, phone, relationship).
- The backend hashes these details and submits the commitment on-chain.
- Only the hash is stored, not the raw data.

### 2. 180-Day Inactivity Proof
- The main application tracks when the real user was last active.
- Once 180 days pass with no activity, the backend submits a proof message:
  
  **"180 days reached, NOK login legal"**
  
- The message is hashed and submitted to the Midnight contract.
- The blockchain verifies the commitment without exposing the message.

### 3. NOK Login Verification
- When the NOK attempts login, the backend:
  - Hashes the NOK’s submitted login data.
  - Submits a login verification transaction.
  - The contract checks:
    - Whether the NOK hash matches the registered commitment.
    - Whether the 180-day inactivity proof hash has been recorded.

- If both checks pass → login is allowed.  
- Otherwise → login fails.

---

## Project Structure


---

## Technology Stack

- Midnight Compact smart contracts  
- Node.js for deployment and interaction  
- TypeScript  
- @midnight-ntwrk/wallet  
- Hashing for privacy-preserving proofs  

---

## Getting Started

Install dependencies:

Build the TypeScript sources:

Deploy the contract:

---

## Privacy Notes

- All personal details are hashed before being written on-chain.
- The 180-day proof message is also hashed.
- The contract only checks hashed commitments; it never sees raw data.

---

## Status

This branch is a standalone module in the K33P ecosystem.  
It will be merged into production after review and integration testing.

---

## Additional Notes

- This branch contains its own documentation for the Midnight integration.
- Future updates will include backend API integration examples.
