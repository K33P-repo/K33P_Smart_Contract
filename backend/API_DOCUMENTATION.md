# K33P Backend API Documentation

This document provides comprehensive information about the available API endpoints for the K33P Identity System backend server.

## Base URL

**Development:**
```
http://localhost:3001/api
```

**Production:**
```
https://k33p-backend-0kyx.onrender.com/api
```

## Authentication

### JWT Token Authentication

Most endpoints require JWT authentication. Include the access token in the Authorization header:

```
Authorization: Bearer your_jwt_access_token
```

### Admin API Key

Admin endpoints require an admin API key in the request headers:

```
X-API-KEY: k33p_admin_api_key_12345
```

## Error Handling

All API endpoints follow a consistent error handling pattern:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-25T12:34:56.789Z"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| INVALID_INPUT | 400 | Invalid or missing parameters |
| UNAUTHORIZED | 401 | Authentication required or invalid credentials |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| WALLET_IN_USE | 400 | Wallet address already registered |
| INTERNAL_ERROR | 500 | Server error |

---

## System Endpoints

### Health Check

**Endpoint:** `GET /api/health`  
**Authentication:** None  
**Description:** Check system health status

**Response (200):**
```json
{
  "success": true,
  "message": "System is healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-25T10:00:00Z",
    "uptime": 86400
  }
}
```

### System Status

**Endpoint:** `GET /api/status`  
**Authentication:** None  
**Description:** Get system statistics

**Response (200):**
```json
{
  "success": true,
  "message": "System status retrieved",
  "data": {
    "totalUsers": 1250,
    "systemLoad": "normal",
    "maintenanceMode": false
  }
}
```

### API Version

**Endpoint:** `GET /api/version`  
**Authentication:** None  
**Description:** Get API version information

**Response (200):**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "buildDate": "2024-01-25",
    "environment": "production"
  }
}
```

### Get Deposit Address

**Endpoint:** `GET /api/deposit-address`  
**Authentication:** None  
**Description:** Get the deposit address for 2 ADA verification

**Response (200):**
```json
{
  "success": true,
  "data": {
    "address": "addr_test1qztest123456789abcdef",
    "network": "preprod"
  },
  "message": "Deposit address retrieved"
}
```

---

## Authentication Endpoints

### User Signup

**Endpoint:** `POST /api/auth/signup`  
**Authentication:** None  
**Description:** Register a new user with ZK proof verification

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "userId": "user_12345",
  "userAddress": "addr_test1qztest123456789abcdef",
  "senderWalletAddress": "addr_test1qxyz...",
  "pin": "1234",
  "biometricData": "biometric_hash",
  "verificationMethod": "phone",
  "biometricType": "fingerprint",
  "passkey": "user_passkey"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "verified": false,
    "userId": "user_12345",
    "verificationMethod": "phone",
    "message": "DID created successfully. Welcome to K33P!",
    "depositAddress": "addr_test1qztest123456789abcdef"
  },
  "message": "DID created successfully. Welcome to K33P!",
  "token": "jwt_token_here"
}
```

