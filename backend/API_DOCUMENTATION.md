# K33P Backend API Documentation

This document provides information about the available API endpoints for the K33P Identity System backend server.

## Base URL

In development environment:
```
http://localhost:3000/api
```

In production environment, the base URL will be different. The application uses the `getApiUrl` utility function to dynamically determine the appropriate URL based on the environment.

## Authentication

### Admin API Key

Some admin endpoints require an admin API key which should be included in the request headers:

```
X-API-KEY: k33p_admin_api_key_12345
```

### JWT Token Authentication

Most user-specific endpoints require JWT authentication. Include the access token in the Authorization header:

```
Authorization: Bearer your_jwt_access_token
```

### Authentication Flow

The K33P system supports two authentication flows:

#### 1. Phone-Based Authentication (Recommended)

1. **Signup**: `POST /api/users/signup` - Register with phone, PIN, biometric data, and username
2. **Login Process**:
   - `POST /api/users/login/request-otp` - Request OTP via SMS
   - `POST /api/users/login/verify-otp` - Verify OTP and get temporary token
   - `POST /api/users/login/pin` - Complete login with PIN authentication
   - `POST /api/users/login/face-id` - Alternative: Complete login with biometric verification (Face ID, fingerprint, etc.)

#### 2. Legacy Email Authentication

1. **Register**: `POST /api/users/register` - Register with email and password
2. **Login**: `POST /api/users/login` - Login with email and password

### Token Management

- **Access Token**: Short-lived token (15 minutes) for API access
- **Refresh Token**: Long-lived token (7 days) for obtaining new access tokens
- **Token Refresh**: `POST /api/users/refresh-token` - Get new access token using refresh token
- **Logout**: `POST /api/users/logout` - Invalidate refresh token

### Security Features

- **Multi-factor Authentication**: PIN + Biometric (Face ID, fingerprint, voice, iris)
- **OTP Verification**: SMS-based one-time passwords
- **Multiple Biometric Options**: Support for Face ID, fingerprint, voice recognition, and iris scanning
- **Token Rotation**: Automatic refresh token rotation on use
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive validation on all endpoints

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
| INVALID_CREDENTIALS | 401 | The provided login credentials are incorrect |
| ACCESS_DENIED | 403 | User does not have permission to access this resource |
| USER_NOT_FOUND | 404 | The specified user was not found |
| PHONE_ALREADY_EXISTS | 409 | A user with this phone number already exists |
| USERNAME_TAKEN | 409 | The requested username is already taken |
| OTP_EXPIRED | 400 | The OTP has expired and needs to be regenerated |
| OTP_INVALID | 400 | The provided OTP is incorrect |
| BIOMETRIC_VERIFICATION_FAILED | 401 | Biometric authentication failed |
| PIN_INVALID | 401 | The provided PIN is incorrect |
| FILE_TOO_LARGE | 400 | The uploaded file exceeds the maximum size limit |
| INVALID_FILE_TYPE | 400 | The uploaded file type is not supported |
| PAYMENT_FAILED | 402 | Payment processing failed |
| ACCOUNT_SUSPENDED | 403 | The user account has been suspended |
| FEATURE_NOT_AVAILABLE | 403 | This feature is not available for the current account type |

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

## User Authentication Endpoints

### Phone-Based User Signup

```
POST /api/users/signup
```

Registers a new user with phone number, PIN, biometric data, and username.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "pin": "1234",
  "biometricData": {
    "type": "face_id",
    "data": "base64encodedbiometricdata"
  },
  "username": "john_doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "user_12345",
    "userNumber": "K33P001234",
    "phoneNumber": "+1234567890",
    "username": "john_doe",
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Request Login OTP

```
POST /api/users/login/request-otp
```

Sends an OTP to the user's phone number for login.

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
    "otpSent": true,
    "expiresIn": 300
  }
}
```

### Verify Login OTP

```
POST /api/users/login/verify-otp
```

Verifies the OTP sent to the user's phone.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "otpVerified": true,
    "userId": "user_12345",
    "tempToken": "temporary_jwt_token"
  }
}
```

### PIN-Based Login

```
POST /api/users/login/pin
```

Completes login using PIN authentication.

