# K33P Backend API Documentation

This document provides information about the available API endpoints for the K33P Identity System backend server.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Some endpoints require an admin API key which should be included in the request headers:

```
X-API-KEY: k33p_admin_api_key_12345
```

## Public Endpoints

### Health Check

```
GET /health
```

Returns the health status of the service.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 123.45
  },
  "message": "Service is running",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Get Deposit Address

```
GET /deposit-address
```

Returns the Cardano address where users should send their deposit.

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "addr_test1..."
  },
  "message": "Deposit address retrieved",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Record Signup

```
POST /signup
```

Records a new user signup with transaction verification.

**Request Body:**
```json
{
  "userAddress": "addr_test1...",
  "userId": "username123",
  "phoneNumber": "1234567890",
  "senderWalletAddress": "addr_test1...",
  "pin": "1234",
  "biometricData": "base64encodedbiometricdata",
  "verificationMethod": "biometric",
  "biometricType": "fingerprint"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userAddress | string | Yes | User's wallet address |
| userId | string | Yes | User's chosen ID (3-50 alphanumeric characters) |
| phoneNumber | string | Yes | User's phone number (min 10 digits) |
| senderWalletAddress | string | Yes | Wallet address that sent the deposit |
| pin | string | No | 4-digit PIN for PIN verification method |
| biometricData | string | No | Biometric data for biometric verification method |
| verificationMethod | string | No | Verification method: 'phone', 'pin', or 'biometric' (default: 'phone') |
| biometricType | string | No | The specific biometric method used. Can be 'fingerprint', 'faceid', 'voice', or 'iris'. Required when verificationMethod is 'biometric' |

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "userId": "username123",
    "verificationMethod": "pin",
    "message": "Signup verified successfully"
  },
  "message": "Signup processed successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Retry Verification

```
POST /retry-verification
```

Retries verification for a user whose transaction was not initially verified.

**Request Body:**
```json
{
  "userAddress": "addr_test1..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true
  },
  "message": "Verification successful",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Get User Status

```
GET /user/:address/status
```

Returns the status of a user's signup process.

**Parameters:**
- `address`: The Cardano address of the user

