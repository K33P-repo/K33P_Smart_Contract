# K33P Smart Contract Deposit and Refund Testing

This document provides instructions for testing the deposit and refund functionality of the K33P Smart Contract using the `test-deposit-refund.ts` script.

## Overview

The test script simulates the following processes:

1. **Deposit Test**: Sends 2 ADA to the smart contract with user identity data in the datum
2. **Refund Test**: Retrieves the deposited funds from the smart contract back to the user's wallet

These tests validate that the smart contract correctly handles the deposit and refund logic as defined in the `validate_signup_refund` function in the Aiken validator.

## Prerequisites

Before running the tests, ensure you have:

1. Node.js v18+ installed
2. A Blockfrost API key for the Cardano Preprod testnet
3. The private keys for both the test wallet and backend wallet
4. Sufficient test ADA in your test wallet (at least 5 ADA)

## Configuration

1. Make sure your `.env` file is properly configured with:

```
BLOCKFROST_API_KEY=your_blockfrost_api_key
NETWORK=Preprod
```

2. Ensure the following files exist:
   - `../../payment.skey` - Private key for the test wallet
   - `../../backend.skey` - Private key for the backend wallet
   - `../plutus.json` - Compiled Plutus script

## Running the Tests

You can run the tests in three different ways:

### 1. Run Both Deposit and Refund Tests

```bash
npm run test:deposit-refund
```

This will:
- Create a deposit transaction
- Wait 60 seconds for confirmation
- Create a refund transaction

### 2. Run Only the Deposit Test

```bash
npm run test:deposit
```

This will create a deposit transaction and save the details to `deposit-details.json`.

### 3. Run Only the Refund Test

```bash
npm run test:refund
```

This will read the deposit details from `deposit-details.json` and create a refund transaction.

## Test Output

The test script will output detailed information about each transaction, including:

- Transaction hash
- Script address
- Wallet address
- Amount deposited/refunded
- Links to view the transactions on Cardanoscan

The script also saves transaction details to:
- `deposit-details.json` - Details of the deposit transaction
- `refund-details.json` - Details of the refund transaction

## Troubleshooting

### Common Issues

1. **"BLOCKFROST_API_KEY not set in environment"**
   - Ensure your `.env` file contains a valid Blockfrost API key

2. **"Private key file not found"**
   - Check that the payment.skey and backend.skey files exist in the correct locations

3. **"UTXO from deposit transaction not found"**
   - The deposit transaction may not be confirmed yet. Wait longer before running the refund test
   - The UTXO may have already been spent. Check if a refund has already been processed

4. **"No deposit details found"**
   - Run the deposit test first before running the refund test

## Smart Contract Validation

The test validates the following conditions from the smart contract:

```aiken
// ✨ SIGNUP REFUND VALIDATION
fn validate_signup_refund(tx: Transaction, wallet: Address) -> Bool {
  let paid_input =
    list.any(
      tx.inputs,
      fn(input) {
        input.output.address == wallet && get_lovelace_amount(input.output) >= refund_amount
      },
    )

  let refunded_output =
    list.any(
      tx.outputs,
      fn(output) {
        output.address == wallet && get_lovelace_amount(output) == refund_amount
      },
    )

  paid_input && refunded_output
}
```

This ensures that:
1. The transaction includes an input from the user's wallet with at least the refund amount
2. The transaction includes an output to the user's wallet with exactly the refund amount

## Security Considerations

- The test script uses private keys. Never use production keys in test environments.
- The script is designed for the Preprod testnet only. Do not use on mainnet.
- The test deposits a small amount (2 ADA). Adjust as needed but keep it minimal for testing.