**Existing User Response (200):**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "userId": "existing_user_123",
    "verificationMethod": "phone",
    "message": "User account updated successfully. Your refund has been processed.",
    "depositAddress": "addr_test1qztest123456789abcdef",
    "isUpdate": true
  },
  "message": "User account updated successfully. Your refund has been processed.",
  "token": "jwt_token_here"
}
```

**Wallet In Use Error (400):**
```json
{
  "success": false,
  "error": "This wallet address is already registered with another account. Please use a different wallet or contact support if this is your wallet.",
  "code": "WALLET_IN_USE"
}
```

### User Login

**Endpoint:** `POST /api/auth/login`  
**Authentication:** None  
**Description:** Login with ZK proof verification

**Request Body:**
```json
{
  "walletAddress": "addr_test1qztest123456789abcdef",
  "phone": "+1234567890",
  "proof": "zk_proof_data",
  "commitment": "zk_commitment_hash"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "hasWallet": true
}
```

### User Logout

**Endpoint:** `POST /api/auth/logout`  
**Authentication:** JWT Required  
**Description:** Logout and invalidate session

**Response (200):**
```json
{
  "message": "Logout successful"
}
```

### Get Current User

**Endpoint:** `GET /api/auth/me`  
**Authentication:** JWT Required  
**Description:** Get current authenticated user information

**Response (200):**
```json
{
  "id": "user_123",
  "walletAddress": "addr_test1qztest123456789abcdef",
  "createdAt": "2024-01-25T10:00:00Z",
  "updatedAt": "2024-01-25T12:00:00Z",
  "storageUsed": "1.2MB"
}
```

### Verify Wallet

**Endpoint:** `POST /api/auth/verify-wallet`  
**Authentication:** JWT Required  
**Description:** Verify wallet address with 2 ADA transaction

**Request Body:**
```json
{
  "walletAddress": "addr_test1qztest123456789abcdef"
}
```

**Response (200):**
```json
{
  "message": "Wallet verified successfully"
}
```

### Get Wallet Connection

**Endpoint:** `GET /api/auth/wallet-connect`  
**Authentication:** JWT Required  
**Description:** Get user's connected wallet address

**Response (200):**
```json
{
  "walletAddress": "addr_test1qztest123456789abcdef",
  "storageUsed": "1.2MB"
}
```

### Verify Deposit

**Endpoint:** `POST /api/auth/verify-deposit`  
**Authentication:** JWT Required  
**Description:** Verify 2 ADA deposit and initiate refund process

**Request Body:**
```json
{
  "senderWalletAddress": "addr_test1qztest123456789abcdef"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Deposit verified successfully. Refund will be processed automatically.",
  "txHash": "transaction_hash_here",
  "senderWalletAddress": "addr_test1qztest123456789abcdef"
}
```

### Verify Token

**Endpoint:** `POST /api/auth/verify`  
**Authentication:** None  
**Description:** Verify JWT token validity

**Request Body:**
```json
{
  "token": "jwt_token_to_verify"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token is valid",
  "user": {
    "id": "user_123",
    "walletAddress": "addr_test1qztest123456789abcdef",
    "createdAt": "2024-01-25T10:00:00Z"
  }
}
```

## New Signup Flow Endpoints

### Step 4: Setup PIN

**Endpoint:** `POST /api/auth/setup-pin`  
**Authentication:** None  
**Description:** Setup 4-digit PIN after OTP verification (Step 4 of 8-step signup flow)

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "pin": "1234",
  "sessionId": "signup_uuid" // Optional, will be generated if not provided
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "PIN setup completed successfully",
  "data": {
    "sessionId": "signup_uuid",
    "step": "pin_setup",
    "nextStep": "pin_confirmation"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "PIN must be exactly 4 digits"
}
```

### Step 5: Confirm PIN

**Endpoint:** `POST /api/auth/confirm-pin`  
**Authentication:** None  
**Description:** Confirm 4-digit PIN by re-entering it (Step 5 of 8-step signup flow)

**Request Body:**
```json
{
  "sessionId": "signup_uuid",
  "pin": "1234"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "PIN confirmed successfully",
  "data": {
    "sessionId": "signup_uuid",
    "step": "pin_confirmed",
    "nextStep": "biometric_setup"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "PIN confirmation does not match. Please try again."
}
```

### Step 6: Setup Biometric

**Endpoint:** `POST /api/auth/setup-biometric`  
**Authentication:** None  
**Description:** Setup biometric authentication - optional step (Step 6 of 8-step signup flow)

**Request Body:**
```json
{
  "sessionId": "signup_uuid",
  "biometricType": "fingerprint", // Optional: "fingerprint", "faceid", "voice", "iris"
  "biometricData": "base64_encoded_data" // Optional: biometric template data
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "fingerprint setup completed successfully",
  "data": {
    "sessionId": "signup_uuid",
    "step": "biometric_setup",
    "biometricType": "fingerprint",
    "nextStep": "did_creation"
  }
}
```

**Skip Biometric Response (200):**
```json
{
  "success": true,
  "message": "Biometric setup skipped",
  "data": {
    "sessionId": "signup_uuid",
    "step": "biometric_setup",
    "biometricType": null,
    "nextStep": "did_creation"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "PIN must be confirmed before setting up biometric authentication"
}
```

### Step 7: Complete Signup

**Endpoint:** `POST /api/auth/complete-signup`  
**Authentication:** None  
**Description:** Complete signup with DID creation and ZK proof generation (Step 7 of 8-step signup flow)

**Request Body:**
```json
{
  "sessionId": "signup_uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Signup completed successfully",
  "data": {
    "userId": "user_uuid",
    "walletAddress": "addr1...",
    "zkCommitment": "zk_commitment_hash",
    "sessionId": "signup_uuid",
    "nextStep": "username_setup"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Biometric setup must be completed before finalizing signup"
}
```

### Step 8: Setup Username

**Endpoint:** `POST /api/auth/setup-username`  
**Authentication:** None  
**Description:** Setup username after DID creation (Step 8 of 8-step signup flow)

