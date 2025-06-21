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

## Error Handling

All API endpoints follow a consistent error handling pattern. When an error occurs, the response will have the following structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

Common error codes include:

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| INVALID_INPUT | 400 | The request contains invalid or missing parameters |
| UNAUTHORIZED | 401 | Authentication is required or the provided credentials are invalid |
| FORBIDDEN | 403 | The authenticated user does not have permission to access the resource |
| NOT_FOUND | 404 | The requested resource was not found |
| CONFLICT | 409 | The request conflicts with the current state of the resource |
| INTERNAL_ERROR | 500 | An unexpected error occurred on the server |
| SERVICE_UNAVAILABLE | 503 | The service is temporarily unavailable (e.g., Iagon API is down) |
| ZK_VERIFICATION_FAILED | 401 | Zero-Knowledge proof verification failed |

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
  "message": "Users retrieved successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

## Firebase Authentication

### Verify Firebase Token

```
POST /api/auth/verify-firebase-token
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

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | Yes | User's phone number |
| biometric | string | Yes | User's biometric data (base64 encoded) |
| passkey | string | Yes | User's passkey or password |

**Response:**
```json
{
  "success": true,
  "data": {
    "commitment": "zk_commitment_hash",
    "hashes": {
      "phoneHash": "hashed_phone",
      "biometricHash": "hashed_biometric",
      "passkeyHash": "hashed_passkey"
    }
  },
  "message": "ZK commitment generated successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

**Error Responses:**

- `400 Bad Request`: If any required parameters are missing or invalid
- `500 Internal Server Error`: If there's an error generating the commitment

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

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | Yes | User's phone number |
| biometric | string | Yes | User's biometric data (base64 encoded) |
| passkey | string | Yes | User's passkey or password |
| commitment | string | Yes | The ZK commitment to prove against |

**Response:**
```json
{
  "success": true,
  "data": {
    "proof": "zk_proof_data",
    "publicInputs": {
      "commitment": "zk_commitment_hash"
    },
    "isValid": true
  },
  "message": "ZK proof generated successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

**Error Responses:**

- `400 Bad Request`: If any required parameters are missing or invalid
- `401 Unauthorized`: If the generated proof is invalid
- `500 Internal Server Error`: If there's an error generating the proof

### Verify ZK Proof

```
POST /api/zk/verify
```

Verifies a Zero-Knowledge proof.

**Request Body:**
```json
{
  "proof": {
    "proof": "zk_proof_data",
    "publicInputs": {
      "commitment": "zk_commitment_hash"
    },
    "isValid": true
  },
  "commitment": "zk_commitment_hash"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| proof | object | Yes | The ZK proof object |
| proof.proof | string | Yes | The proof data |
| proof.publicInputs | object | Yes | Public inputs for the proof |
| proof.publicInputs.commitment | string | Yes | The commitment in the proof |
| proof.isValid | boolean | Yes | Whether the proof is valid |
| commitment | string | Yes | The ZK commitment to verify against |

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true
  },
  "message": "ZK proof verified successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

**Error Responses:**

- `400 Bad Request`: If any required parameters are missing or invalid
- `401 Unauthorized`: If the proof verification fails
- `500 Internal Server Error`: If there's an error verifying the proof

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
  "proof": {
    "proof": "zk_proof_data",
    "publicInputs": {
      "commitment": "zk_commitment_hash"
    },
    "isValid": true
  },
  "commitment": "zk_commitment_hash"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| walletAddress | string | No | User's wallet address (required if phone is not provided) |
| phone | string | No | User's phone number (required if walletAddress is not provided) |
| proof | object | Yes | The ZK proof object |
| proof.proof | string | Yes | The proof data |
| proof.publicInputs | object | Yes | Public inputs for the proof |
| proof.publicInputs.commitment | string | Yes | The commitment in the proof |
| proof.isValid | boolean | Yes | Whether the proof is valid |
| commitment | string | Yes | The ZK commitment to verify against |

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "ZK login successful",
    "userId": "user_id",
    "token": "jwt_token"
  },
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

**Error Responses:**

- `400 Bad Request`: If any required parameters are missing or invalid
- `401 Unauthorized`: If the proof verification fails
- `404 Not Found`: If the user is not found
- `500 Internal Server Error`: If there's an error during login or if the Iagon API is unavailable

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
{
  "success": true,
  "data": [
    {
      "txHash": "transaction_hash",
      "outputIndex": 0,
      "amount": "2000000",
      "datum": { ... }
    }
  ],
  "message": "UTXOs retrieved successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

**Error Responses:**

- `400 Bad Request`: If the phone hash is invalid
- `404 Not Found`: If no UTXOs are found
- `500 Internal Server Error`: If there's an error fetching UTXOs or if the Iagon API is unavailable

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
    "publicInputs": {
      "commitment": "zk_commitment_hash"
    },
    "isValid": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Refund issued successfully",
    "txHash": "refund_transaction_hash"
  },
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

## Iagon API Integration

The K33P backend integrates with the Iagon API for user management, session management, and UTxO tracking. The integration is designed to be fault-tolerant with the following features:

1. **Automatic Fallback to Mock Implementation**: If the Iagon API is unavailable or not configured, the system automatically falls back to a local mock implementation to ensure the application continues to function.

2. **Robust Error Handling**: All API calls include comprehensive error handling to prevent API failures from breaking the application.

3. **Input Validation**: All inputs are validated before being sent to the Iagon API to prevent invalid requests.

4. **Timeout Management**: API calls have configurable timeouts to prevent hanging requests.

5. **Logging**: Detailed logging of API interactions for debugging and monitoring.

The Iagon API integration is configured using the following environment variables:

- `IAGON_API_URL`: The base URL of the Iagon API (e.g., `https://api.iagon.com`)
- `IAGON_API_KEY`: The API key for authenticating with the Iagon API

If these environment variables are not set or if the URL is invalid, the system will automatically use the mock implementation.
