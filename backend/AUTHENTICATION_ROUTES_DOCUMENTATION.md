# K33P Authentication Routes Documentation

This document provides comprehensive documentation for all authentication-related routes in the K33P Identity System, including traditional authentication and Zero-Knowledge (ZK) proof-based authentication.

## Table of Contents

1. [Traditional Authentication Routes](#traditional-authentication-routes)
2. [Zero-Knowledge Proof Routes](#zero-knowledge-proof-routes)
3. [Error Codes](#error-codes)
4. [Authentication Flow](#authentication-flow)

---

## Traditional Authentication Routes

### 1. User Signup

**Endpoint:** `POST /api/auth/signup`  
**Access:** Public  
**Description:** Register a new user with ZK commitment generation and blockchain transaction creation.

#### Request Body
```json
{
  "walletAddress": "addr1qxy...",
  "phone": "+1234567890",
  "biometric": "biometric_data_hash",
  "passkey": "passkey_data"
}
```

#### Request Fields
- `walletAddress` (string, optional): Cardano wallet address (can be added later via verify-wallet endpoint)
- `phone` (string, required): User's phone number
- `biometric` (string, required): Biometric data for authentication
- `passkey` (string, required): Passkey data for authentication

#### Success Response (201)

**With Wallet Address:**
```json
{
  "message": "User registered successfully",
  "txHash": "abc123...",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Without Wallet Address:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Error Responses

**400 - Missing Fields**
```json
{
  "error": "Missing required fields: phone, biometric, and passkey are required"
}
```

**400 - User Exists (Phone)**
```json
{
  "error": "User already exists with this phone number"
}
```

**400 - User Exists (Wallet)**
```json
{
  "error": "User already exists with this wallet address"
}
```

**400 - Invalid ZK Proof**
```json
{
  "error": "Invalid ZK proof"
}
```

**500 - Server Error**
```json
{
  "error": "Failed to register user"
}
```

---

### 5. ZK Login with PIN (Auto Authentication)

**Endpoint:** `POST /api/zk/login-with-pin`  
**Access:** Public  
**Description:** Login using phone number and PIN with automatic ZK proof retrieval and verification.

#### Request Body
```json
{
  "phoneNumber": "+1234567890",
  "pin": "1234"
}
```

#### Request Fields
- `phoneNumber` (string, required): User's phone number
- `pin` (string, required): 4-digit PIN (must be exactly 4 digits)

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "message": "ZK login with PIN successful",
    "userId": "user_id_123",
    "walletAddress": "addr1qxy...",
    "token": "jwt_token_here",
    "authMethod": "zk-pin"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Error Responses

**400 - Invalid Input**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Missing required inputs: phoneNumber and pin are required"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**400 - Invalid PIN Format**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PIN_FORMAT",
    "message": "PIN must be exactly 4 digits"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**404 - User Not Found**
```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "No user found with this phone number"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**401 - Invalid PIN**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PIN",
    "message": "Invalid PIN provided"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**400 - No ZK Commitment**
```json
{
  "success": false,
  "error": {
    "code": "NO_ZK_COMMITMENT",
    "message": "User does not have a ZK commitment stored"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**400 - No ZK Proof**
```json
{
  "success": false,
  "error": {
    "code": "NO_ZK_PROOF",
    "message": "No valid ZK proof found for this user"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**401 - ZK Verification Failed**
```json
{
  "success": false,
  "error": {
    "code": "ZK_VERIFICATION_FAILED",
    "message": "ZK proof verification failed"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**401 - Commitment Mismatch**
```json
{
  "success": false,
  "error": {
    "code": "COMMITMENT_MISMATCH",
    "message": "ZK commitment does not match user record"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### How It Works
1. **Phone Number Validation**: The system hashes the provided phone number to find the user
2. **PIN Verification**: Verifies the 4-digit PIN against the stored PIN in the database
3. **ZK Commitment Check**: Ensures the user has a stored ZK commitment
4. **ZK Proof Retrieval**: Automatically retrieves the user's valid ZK proof from the database
5. **ZK Verification**: Verifies the retrieved ZK proof against the commitment
6. **Commitment Matching**: Ensures the proof commitment matches the user's stored commitment
7. **JWT Generation**: Generates and returns a JWT token for authenticated access

#### Benefits
- **User-Friendly**: Users only need to provide phone number and PIN
- **Automatic ZK Handling**: System automatically retrieves and verifies ZK proofs
- **Secure**: Maintains ZK proof security while simplifying user experience
- **No Manual Proof Input**: Users don't need to handle complex ZK proof data

```

---

### 2. User Login

**Endpoint:** `POST /api/auth/login`  
**Access:** Public  
**Middleware:** `verifyZkProof`  
**Description:** Authenticate user with ZK proof verification.

#### Request Body
```json
{
  "walletAddress": "addr1qxy...",
  "phone": "+1234567890",
  "proof": "zk_proof_data",
  "commitment": "zk_commitment_hash"
}
```

#### Request Fields
- `walletAddress` (string, optional): Cardano wallet address (used as fallback identifier)
- `phone` (string, required): User's phone number (primary identifier)
- `proof` (string, required): Zero-knowledge proof
- `commitment` (string, required): ZK commitment hash

#### Success Response (200)
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "hasWallet": true
}
```

#### Response Fields
- `message` (string): Success message
- `token` (string): JWT authentication token
- `hasWallet` (boolean): Indicates whether the user has a wallet address associated

#### Error Responses

**400 - Missing Fields**
```json
{
  "error": "Missing required fields: phone, proof, and commitment are required"
}
```

**404 - User Not Found**
```json
{
  "error": "User not found"
}
```

**401 - Invalid Proof**
```json
{
  "error": "Invalid ZK proof"
}
```

**500 - Server Error**
```json
{
  "error": "Failed to login"
}
```

---

### 3. User Logout

**Endpoint:** `POST /api/auth/logout`  
**Access:** Private  
**Middleware:** `verifyToken`  
**Description:** Logout user and invalidate session.

#### Request Headers
```
Authorization: Bearer <jwt_token>
```

#### Success Response (200)
```json
{
  "message": "Logout successful"
}
```

#### Error Responses

**401 - Unauthorized**
```json
{
  "error": "Unauthorized"
}
```

**500 - Server Error**
```json
{
  "error": "Failed to logout"
}
```

---

### 4. Get Current User

**Endpoint:** `GET /api/auth/me`  
**Access:** Private  
**Middleware:** `verifyToken`  
**Description:** Retrieve current authenticated user information.

#### Request Headers
```
Authorization: Bearer <jwt_token>
```

#### Success Response (200)
```json
{
  "id": "user_id_123",
  "walletAddress": "addr1qxy...",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Error Responses

**401 - Unauthorized**
```json
{
  "error": "Unauthorized"
}
```

**404 - User Not Found**
```json
{
  "error": "User not found"
}
```

**500 - Server Error**
```json
{
  "error": "Failed to get user"
}
```

---

### 5. Verify Wallet

**Endpoint:** `POST /api/auth/verify-wallet`  
**Access:** Private  
**Middleware:** `authenticate`, `walletVerifyLimiter` (5 requests/minute)  
**Description:** Verify wallet address with 2 ADA transaction validation.

#### Request Headers
```
Authorization: Bearer <jwt_token>
```

#### Request Body
```json
{
  "walletAddress": "addr1qxy..."
}
```

#### Request Fields
- `walletAddress` (string, required): Cardano wallet address to verify

#### Success Response (200)
```json
{
  "message": "Wallet verified successfully"
}
```

#### Error Responses

**400 - Invalid Transaction**
```json
{
  "message": "No valid 2 ADA transaction found"
}
```

**429 - Rate Limited**
```json
{
  "message": "Too many wallet verification requests, please try again later"
}
```

**500 - Server Error**
```json
{
  "message": "Wallet verification failed",
  "error": "error_details"
}
```

---

### 6. Wallet Connect

**Endpoint:** `GET /api/auth/wallet-connect`  
**Access:** Private  
**Middleware:** `authenticate`  
**Description:** Retrieve user's connected wallet address.

#### Request Headers
```
Authorization: Bearer <jwt_token>
```

#### Success Response (200)
```json
{
  "walletAddress": "addr1qxy..."
}
```

#### Error Responses

**400 - No Wallet**
```json
{
  "message": "No wallet address found"
}
```

**500 - Server Error**
```json
{
  "message": "Wallet connect failed",
  "error": "error_details"
}
```

---

## Zero-Knowledge Proof Routes

### 1. Generate ZK Commitment

**Endpoint:** `POST /api/zk/commitment`  
**Access:** Public  
**Description:** Generate a ZK commitment from user inputs.

#### Request Body
```json
{
  "phone": "+1234567890",
  "biometric": "biometric_data_hash",
  "passkey": "passkey_data"
}
```

#### Request Fields
- `phone` (string, required): User's phone number
- `biometric` (string, required): Biometric data
- `passkey` (string, required): Passkey data

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "commitment": "zk_commitment_hash",
    "hashes": {
      "phoneHash": "phone_hash",
      "biometricHash": "biometric_hash",
      "passkeyHash": "passkey_hash"
    }
  },
  "message": "ZK commitment generated successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Error Responses

**400 - Invalid Input**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Missing required inputs: phone, biometric, and passkey are required"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**500 - Internal Error**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to generate ZK commitment"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. Generate ZK Proof

**Endpoint:** `POST /api/zk/proof`  
**Access:** Public  
**Description:** Generate a ZK proof from user inputs and commitment.

#### Request Body
```json
{
  "phone": "+1234567890",
  "biometric": "biometric_data_hash",
  "passkey": "passkey_data",
  "commitment": "zk_commitment_hash"
}
```

#### Request Fields
- `phone` (string, required): User's phone number
- `biometric` (string, required): Biometric data
- `passkey` (string, required): Passkey data
- `commitment` (string, required): ZK commitment hash

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "proof": "zk_proof_data",
    "commitment": "zk_commitment_hash"
  },
  "message": "ZK proof generated successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Error Responses

**400 - Invalid Input**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Missing required inputs: phone, biometric, passkey, and commitment are required"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**401 - Verification Failed**
```json
{
  "success": false,
  "error": {
    "code": "ZK_VERIFICATION_FAILED",
    "message": "Failed to generate a valid ZK proof",
    "details": "error_details"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**500 - Internal Error**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to generate ZK proof"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 3. Verify ZK Proof

**Endpoint:** `POST /api/zk/verify`  
**Access:** Public  
**Description:** Verify a ZK proof against a commitment.

#### Request Body
```json
{
  "proof": "zk_proof_data",
  "commitment": "zk_commitment_hash"
}
```

#### Request Fields
- `proof` (string, required): Zero-knowledge proof
- `commitment` (string, required): ZK commitment hash

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "isValid": true
  },
  "message": "ZK proof verified successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Error Responses

**400 - Invalid Input**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Missing required inputs: proof and commitment are required"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**500 - Internal Error**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to verify ZK proof"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 4. ZK Login

**Endpoint:** `POST /api/zk/login`  
**Access:** Public  
**Description:** Login using ZK proof verification.

#### Request Body
```json
{
  "walletAddress": "addr1qxy...",
  "phone": "+1234567890",
  "proof": "zk_proof_data",
  "commitment": "zk_commitment_hash"
}
```

#### Request Fields
- `walletAddress` (string, optional): Cardano wallet address
- `phone` (string, optional): User's phone number
- `proof` (string, required): Zero-knowledge proof
- `commitment` (string, required): ZK commitment hash

**Note:** Either `walletAddress` or `phone` must be provided.

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "message": "ZK login successful",
    "userId": "user_id_123",
    "token": "jwt_token_would_be_generated_here"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Error Responses

**400 - Invalid Input**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Either walletAddress or phone must be provided"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**404 - User Not Found**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**401 - Verification Failed**
```json
{
  "success": false,
  "error": {
    "code": "ZK_VERIFICATION_FAILED",
    "message": "ZK proof verification failed"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**401 - Unauthorized**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid commitment for this user"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**500 - Service Unavailable**
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Failed to find user, Iagon API may be unavailable",
    "details": "error_details"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 5. Get User ZK Commitment

**Endpoint:** `GET /api/zk/user/:userId`  
**Access:** Private  
**Middleware:** `verifyToken`  
**Description:** Retrieve a user's ZK commitment.

#### Request Headers
```
Authorization: Bearer <jwt_token>
```

#### URL Parameters
- `userId` (string, required): User ID

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "userId": "user_id_123",
    "zkCommitment": "zk_commitment_hash"
  },
  "message": "User ZK commitment retrieved successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Error Responses

**400 - Invalid Input**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Missing required parameter: userId"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**404 - User Not Found**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**500 - Service Unavailable**
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Failed to find user, Iagon API may be unavailable",
    "details": "error_details"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Missing or invalid request parameters |
| `ZK_VERIFICATION_FAILED` | Zero-knowledge proof verification failed |
| `UNAUTHORIZED` | Invalid credentials or commitment mismatch |
| `NOT_FOUND` | User or resource not found |
| `SERVICE_UNAVAILABLE` | External service (Iagon API) unavailable |
| `INTERNAL_ERROR` | Internal server error |

---

## Authentication Flow

### Traditional Signup & Login Flow

1. **Signup Process:**
   - User provides phone, biometric, and passkey data (wallet address optional)
   - System hashes the user data
   - ZK commitment is generated from hashed data
   - ZK proof is created and validated
   - Blockchain transaction is created (only if wallet address provided)
   - User record is stored with ZK commitment
   - JWT token is generated and returned

2. **Login Process:**
   - User provides phone, proof, and commitment (wallet address optional)
   - System finds user primarily by phone hash, fallback to wallet address if provided
   - ZK proof is verified against the commitment
   - User's stored commitment is matched against provided commitment
   - JWT token is generated and returned with `hasWallet` indicator

3. **Wallet Addition Process (Optional):**
   - User can later add wallet address via `/api/auth/verify-wallet` endpoint
   - Requires sending 2 ADA transaction for verification
   - Rate limited to 5 requests per minute
   - Verification results cached for 5 minutes

### ZK-Only Authentication Flow

1. **Generate Commitment:**
   - User provides phone, biometric, and passkey data
   - System generates ZK commitment and returns hashes

2. **Generate Proof:**
   - User provides the same data plus the commitment
   - System generates and validates ZK proof

3. **ZK Login:**
   - User provides wallet address/phone, proof, and commitment
   - System verifies proof and matches commitment
   - Authentication successful

### Security Features

- **Rate Limiting:** Wallet verification limited to 5 requests per minute
- **Caching:** Wallet verification results cached for 5 minutes
- **JWT Tokens:** Secure token-based authentication with configurable expiration
- **ZK Proofs:** Zero-knowledge proof verification for privacy-preserving authentication
- **Blockchain Integration:** 2 ADA transaction verification for wallet ownership
- **Session Management:** Secure session creation and invalidation

### Environment Variables

- `JWT_SECRET`: Secret key for JWT token signing
- `JWT_EXPIRATION`: Token expiration time (default: 24h)
- `BLOCKFROST_API_KEY`: Blockfrost API key for blockchain queries

---

*This documentation covers all authentication routes in the K33P Identity System. For additional information about refund routes, database operations, or smart contract interactions, please refer to the respective documentation files.*