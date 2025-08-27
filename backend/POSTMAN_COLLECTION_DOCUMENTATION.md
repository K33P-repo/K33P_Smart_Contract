# K33P Backend API - Complete Postman Collection Documentation

This document provides comprehensive documentation for all API endpoints in the K33P Backend system, organized for easy import into Postman.

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [OTP Management](#otp-management)
3. [User Management](#user-management)
4. [Phone Management](#phone-management)
5. [Account Recovery](#account-recovery)
6. [Seed Phrase Management](#seed-phrase-management)
7. [UTXO Management](#utxo-management)
8. [Zero-Knowledge Proof](#zero-knowledge-proof)
9. [Payment & Subscription](#payment--subscription)
10. [Auto-Refund Monitor](#auto-refund-monitor)
11. [Health & Status](#health--status)
12. [Admin Endpoints](#admin-endpoints)

---

## Base Configuration

**Base URL:** `http://localhost:3002` (or your deployed server URL)

**Common Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{jwt_token}}"
}
```

**Environment Variables for Postman:**
- `base_url`: `http://localhost:3002`
- `jwt_token`: (Set after successful login)
- `user_id`: (Set after successful login)

---

## Authentication Endpoints

### 1. Phone Signup
**POST** `/api/auth/signup/phone`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "walletAddress": "addr1..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone signup initiated",
  "data": {
    "userId": "uuid",
    "phoneHash": "hash",
    "nextStep": "otp_verification"
  }
}
```

### 2. PIN Signup
**POST** `/api/auth/signup/pin`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "pin": "123456",
  "walletAddress": "addr1..."
}
```

### 3. Biometric Signup
**POST** `/api/auth/signup/biometric`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "biometricData": "base64_encoded_data",
  "walletAddress": "addr1..."
}
```

### 4. Passkey Signup
**POST** `/api/auth/signup/passkey`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "passkeyData": "webauthn_credential",
  "walletAddress": "addr1..."
}
```

### 5. Send OTP
**POST** `/api/auth/send-otp`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

### 6. Verify OTP
**POST** `/api/auth/verify-otp`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

### 7. Setup PIN
**POST** `/api/auth/setup-pin`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "pin": "123456"
}
```

### 8. Confirm PIN
**POST** `/api/auth/confirm-pin`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "pin": "123456"
}
```

### 9. Setup Biometric
**POST** `/api/auth/setup-biometric`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "biometricData": "base64_encoded_data"
}
```

### 10. Complete Signup
**POST** `/api/auth/complete-signup`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "username": "user123"
}
```

### 11. Setup Username
**POST** `/api/auth/setup-username`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "username": "user123"
}
```

### 12. Session Status
**GET** `/api/auth/session-status`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 13. Login
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "authMethod": "pin",
  "authData": "123456"
}
```

### 14. Sign In
**POST** `/api/auth/signin`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "pin": "123456"
}
```

### 15. Logout
**POST** `/api/auth/logout`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 16. Get User Profile
**GET** `/api/auth/profile`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 17. Verify Wallet
**POST** `/api/auth/verify-wallet`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "walletAddress": "addr1...",
  "signature": "signature_data"
}
```

### 18. Connect Wallet
**POST** `/api/auth/connect-wallet`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "walletAddress": "addr1...",
  "walletType": "cardano"
}
```

---

## OTP Management

### 1. Send OTP
**POST** `/api/otp/send`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "requestId": "uuid"
  }
}
```

### 2. Verify OTP
**POST** `/api/otp/verify`

**Request Body:**
```json
{
  "requestId": "uuid",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "verified": true
  }
}
```

### 3. Cancel OTP
**POST** `/api/otp/cancel`

**Request Body:**
```json
{
  "requestId": "uuid"
}
```

---

## User Management

### 1. Create User Profile
**POST** `/api/user-management/profile`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "username": "user123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

### 2. Get User Profile
**GET** `/api/user-management/profile`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 3. Update User Profile
**PUT** `/api/user-management/profile`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "username": "newusername",
  "email": "newemail@example.com"
}
```

### 4. Delete User Profile
**DELETE** `/api/user-management/profile`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 5. Search Users
**GET** `/api/user-management/search?query=john&limit=10`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 6. Add Seed Phrase
**POST** `/api/user-management/seed-phrase`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "seedPhrase": "word1 word2 word3...",
  "walletName": "My Wallet"
}
```

### 7. Get Seed Phrases
**GET** `/api/user-management/seed-phrases`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 8. Delete Seed Phrase
**DELETE** `/api/user-management/seed-phrase/:id`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 9. Get Storage Stats
**GET** `/api/user-management/storage-stats`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 10. User Backup
**POST** `/api/user-management/backup`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 11. Get Subscription
**GET** `/api/user-management/subscription`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 12. Update Subscription
**PUT** `/api/user-management/subscription`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "tier": "premium",
  "autoRenew": true
}
```

### 13. Delete Subscription
**DELETE** `/api/user-management/subscription`

**Headers:** `Authorization: Bearer {{jwt_token}}`

---

## Phone Management

### 1. Request Phone Change
**POST** `/api/phone/change/request`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "newPhoneNumber": "+1987654321",
  "verificationMethod": "offchain",
  "currentPin": "123456"
}
```