**Request Body:**
```json
{
  "sessionId": "signup_uuid",
  "username": "myusername",
  "userId": "user_uuid" // Optional, will use session userId if not provided
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Username setup completed successfully. Welcome to K33P!",
  "data": {
    "sessionId": "signup_uuid",
    "step": "username_setup",
    "username": "myusername",
    "userId": "user_uuid",
    "walletAddress": "addr1...",
    "completed": true
  },
  "token": "jwt_token_here"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Username is already taken. Please choose a different username."
}
```

### Session Status Helper

**Endpoint:** `GET /api/auth/session-status/:sessionId`  
**Authentication:** None  
**Description:** Get current status of signup session

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "signup_uuid",
    "step": "pin_confirmed",
    "phoneNumber": "***-***-7890", // Masked for privacy
    "pinConfirmed": true,
    "biometricType": "fingerprint",
    "username": null,
    "completed": false,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Session not found or expired"
}
```

### Send OTP

**Endpoint:** `POST /api/auth/send-otp`  
**Authentication:** None  
**Description:** Send OTP to phone number during signup (Steps 1-3 of signup flow)

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "requestId": "firebase_request_id",
    "expiresIn": 300
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Phone number is required"
}
```

### Verify OTP

**Endpoint:** `POST /api/auth/verify-otp`  
**Authentication:** None  
**Description:** Verify OTP code during signup (Step 3 of signup flow)

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456",
  "requestId": "firebase_request_id"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "verified": true,
    "phoneNumber": "+1234567890"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid OTP code"
}
```

---

## User Management Endpoints

### Create User Profile

**Endpoint:** `POST /api/users`  
**Authentication:** None  
**Description:** Create a new user profile

**Request Body:**
```json
{
  "userId": "user_12345",
  "email": "user@example.com",
  "username": "john_doe",
  "phoneNumber": "+1234567890",
  "userAddress": "addr_test1qztest123456789abcdef",
  "biometricType": "fingerprint",
  "verificationMethod": "phone",
  "pin": "1234"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User profile created successfully",
  "user": {
    "id": "internal_id_123",
    "userId": "user_12345",
    "email": "user@example.com",
    "username": "john_doe",
    "createdAt": "2024-01-25T10:00:00Z"
  }
}
```

### Get User Profile

**Endpoint:** `GET /api/users/:userId`  
**Authentication:** None  
**Description:** Get user profile by ID

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "internal_id_123",
    "userId": "user_12345",
    "email": "user@example.com",
    "username": "john_doe",
    "createdAt": "2024-01-25T10:00:00Z",
    "updatedAt": "2024-01-25T12:00:00Z"
  }
}
```

### Delete User Data

**Endpoint:** `DELETE /api/users/:userId`  
**Authentication:** JWT Required  
**Description:** Delete user profile and associated data

**Query Parameters:**
- `confirmDeletion=true` (required)
- `deleteAllData=true` (optional, deletes seed phrases)

**Response (200):**
```json
{
  "success": true,
  "message": "User data deleted successfully",
  "deletedItems": {
    "userProfile": true,
    "deposits": true,
    "zkProofs": true,
    "seedPhrases": false,
    "iagonStorage": true,
    "sessions": true
  }
}
```

### Search Users

**Endpoint:** `GET /api/users/search`  
**Authentication:** JWT Required  
**Description:** Search users by various criteria

**Query Parameters:**
- `email` (optional)
- `username` (optional)
- `phoneHash` (optional)

**Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "id": "internal_id_123",
      "userId": "user_12345",
      "email": "user@example.com",
      "username": "john_doe"
    }
  ],
  "total": 1
}
```

---

## User Routes (Extended)

### Phone Signup

**Endpoint:** `POST /api/user/signup/phone`  
**Authentication:** None  
**Description:** Register with phone number and PIN

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "pin": "1234",
  "userName": "john_doe",
  "biometricData": "biometric_hash",
  "biometricType": "fingerprint"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": "user_12345",
  "token": "jwt_token_here"
}
```

### Get User Profile (Extended)