**Response:**
```json
{
  "success": true,
  "data": {
    "userAddress": "addr_test1...",
    "userId": "username123",
    "verified": true,
    "signupCompleted": false,
    "refunded": false,
    "txHash": "e23affa659545e80ae1924d5c1c4781b54a744d91fbd29838dccd7b59d45ee65",
    "amount": "2.000000",
    "timestamp": "2023-06-01T12:34:56.789Z",
    "verificationAttempts": 1
  },
  "message": "User status retrieved",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

## Admin Endpoints

These endpoints require the `X-API-KEY` header.

### Get All Users

```
GET /admin/users
```

Returns a list of all users in the system.

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userAddress": "addr_test1...",
        "userId": "username123",
        "verified": true,
        "signupCompleted": false,
        "refunded": false,
        "txHash": "e23affa659545e80ae1924d5c1c4781b54a744d91fbd29838dccd7b59d45ee65",
        "amount": "2.000000",
        "timestamp": "2023-06-01T12:34:56.789Z",
        "verificationAttempts": 1
      }
    ],
    "total": 1
  },
  "message": "Users retrieved",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Auto-Verify All Unverified Deposits

```
POST /admin/auto-verify
```

Triggers automatic verification of all unverified deposits.

**Response:**
```json
{
  "success": true,
  "message": "Auto-verification completed",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Monitor Incoming Transactions

```
GET /admin/monitor
```

Triggers monitoring of incoming transactions to the deposit address.

**Response:**
```json
{
  "success": true,
  "message": "Transaction monitoring completed",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Process Signup Completion

```
POST /admin/process-signup
```

Processes the completion of a user's signup.

**Request Body:**
```json
{
  "userAddress": "addr_test1..."
}
```

### Immediate Refund

```
POST /refund
```

Processes an immediate refund for a user's deposit.

**Request Body:**
```json
{
  "userAddress": "addr_test1...",
  "walletAddress": "addr_test1..." // Optional
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userAddress | string | Yes | User's wallet address that made the deposit |
| walletAddress | string | No | Wallet address where the refund should be sent. If not provided, the refund will be sent to the userAddress |

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "e23affa659545e80ae1924d5c1c4781b54a744d91fbd29838dccd7b59d45ee65"
  },
  "message": "Refund processed successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

**Error Responses:**
- `400`: Bad Request - Deposit already refunded or verification failed
- `404`: Not Found - No deposit found for the provided address
- `500`: Internal Server Error - Failed to process refund

## Error Responses

All endpoints return a standardized error format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

Common HTTP status codes:
- `400`: Bad Request - Invalid input parameters
- `401`: Unauthorized - Missing or invalid API key
- `404`: Not Found - Resource not found
- `500`: Internal Server Error - Server-side error

## OTP Authentication Endpoints

### Send OTP

```
POST /api/otp/send
```

Sends a one-time password to the provided phone number.

**Request Body:**
```json
{
  "phoneNumber": "1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requestId": "verification_request_id"
  },
  "message": "Verification code sent",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Verify OTP

```
POST /api/otp/verify
```

Verifies the OTP code sent to a phone number.

**Request Body:**
```json
{
  "requestId": "verification_request_id",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true
  },
  "message": "Phone number verified successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Cancel Verification

```
POST /api/otp/cancel
```

Cancels an ongoing verification process.

**Request Body:**
```json
{
  "requestId": "verification_request_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification cancelled successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### Verify Firebase Token

```
POST /api/otp/verify-token
```

Verifies a Firebase ID token from a mobile app.

**Request Body:**
```json
{
  "idToken": "firebase_id_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uid": "firebase_user_id",
    "phoneNumber": "1234567890",
    "verified": true
  },
  "message": "Firebase token verified successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

## Zero-Knowledge Proof Endpoints

### Generate ZK Commitment

```
POST /api/zk/commitment
```

Generates a Zero-Knowledge commitment from hashed values.

**Request Body:**
```json
{
  "phone": "1234567890",
  "biometric": "base64encodedbiometricdata",
  "passkey": "user_passkey"
}
```

**Response:**
```json
{
  "commitment": "zk_commitment_hash",
  "hashes": {
    "phoneHash": "hashed_phone",
    "biometricHash": "hashed_biometric",
    "passkeyHash": "hashed_passkey"
  }
}
```

### Generate ZK Proof

```
POST /api/zk/proof
```

Generates a Zero-Knowledge proof.

**Request Body:**
```json
{
  "phone": "1234567890",
  "biometric": "base64encodedbiometricdata",
  "passkey": "user_passkey",
  "commitment": "zk_commitment_hash"
}
```

**Response:**
```json
{
  "proof": "zk_proof_data",
  "isValid": true
}
```

### Verify ZK Proof

```
POST /api/zk/verify
```

Verifies a Zero-Knowledge proof.

**Request Body:**
```json
{
  "proof": "zk_proof_data",
  "commitment": "zk_commitment_hash"
}
```

**Response:**
```json
{
  "isValid": true
}
```

### ZK Login

```
POST /api/zk/login
```

Logs in a user using Zero-Knowledge proof.

**Request Body:**
```json
{
  "walletAddress": "addr_test1...",
  "phone": "1234567890",
  "proof": "zk_proof_data",
  "commitment": "zk_commitment_hash"
}
```

**Response:**
```json
{
  "message": "ZK login successful",
  "userId": "user_id"
}
```

## UTXO Management Endpoints

### Fetch UTXOs by Phone Hash

```
GET /api/utxo/fetch/:phoneHash
```

Fetches UTXOs at the script address by phone hash.

**Parameters:**
- `phoneHash`: The hashed phone number

**Response:**
```json
[
  {
    "txHash": "transaction_hash",
    "outputIndex": 0,
    "amount": "2000000",
    "datum": { ... }
  }
]
```

### Issue Refund

```
POST /api/utxo/refund
```

Issues a refund for a UTXO.

**Request Body:**
```json
{
  "utxo": {
    "txHash": "transaction_hash",
    "outputIndex": 0
  },
  "ownerAddress": "addr_test1...",
  "zkProof": {
    "proof": "zk_proof_data",
    "isValid": true
  }
}
```

**Response:**
```json
{
  "message": "Refund issued successfully",
  "txHash": "refund_transaction_hash"
}
```

### Track UTXO

```
POST /api/utxo/track
```

Tracks a new UTXO in the database.

**Request Body:**
```json
{
  "txHash": "transaction_hash",
  "outputIndex": 0,
  "datum": { ... }
}
```

**Response:**
```json
{
  "message": "UTXO tracked successfully",
  "scriptUtxo": { ... }
}
```

### Get User UTXOs

```
GET /api/utxo/user
```

Gets all UTXOs for the current user.

**Response:**
```json
[
  {
    "txHash": "transaction_hash",
    "outputIndex": 0,
    "datum": { ... },
    "userId": "user_id",
    "refunded": false
  }
]
```

## Authentication Endpoints

### User Signup

```
POST /api/auth/signup
```

Registers a new user with the system.

**Request Body:**
```json
{
  "userId": "user_id",
  "walletAddress": "addr_test1...",
  "phoneNumber": "1234567890",
  "commitment": "zk_commitment_hash"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "jwt_token",
  "user": {
    "userId": "user_id",
    "walletAddress": "addr_test1...",
    "phoneHash": "hashed_phone"
  }
}
```

### User Login

```
POST /api/auth/login
```

Logs in a user with a ZK proof.

**Request Body:**
```json
{
  "walletAddress": "addr_test1...",
  "phone": "1234567890",
  "proof": "zk_proof_data",
  "commitment": "zk_commitment_hash"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token",
  "user": {
    "userId": "user_id",
    "walletAddress": "addr_test1...",
    "phoneHash": "hashed_phone"
  }
}
```

### User Logout

```
POST /api/auth/logout
```

Logs out the current user.

**Response:**
```json
{
  "message": "Logout successful"
}
```

### Get Current User

```
GET /api/auth/me
```

Returns information about the currently authenticated user.

**Response:**
```json
{
  "userId": "user_id",
  "walletAddress": "addr_test1...",
  "phoneHash": "hashed_phone",
  "commitment": "zk_commitment_hash"
}
```

### Verify Wallet

```
POST /api/auth/verify-wallet
```

Verifies a wallet address and 2 ADA transaction.

**Request Body:**
```json
{
  "walletAddress": "addr_test1..."
}
```

**Response:**
```json
{
  "message": "Wallet verified successfully"
}
```

### Wallet Connect

```
GET /api/auth/wallet-connect
```

Returns the wallet address for the authenticated user.

**Response:**
```json
{
  "walletAddress": "addr_test1..."
}
```

## Authentication Requirements

Many endpoints require authentication. To authenticate requests, include the JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

The following endpoints require authentication:
- All `/api/utxo/*` endpoints
- `/api/auth/me`
- `/api/auth/logout`
- `/api/auth/wallet-connect`
- `/api/zk/user/:userId`

## Rate Limiting

Some endpoints implement rate limiting to prevent abuse:

- `/api/auth/verify-wallet`: Limited to 5 requests per 15 minutes per IP address
- `/api/otp/send`: Limited to 3 requests per hour per phone number

## Integration Notes

1. Users must send exactly 2 ADA to the deposit address to complete signup
2. Transaction verification may take a few minutes depending on blockchain confirmation times
3. The `userId` must be 3-50 characters, alphanumeric and underscores only
4. The `txHash` must be exactly 64 characters
5. The `phoneNumber` must be 10-15 characters, numeric only
6. Phone numbers should be in E.164 format (e.g., +12345678900)
7. ZK proofs are required for secure authentication and UTXO refunds
8. Wallet verification checks for a 2 ADA transaction within the last 10 transactions
9. OTP verification is required for the first login of a new user
10. Firebase authentication can be used as an alternative to OTP verification