### 2. Verify OTP for Phone Change
**POST** `/api/phone/change/verify-otp`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "requestId": "uuid",
  "otp": "123456"
}
```

### 3. Verify Onchain for Phone Change
**POST** `/api/phone/change/verify-onchain`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "requestId": "uuid",
  "txHash": "transaction_hash"
}
```

---

## Account Recovery

### 1. Initiate Recovery
**POST** `/api/account-recovery/initiate`

**Request Body:**
```json
{
  "identifier": "+1234567890",
  "recoveryMethod": "backup_phrase",
  "newPhoneNumber": "+1987654321"
}
```

### 2. Verify Backup Phrase
**POST** `/api/account-recovery/verify-backup-phrase`

**Request Body:**
```json
{
  "recoveryId": "uuid",
  "backupPhrase": "word1 word2 word3..."
}
```

### 3. Verify Emergency Contact
**POST** `/api/account-recovery/verify-emergency-contact`

**Request Body:**
```json
{
  "recoveryId": "uuid",
  "emergencyToken": "uuid"
}
```

### 4. Verify Onchain Proof
**POST** `/api/account-recovery/verify-onchain`

**Request Body:**
```json
{
  "recoveryId": "uuid",
  "txHash": "transaction_hash",
  "walletAddress": "addr1..."
}
```

### 5. Get Recovery Status
**GET** `/api/account-recovery/status/:recoveryId`

---

## Seed Phrase Management

### 1. Store Seed Phrase
**POST** `/api/seed-phrases/store`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "walletName": "My Cardano Wallet",
  "walletType": "cardano",
  "mnemonicType": "12-word",
  "seedPhrase": "word1 word2 word3...",
  "encryptionPassword": "securepassword"
}
```

### 2. Get Seed Phrases
**GET** `/api/seed-phrases`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 3. Retrieve Seed Phrase
**POST** `/api/seed-phrases/:id/retrieve`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "encryptionPassword": "securepassword"
}
```

---

## UTXO Management

### 1. Fetch UTXOs
**GET** `/api/utxo/fetch/:phoneHash`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 2. Refund UTXO
**POST** `/api/utxo/refund`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "utxo": {
    "txHash": "transaction_hash",
    "outputIndex": 0
  },
  "ownerAddress": "addr1...",
  "zkProof": {
    "isValid": true,
    "proof": "proof_data"
  }
}
```

### 3. Track UTXO
**POST** `/api/utxo/track`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "txHash": "transaction_hash",
  "outputIndex": 0,
  "datum": {
    "amount": 1000000,
    "owner": "addr1..."
  }
}
```

### 4. Get User UTXOs
**GET** `/api/utxo/user`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 5. Create Deposit
**POST** `/api/utxo/deposit`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "amount": 1000000,
  "walletAddress": "addr1...",
  "txHash": "transaction_hash",
  "outputIndex": 0
}
```

### 6. Get Balance
**GET** `/api/utxo/balance`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 7. Get Transaction History
**POST** `/api/utxo/history`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "limit": 10,
  "offset": 0,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

---

## Zero-Knowledge Proof

### 1. Generate ZK Commitment
**POST** `/api/zk/commitment`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "biometric": "biometric_data",
  "passkey": "passkey_data"
}
```

### 2. Generate ZK Proof
**POST** `/api/zk/proof`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "biometric": "biometric_data",
  "passkey": "passkey_data",
  "commitment": "commitment_hash"
}
```

### 3. Verify ZK Proof
**POST** `/api/zk/verify`

**Request Body:**
```json
{
  "proof": {
    "publicInputs": {
      "commitment": "commitment_hash"
    },
    "isValid": true
  },
  "commitment": "commitment_hash"
}
```

### 4. ZK Login
**POST** `/api/zk/login`

**Request Body:**
```json
{
  "walletAddress": "addr1...",
  "zkProof": {
    "publicInputs": {
      "commitment": "commitment_hash"
    },
    "isValid": true
  }
}
```

### 5. Get ZK User
**GET** `/api/zk/user/:userId`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 6. ZK Login with PIN
**POST** `/api/zk/login-with-pin`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "pin": "123456"
}
```

---

## Payment & Subscription

### 1. Initialize Payment
**POST** `/api/payment/initialize`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "subscriptionType": "premium",
  "durationMonths": 1,
  "paymentMethod": "stripe"
}
```

### 2. Verify Payment
**POST** `/api/payment/verify`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "paymentIntentId": "pi_...",
  "subscriptionType": "premium"
}
```

### 3. Get Payment Config
**GET** `/api/payment/config`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 4. Get Subscription Status
**GET** `/api/subscription/status`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 5. Cancel Subscription
**POST** `/api/subscription/cancel`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 6. Activate Subscription
**POST** `/api/subscription/activate`