**Endpoint:** `GET /api/user/profile`  
**Authentication:** JWT Required  
**Description:** Get current user's profile

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "userName": "john_doe",
    "phoneNumber": "+1234567890",
    "email": "user@example.com",
    "walletAddress": "addr_test1qztest123456789abcdef",
    "verificationMethod": "phone",
    "biometricType": "fingerprint",
    "createdAt": "2024-01-25T10:00:00Z"
  }
}
```

### Update User Profile

**Endpoint:** `POST /api/user/profile`  
**Authentication:** JWT Required  
**Description:** Update current user's profile

**Request Body:**
```json
{
  "userName": "new_username",
  "email": "newemail@example.com",
  "biometricType": "faceid"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "user_123",
    "userName": "new_username",
    "email": "newemail@example.com",
    "updatedAt": "2024-01-25T12:00:00Z"
  }
}
```

### Upload Avatar

**Endpoint:** `POST /api/user/avatar`  
**Authentication:** JWT Required  
**Description:** Upload user avatar image

**Request:** Multipart form data with image file

**Response (200):**
```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "avatarUrl": "/uploads/avatars/avatar-user123-1234567890.jpg"
}
```

---

## Seed Phrase Management

### Store Seed Phrase

**Endpoint:** `POST /api/seed-phrases/store`  
**Authentication:** JWT Required  
**Description:** Store encrypted seed phrase on Iagon

**Request Body:**
```json
{
  "walletName": "My Cardano Wallet",
  "walletType": "cardano",
  "mnemonicType": "12-word",
  "seedPhrase": "word1 word2 word3 ... word12",
  "encryptionPassword": "strong_password_123",
  "backupLocation": "iagon"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Seed phrase stored successfully",
  "seedPhraseId": "sp_12345",
  "storageLocation": "iagon",
  "encryptionStatus": "encrypted"
}
```

### Get Stored Seed Phrases

**Endpoint:** `GET /api/seed-phrases`  
**Authentication:** JWT Required  
**Description:** Get list of user's stored seed phrases

**Response (200):**
```json
{
  "success": true,
  "seedPhrases": [
    {
      "id": "sp_12345",
      "walletName": "My Cardano Wallet",
      "walletType": "cardano",
      "mnemonicType": "12-word",
      "createdAt": "2024-01-25T10:00:00Z",
      "storageLocation": "iagon"
    }
  ],
  "total": 1
}
```

---

## OTP Management

### Request OTP

**Endpoint:** `POST /api/otp/request`  
**Authentication:** None  
**Description:** Request OTP for phone verification

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "purpose": "login"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "otpId": "otp_12345",
  "expiresIn": 300
}
```

### Verify OTP

**Endpoint:** `POST /api/otp/verify`  
**Authentication:** None  
**Description:** Verify OTP code

**Request Body:**
```json
{
  "otpId": "otp_12345",
  "code": "123456",
  "phoneNumber": "+1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "verified": true
}
```

---

## ZK Proof Endpoints

### Generate ZK Proof

**Endpoint:** `POST /api/zk/generate`  
**Authentication:** JWT Required  
**Description:** Generate zero-knowledge proof

**Request Body:**
```json
{
  "data": {
    "phoneHash": "hashed_phone_number",
    "biometricHash": "hashed_biometric_data"
  },
  "commitment": "zk_commitment_hash"
}
```

**Response (200):**
```json
{
  "success": true,
  "proof": "zk_proof_data",
  "isValid": true
}
```

### Verify ZK Proof

**Endpoint:** `POST /api/zk/verify`  
**Authentication:** None  
**Description:** Verify zero-knowledge proof

**Request Body:**
```json
{
  "proof": "zk_proof_data",
  "commitment": "zk_commitment_hash",
  "publicInputs": ["input1", "input2"]
}
```

**Response (200):**
```json
{
  "success": true,
  "valid": true,
  "message": "Proof verified successfully"
}
```

---

## UTXO Management

### Get User Balance

**Endpoint:** `GET /api/utxo/balance`  
**Authentication:** JWT Required  
**Description:** Get user's wallet balance

**Response (200):**
```json
{
  "success": true,
  "balance": {
    "ada": "10.500000",
    "lovelace": "10500000",
    "assets": []
  }
}
```

### Get User UTXOs

**Endpoint:** `GET /api/utxo/user`  
**Authentication:** JWT Required  
**Description:** Get user's UTXOs

**Response (200):**
```json
{
  "success": true,
  "utxos": [
    {
      "txHash": "abc123def456",
      "outputIndex": 0,
      "amount": "2000000",
      "address": "addr_test1qztest123456789abcdef"
    }
  ],
  "total": 1
}
```

---

## Phone Management

### Verify Phone Number

**Endpoint:** `POST /api/phone/verify`  
**Authentication:** JWT Required  
**Description:** Verify phone number with OTP

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "otpCode": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "verified": true
}
```

---

## Account Recovery

### Initiate Recovery

**Endpoint:** `POST /api/recovery/initiate`  
**Authentication:** None  
**Description:** Initiate account recovery process

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "recoveryMethod": "phone"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Recovery process initiated",
  "recoveryId": "recovery_12345"
}
```

---

## Additional Endpoints

### Get User Status by Address

**Endpoint:** `GET /api/user/:address/status`  
**Authentication:** None  
**Description:** Get user status by wallet address

