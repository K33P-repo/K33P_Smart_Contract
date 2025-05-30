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

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "e23affa659545e80ae1924d5c1c4781b54a744d91fbd29838dccd7b59d45ee65"
  },
  "message": "Signup processed successfully",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

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

## Integration Notes

1. Users must send exactly 2 ADA to the deposit address to complete signup
2. Transaction verification may take a few minutes depending on blockchain confirmation times
3. The `userId` must be 3-50 characters, alphanumeric and underscores only
4. The `txHash` must be exactly 64 characters