**Headers:** `Authorization: Bearer {{jwt_token}}`

**Request Body:**
```json
{
  "durationMonths": 1
}
```

### 7. Check Subscription Expiry
**GET** `/api/subscription/check-expiry`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 8. Get Subscription Statistics
**GET** `/api/subscription/statistics`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 9. Manual Renewal Check
**POST** `/api/subscription/manual-renewal-check`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 10. Get Expiring Subscriptions
**GET** `/api/subscription/expiring`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 11. Get Expired Subscriptions
**GET** `/api/subscription/expired`

**Headers:** `Authorization: Bearer {{jwt_token}}`

---

## Auto-Refund Monitor

### 1. Health Check
**GET** `/api/auto-refund/health`

### 2. Get Status
**GET** `/api/auto-refund/status`

### 3. Start Monitor (Admin)
**POST** `/api/auto-refund/start`

**Headers:** `Authorization: Bearer {{admin_token}}`

### 4. Stop Monitor (Admin)
**POST** `/api/auto-refund/stop`

**Headers:** `Authorization: Bearer {{admin_token}}`

### 5. Trigger Manual Check (Admin)
**POST** `/api/auto-refund/trigger`

**Headers:** `Authorization: Bearer {{admin_token}}`

### 6. Reset Statistics (Admin)
**POST** `/api/auto-refund/reset-stats`

**Headers:** `Authorization: Bearer {{admin_token}}`

### 7. Test Webhook (Admin)
**POST** `/api/auto-refund/webhook/test`

**Headers:** `Authorization: Bearer {{admin_token}}`

**Request Body:**
```json
{
  "testTransaction": {
    "txHash": "test_hash",
    "amount": 1000000
  }
}
```

### 8. Register Webhook (Admin)
**POST** `/api/auto-refund/webhook/register`

**Headers:** `Authorization: Bearer {{admin_token}}`

**Request Body:**
```json
{
  "webhookUrl": "https://example.com/webhook",
  "secret": "webhook_secret"
}
```

---

## Health & Status

### 1. Health Check
**GET** `/api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### 2. Server Status
**GET** `/api/status`

### 3. API Version
**GET** `/api/version`

### 4. User Profile (Direct)
**GET** `/api/user/profile`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 5. Get Deposit Address
**GET** `/api/deposit-address`

**Headers:** `Authorization: Bearer {{jwt_token}}`

### 6. Retry Verification
**POST** `/api/retry-verification`

**Headers:** `Authorization: Bearer {{jwt_token}}`

---

## Admin Endpoints

### 1. Get All Users (Admin)
**GET** `/api/admin/users`

**Headers:** `Authorization: Bearer {{admin_token}}`

### 2. Auto Verify User (Admin)
**POST** `/api/admin/auto-verify`

**Headers:** `Authorization: Bearer {{admin_token}}`

**Request Body:**
```json
{
  "userId": "uuid"
}
```

### 3. Monitor Status (Admin)
**GET** `/api/admin/monitor`

**Headers:** `Authorization: Bearer {{admin_token}}`

### 4. Process Signup (Admin)
**POST** `/api/admin/process-signup`

**Headers:** `Authorization: Bearer {{admin_token}}`

**Request Body:**
```json
{
  "userId": "uuid",
  "action": "approve"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "details": [
    {
      "field": "phoneNumber",
      "message": "Valid phone number is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required",
  "error": "UNAUTHORIZED"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "error": "FORBIDDEN"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found",
  "error": "NOT_FOUND"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Rate limit exceeded",
  "error": "RATE_LIMIT_EXCEEDED"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "SERVER_ERROR"
}
```

---

## Postman Collection Import

To import this collection into Postman:

1. Open Postman
2. Click "Import" in the top left
3. Select "Raw text" and paste the JSON collection (available separately)
4. Set up environment variables:
   - `base_url`: Your server URL
   - `jwt_token`: JWT token from login
   - `admin_token`: Admin JWT token
   - `user_id`: Current user ID

## Testing Workflow

1. **Start with Authentication:**
   - Use phone signup or login endpoints
   - Save the JWT token to `{{jwt_token}}`

2. **Test Core Features:**
   - OTP management
   - User profile operations
   - UTXO operations

3. **Test Advanced Features:**
   - Seed phrase storage
   - Account recovery
   - Payment and subscriptions

4. **Admin Testing:**
   - Use admin endpoints with admin token
   - Monitor system health

## Notes

- All authenticated endpoints require a valid JWT token
- Admin endpoints require admin-level authentication
- Rate limiting is applied to sensitive endpoints
- Phone numbers should be in international format (+1234567890)
- All timestamps are in ISO 8601 format
- Amounts are typically in the smallest unit (e.g., lovelace for Cardano)

---

*This documentation covers all available endpoints in the K33P Backend API. For specific implementation details, refer to the individual route files in the codebase.*