**Response (200):**
```json
{
  "success": true,
  "status": {
    "exists": true,
    "verified": true,
    "signupCompleted": false,
    "refunded": false
  }
}
```

### Retry Verification

**Endpoint:** `POST /api/retry-verification`  
**Authentication:** None  
**Description:** Retry user verification process

**Request Body:**
```json
{
  "userAddress": "addr_test1qztest123456789abcdef"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Verification retry initiated",
  "verified": true
}
```

### Process Signup

**Endpoint:** `POST /api/process-signup`  
**Authentication:** None  
**Description:** Process signup completion

**Request Body:**
```json
{
  "userAddress": "addr_test1qztest123456789abcdef"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "txHash": "transaction_hash_here"
  },
  "message": "Signup processed successfully"
}
```

### Immediate Refund

**Endpoint:** `POST /api/refund`  
**Authentication:** None  
**Description:** Process immediate refund

**Request Body:**
```json
{
  "userAddress": "addr_test1qztest123456789abcdef",
  "walletAddress": "addr_test1qxyz..." // Optional
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "txHash": "refund_transaction_hash"
  },
  "message": "Refund processed successfully"
}
```

---

## Rate Limiting & Security

The K33P API implements comprehensive rate limiting to ensure system stability and prevent abuse. Rate limits are applied per IP address and per authenticated user where applicable.

### Authentication & Security Endpoints

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `/api/auth/signup` | 3 requests | 10 minutes | Prevents automated account creation |
| `/api/auth/login` | 5 requests | 15 minutes | Protects against brute force attacks |
| `/api/auth/verify-wallet` | 10 requests | 5 minutes | Allows reasonable verification attempts |
| `/api/auth/verify-deposit` | 5 requests | 10 minutes | Prevents deposit verification spam |
| `/api/otp/request` | 3 requests | 5 minutes | Limits OTP generation to prevent SMS abuse |
| `/api/otp/verify` | 10 requests | 5 minutes | Allows multiple verification attempts |

### User Management Endpoints

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `/api/users` (POST) | 5 requests | 10 minutes | Limits user profile creation |
| `/api/users/:userId` (DELETE) | 1 request | 1 hour | Prevents accidental data deletion |
| `/api/user/profile` (POST) | 10 requests | 1 hour | Allows reasonable profile updates |
| `/api/user/avatar` | 5 requests | 1 hour | Limits avatar upload frequency |

### Sensitive Operations

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `/api/seed-phrases/store` | 3 requests | 1 hour | Protects against seed phrase spam |
| `/api/zk/generate` | 20 requests | 1 hour | Allows ZK proof generation |
| `/api/zk/verify` | 50 requests | 1 hour | Supports verification workflows |
| `/api/refund` | 2 requests | 1 hour | Prevents refund abuse |

### System & Public Endpoints

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `/api/health` | 100 requests | 1 minute | High limit for monitoring |
| `/api/status` | 50 requests | 1 minute | Allows frequent status checks |
| `/api/version` | 100 requests | 1 minute | Unrestricted version info |
| `/api/deposit-address` | 20 requests | 1 minute | Supports wallet integrations |

### Rate Limit Headers

All API responses include rate limiting information in the headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 300
```

### Rate Limit Exceeded Response

When rate limits are exceeded, the API returns a `429 Too Many Requests` status:

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 300,
  "timestamp": "2024-01-25T12:34:56.789Z"
}
```

### Additional Security Measures

- **IP-based blocking**: Automatic temporary blocking of IPs with suspicious activity
- **Progressive delays**: Increasing delays for repeated failed authentication attempts
- **Geolocation filtering**: Optional restriction based on geographic location
- **Device fingerprinting**: Enhanced security for sensitive operations
- **CAPTCHA integration**: Automatic CAPTCHA challenges for suspicious requests

---

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **ZK Proof Verification**: Zero-knowledge proof validation
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Cross-origin request security
- **Environment Variable Security**: No hardcoded secrets
- **Biometric Authentication**: Multiple biometric verification methods
- **PIN Protection**: 4-6 digit PIN security
- **Session Management**: Secure session handling with Iagon

---

## Environment Variables Required

```bash
# Required for all operations
BLOCKFROST_API_KEY=your_blockfrost_api_key
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=24h

# Database configuration
POSTGRES_URL=your_postgres_connection_string

# Blockchain configuration
SCRIPT_ADDRESS=your_script_address
SEED_PHRASE=your_wallet_seed_phrase

# Optional features
AUTO_REFUND_ENABLED=true
NODE_ENV=production
```

---

*Last updated: January 25, 2024*
*API Version: 1.0.0*
