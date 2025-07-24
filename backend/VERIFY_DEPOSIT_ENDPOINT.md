# Verify Deposit Endpoint Documentation

## Overview

The `/api/auth/verify-deposit` endpoint has been implemented to handle the 2 ADA deposit verification and refund flow. This endpoint is called **after** a user has:

1. Completed initial signup (without transaction creation)
2. Sent 2 ADA to the smart contract address
3. Wants to verify their deposit and initiate the refund process

## Endpoint Details

**URL:** `POST /api/auth/verify-deposit`

**Authentication:** Required (JWT token)

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "senderWalletAddress": "addr_test1qznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735734"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Deposit verified successfully. Refund will be processed automatically.",
  "txHash": "abc123...",
  "senderWalletAddress": "addr_test1qznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735734"
}
```

**Error Responses:**

- **400 Bad Request:** Missing sender wallet address
- **400 Bad Request:** No valid 2 ADA deposit found
- **401 Unauthorized:** Invalid or missing JWT token
- **404 Not Found:** User not found
- **500 Internal Server Error:** Server error during processing

## Flow Description

### Step 1: Deposit Verification
The endpoint verifies that:
- A transaction exists from the provided `senderWalletAddress`
- The transaction contains exactly 2 ADA sent to the smart contract address
- The transaction is recent (checks last 20 transactions)

### Step 2: Transaction Creation
If the deposit is verified:
- Creates a signup transaction using the user's stored commitment data (phone hash, biometric hash, passkey hash)
- The transaction includes the user's identity data in the datum
- Returns the transaction hash for tracking

### Step 3: User Update
Updates the user record with:
- `senderWalletAddress`: The wallet that sent the 2 ADA
- `txHash`: The transaction hash of the signup transaction
- `verified`: Set to true

### Step 4: Automatic Refund
The auto-refund monitor will:
- Detect the new UTXO at the script address
- Process the refund automatically back to the sender wallet
- Complete the verification flow

## Usage Example

```javascript
// After user sends 2 ADA and provides their wallet address
const response = await fetch('/api/auth/verify-deposit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    senderWalletAddress: 'addr_test1qznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735734'
  })
});

const result = await response.json();
if (result.success) {
  console.log('Deposit verified! Transaction hash:', result.txHash);
  console.log('Refund will be processed automatically');
} else {
  console.error('Verification failed:', result.error);
}
```

## Key Features

1. **Blockchain Verification**: Uses Blockfrost API to verify actual on-chain transactions
2. **Caching**: Results are cached to avoid repeated blockchain queries
3. **Rate Limiting**: Prevents abuse of the verification endpoint
4. **Automatic Refund**: Integrates with the existing auto-refund monitor
5. **Security**: Requires authentication and validates user ownership

## Environment Variables Required

- `SCRIPT_ADDRESS`: The smart contract address where 2 ADA deposits are sent
- `BLOCKFROST_API_KEY`: API key for blockchain queries
- `JWT_SECRET`: For token verification

## Integration with Existing Flow

This endpoint complements the existing signup flow:

1. **Signup** (`/api/auth/signup`): Creates user account (no transaction)
2. **User sends 2 ADA**: User manually sends funds to script address
3. **Verify Deposit** (`/api/auth/verify-deposit`): Verifies deposit and creates transaction
4. **Auto Refund**: Monitor processes refund automatically

This separation ensures that signup is fast and doesn't fail due to blockchain issues, while the verification step handles the actual on-chain interaction.