**Request Body:**
```json
{
  "userId": "user_12345",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "user_12345",
    "username": "john_doe",
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Biometric Login

```
POST /api/users/login/face-id
```

Completes login using biometric authentication (Face ID, fingerprint, etc.).

**Request Body:**
```json
{
  "userId": "user_12345",
  "biometricData": {
    "type": "face_id",
    "data": "base64encodedbiometricdata"
  }
}
```

**Supported Biometric Types:**
- `face_id` - Face ID authentication
- `fingerprint` - Fingerprint authentication
- `voice` - Voice recognition
- `iris` - Iris scanning

**Response:**
```json
{
  "success": true,
  "message": "Biometric login successful",
  "data": {
    "userId": "user_12345",
    "username": "john_doe",
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

## User Profile Management Endpoints

### Get User Data

```
GET /api/users/data/:userId
```

Retrieves comprehensive user data including profile and settings.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Response:**
```json
{
  "success": true,
  "message": "User data retrieved successfully",
  "data": {
    "userId": "user_12345",
    "userNumber": "K33P001234",
    "phoneNumber": "+1234567890",
    "username": "john_doe",
    "avatar": "https://example.com/avatar.jpg",
    "accountStatus": "free",
    "authMethods": ["pin", "face_id"],
    "createdAt": "2023-06-01T12:34:56.789Z"
  }
}
```

### Update Username

```
PUT /api/users/username/:userId
```

Updates the user's username.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "username": "new_username"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Username updated successfully",
  "data": {
    "userId": "user_12345",
    "username": "new_username"
  }
}
```

### Upload Avatar

```
POST /api/users/avatar/:userId
```

Uploads a new avatar image for the user.

**Headers:**
```
Authorization: Bearer jwt_access_token
Content-Type: multipart/form-data
```

**Request Body:**
- `avatar`: Image file (JPG, PNG, GIF, max 5MB)

**Response:**
```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "userId": "user_12345",
    "avatarUrl": "https://example.com/uploads/avatar_12345.jpg"
  }
}
```

## Wallet Management Endpoints

### Add Wallet

```
POST /api/users/wallets/:userId
```

Adds a new wallet to the user's account.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "walletName": "My Bitcoin Wallet",
  "walletType": "bitcoin",
  "fileId": "file_abc123",
  "seedPhraseAvailable": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet added successfully",
  "data": {
    "walletId": "wallet_789",
    "walletName": "My Bitcoin Wallet",
    "walletType": "bitcoin",
    "fileId": "file_abc123",
    "createdAt": "2023-06-01T12:34:56.789Z"
  }
}
```

### Get User Wallets

```
GET /api/users/wallets/:userId
```

Retrieves all wallets associated with the user.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Response:**
```json
{
  "success": true,
  "message": "Wallets retrieved successfully",
  "data": {
    "wallets": [
      {
        "walletId": "wallet_789",
        "walletName": "My Bitcoin Wallet",
        "walletType": "bitcoin",
        "fileId": "file_abc123",
        "createdAt": "2023-06-01T12:34:56.789Z"
      }
    ],
    "totalWallets": 1
  }
}
```

## Account Management Endpoints

### Delete Account

```
DELETE /api/users/delete/:userId
```

Deletes the user's account permanently.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "confirmPin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

### Get Account Status

```
GET /api/users/account-status/:userId
```

Retrieves the user's account status and available features.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Response:**
```json
{
  "success": true,
  "message": "Account status retrieved successfully",
  "data": {
    "userId": "user_12345",
    "accountStatus": "free",
    "features": [
      "basic_wallet_management",
      "standard_security"
    ]
  }
}
```

### Update Account Status

```
PUT /api/users/account-status/:userId
```

Updates the user's account status.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "accountStatus": "premium"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account status updated successfully",
  "data": {
    "userId": "user_12345",
    "accountStatus": "premium"
  }
}
```

### Upgrade to Premium

```
POST /api/users/upgrade-pro/:userId
```

Upgrades the user's account to premium status.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "paymentMethod": "credit_card",
  "paymentToken": "payment_token_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully upgraded to premium",
  "data": {
    "userId": "user_12345",
    "accountStatus": "premium",
    "features": [
      "unlimited_wallets",
      "advanced_security",
      "priority_support",
      "backup_recovery"
    ]
  }
}
```

### Update Authentication Methods

```
PUT /api/users/auth-methods/:userId
```

Updates the user's authentication methods and preferences.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "authMethods": ["pin", "face_id"],
  "newPin": "5678",
  "biometricData": {
    "type": "face_id",
    "data": "base64encodedbiometricdata"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication methods updated successfully",
  "data": {
    "userId": "user_12345",
    "authMethods": ["pin", "face_id"],
    "hasBiometricData": true
  }
}
```

### Logout

```
POST /api/users/logout
```

Logs out the user and invalidates the refresh token.

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Refresh Token

```
POST /api/users/refresh-token
```

Refreshes the access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
  }
}
```

## Legacy Authentication Endpoints

*Note: These endpoints are maintained for backward compatibility but are deprecated in favor of the new phone-based authentication system.*

### Legacy User Registration

```
POST /api/users/register
```

Registers a new user with email and password (Legacy).

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "user_12345",
    "email": "user@example.com",
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Legacy Email Login

```
POST /api/users/login
```

Logs in a user with email and password (Legacy).

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "user_12345",
    "email": "user@example.com",
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Legacy Profile Management

```
GET /api/users/profile/:userId
```

Retrieves user profile information (Legacy).

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Response:**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "userId": "user_12345",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2023-06-01T12:34:56.789Z"
  }
}
```

```
PUT /api/users/profile/:userId
```

Updates user profile information (Legacy).

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "userId": "user_12345",
    "firstName": "John",
    "lastName": "Smith"
  }
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
