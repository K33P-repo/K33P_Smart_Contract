# K33P API Routes Documentation

This document outlines all the API routes that the frontend developer needs to implement the seed phrase storage functionality.

## Base URL
```
Production: https://api.k33p.io/api
Staging: https://staging-api.k33p.io/api
Development: http://localhost:3001/api
```

## Authentication
All routes (except auth routes) require Bearer token authentication:
```
Authorization: Bearer <access_token>
```

---

## 1. Authentication Routes

### Phone-Based Authentication (Recommended)

#### POST `/users/signup`
Register new user with phone number, PIN, and biometric data

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "pin": "1234",
  "userName": "John Doe",
  "authMethods": ["pin", "face_id"],
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
  "message": "User registered successfully",
  "data": {
    "userId": "user_12345",
    "phoneNumber": "+1234567890",
    "userName": "John Doe",
    "authMethods": ["pin", "face_id"]
  }
}
```

#### POST `/users/login/request-otp`
Request OTP for login

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

#### POST `/users/login/verify-otp`
Verify OTP and get temporary token

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
    "tempToken": "temp_eyJhbGciOiJIUzI1NiIs...",
    "userId": "user_12345",
    "authMethods": ["pin", "face_id"]
  }
}
```

#### POST `/users/login/pin`
Complete login with PIN authentication

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PIN login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400,
    "user": {
      "id": "user_12345",
      "phoneNumber": "+1234567890",
      "userName": "John Doe"
    }
  }
}
```

#### POST `/users/login/face-id`
Complete login with biometric authentication (Face ID, fingerprint, voice, iris)

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
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
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400,
    "user": {
      "id": "user_12345",
      "phoneNumber": "+1234567890",
      "userName": "John Doe"
    }
  }
}
```

#### POST `/users/logout`
Logout user (invalidate tokens)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### POST `/users/enroll-biometric`
Enroll biometric data for authenticated user

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "biometricType": "face_id",
  "biometricData": "base64encodedbiometricdata"
}
```

**Response:**
```json
{
  "success": true,
  "message": "face_id enrolled successfully",
  "data": {
    "biometricType": "face_id",
    "authMethods": ["pin", "face_id"]
  }
}
```

#### DELETE `/users/remove-biometric`
Remove biometric data for authenticated user

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "biometricType": "face_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "face_id removed successfully",
  "data": {
    "biometricType": "face_id",
    "authMethods": ["pin"]
  }
}
```

#### GET `/users/auth-methods`
Get available authentication methods for authenticated user

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication methods retrieved successfully",
  "data": {
    "authMethods": ["pin", "face_id", "fingerprint"],
    "enrolledBiometrics": ["face_id", "fingerprint"],
    "unenrolledBiometrics": ["voice", "iris"],
    "canEnrollMore": true
  }
}
```

#### POST `/users/passkey/register-begin`
Begin passkey registration process for authenticated user

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Passkey registration options generated",
  "data": {
    "challenge": "base64url_challenge",
    "rp": {
      "name": "K33P Smart Contract",
      "id": "localhost"
    },
    "user": {
      "id": "base64url_user_id",
      "name": "+1234567890",
      "displayName": "Test User"
    },
    "pubKeyCredParams": [
      {"alg": -7, "type": "public-key"},
      {"alg": -257, "type": "public-key"}
    ],
    "authenticatorSelection": {
      "authenticatorAttachment": "platform",
      "userVerification": "required"
    },
    "timeout": 60000,
    "attestation": "direct"
  }
}
```

#### POST `/users/passkey/register-complete`
Complete passkey registration process

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "credential": {
    "id": "credential_id",
    "response": {
      "publicKey": "public_key_data"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Passkey registered successfully",
  "data": {
    "credentialId": "credential_id",
    "authMethod": "passkey"
  }
}
```

#### POST `/users/login/passkey-begin`
Begin passkey authentication process

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
  "message": "Passkey authentication options generated",
  "data": {
    "challenge": "base64url_challenge",
    "allowCredentials": [
      {
        "id": "credential_id",
        "type": "public-key",
        "transports": ["internal", "hybrid"]
      }
    ],
    "userVerification": "required",
    "timeout": 60000
  }
}
```

#### POST `/users/login/passkey-complete`
Complete passkey authentication process

**Request Body:**
```json
{
  "credential": {
    "id": "credential_id",
    "response": {
      "signature": "signature_data"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Passkey authentication successful",
  "data": {
    "user": {
      "id": "user123",
      "phoneNumber": "+1234567890",
      "userName": "Test User"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    }
  }
}
```

#### DELETE `/users/passkey/remove`
Remove a passkey from user account

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "credentialId": "credential_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Passkey removed successfully",
  "data": {
    "credentialId": "credential_id",
    "remainingPasskeys": 1
  }
}
```

#### POST `/users/refresh-token`
Refresh access token

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

### Legacy Authentication Routes

#### POST `/auth/login`
Login user with email and password (Legacy)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "userPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400,
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

#### POST `/auth/register`
Register new user with email (Legacy)

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "userPassword123!",
  "confirmPassword": "userPassword123!"
}
```

#### POST `/auth/refresh`
Refresh access token (Legacy)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST `/auth/logout`
Logout user (Legacy)

---

## 2. Seed Phrase Management Routes

### POST `/seed-phrases/store`
Store a new seed phrase on Iagon

**Request Body:**
```json
{
  "walletName": "My Bitcoin Wallet",
  "walletType": "bitcoin",
  "mnemonicType": "12-word",
  "seedPhrase": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  "encryptionPassword": "mySecurePassword123!",

}
```

**Response:**
```json
{
  "success": true,
  "message": "Seed phrase stored successfully",
  "data": {
    "seedPhraseId": "sp_123456789",
    "iagonStorageId": "iagon_abc123",
    "walletName": "My Bitcoin Wallet",
    "walletType": "bitcoin",
    "mnemonicType": "12-word",

  }
}
```

### GET `/seed-phrases`
Get user's stored seed phrases (metadata only)

**Response:**
```json
{
  "success": true,
  "message": "Seed phrases retrieved successfully",
  "data": [
    {
      "id": "sp_123456789",
      "walletName": "My Bitcoin Wallet",
      "walletType": "bitcoin",
      "mnemonicType": "12-word",

      "createdAt": "2024-01-15T10:00:00Z",
      "lastAccessed": "2024-01-20T15:30:00Z",
      "accessCount": 5
    }
  ]
}
```

### POST `/seed-phrases/{seedPhraseId}/retrieve`
Retrieve a specific seed phrase (owner only)

**Request Body:**
```json
{
  "encryptionPassword": "mySecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Seed phrase retrieved successfully",
  "data": {
    "seedPhrase": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    "walletName": "My Bitcoin Wallet",
    "walletType": "bitcoin",
    "mnemonicType": "12-word"
  }
}
```


```

### DELETE `/seed-phrases/{seedPhraseId}`
Delete a seed phrase

**Request Body:**
```json
{
  "encryptionPassword": "mySecurePassword123!"
}
```







---

## 3. User Management Routes

### GET `/user/profile`
Get user profile information

**Response:**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "user123",
    "name": "John Doe",
    "email": "user@example.com",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-25T10:00:00Z",
    "twoFactorEnabled": false,
    "emailVerified": true
  }
}
```

### PUT `/user/profile`
Update user profile

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "newemail@example.com"
}
```

### GET `/user/activity`
Get user activity log

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Activity log retrieved successfully",
  "data": {
    "activities": [
      {
        "id": "act_123",
        "type": "seed_phrase_stored",
        "description": "Stored new seed phrase for Bitcoin wallet",
        "timestamp": "2024-01-25T10:00:00Z",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0..."
      }
    ],
    "pagination": {
      "total": 100,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

## 4. Security Routes

### POST `/security/2fa/setup`
Setup two-factor authentication

**Response:**
```json
{
  "success": true,
  "message": "2FA setup initiated",
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "secret": "JBSWY3DPEHPK3PXP",
    "backupCodes": [
      "12345678",
      "87654321"
    ]
  }
}
```

### POST `/security/2fa/verify`
Verify and enable 2FA

**Request Body:**
```json
{
  "code": "123456"
}
```

### GET `/security/sessions`
Get active sessions

**Response:**
```json
{
  "success": true,
  "message": "Sessions retrieved successfully",
  "data": [
    {
      "id": "session_123",
      "deviceInfo": "Chrome on Windows",
      "ipAddress": "192.168.1.1",
      "location": "New York, US",
      "lastActivity": "2024-01-25T10:00:00Z",
      "isCurrent": true
    }
  ]
}
```

### DELETE `/security/sessions/{sessionId}/revoke`
Revoke a specific session

---

## 5. Notification Routes

### GET `/notifications`
Get user notifications

**Query Parameters:**
- `unread` (optional): Filter unread notifications (true/false)
- `category` (optional): Filter by category (security, system, account)
- `limit` (optional): Number of results (default: 20)

**Response:**
```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "id": "notif_123",
        "type": "info",
        "category": "security",
        "title": "Security Alert",
        "message": "New login detected from unknown device",
        "isRead": false,
        "createdAt": "2024-01-25T10:00:00Z",
        "actionUrl": "/security/sessions"
      }
    ],
    "unreadCount": 5
  }
}
```

### PUT `/notifications/{notificationId}/read`
Mark notification as read

### PUT `/notifications/mark-all-read`
Mark all notifications as read

---

## 6. Phone Number Management Routes

### POST `/phone/change/initiate`
Initiate phone number change request

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPhoneNumber": "+1234567890",
  "newPhoneNumber": "+1987654321",
  "verificationMethod": "sms"
}
```

**Verification Methods:**
- `sms`: SMS verification to current phone
- `email`: Email verification
- `onchain`: Blockchain transaction verification

**Response:**
```json
{
  "success": true,
  "message": "Phone change request initiated",
  "data": {
    "requestId": "req_12345",
    "verificationMethod": "sms",
    "expiresAt": "2024-01-01T12:30:00Z"
  }
}
```

### POST `/phone/change/verify`
Verify phone number change request

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "requestId": "req_12345",
  "verificationCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number changed successfully",
  "data": {
    "newPhoneHash": "hashed_phone_number",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### GET `/phone/change/status/{requestId}`
Get phone change request status

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requestId": "req_12345",
    "status": "pending",
    "verificationMethod": "sms",
    "attemptsRemaining": 2,
    "expiresAt": "2024-01-01T12:30:00Z"
  }
}
```

**Status Values:**
- `pending`: Awaiting verification
- `verified`: Verification successful
- `completed`: Phone number updated
- `failed`: Verification failed
- `expired`: Request expired

---

## 7. Account Recovery Routes

### POST `/recovery/initiate`
Initiate account recovery process

**Request Body:**
```json
{
  "identifier": "+1234567890",
  "recoveryMethod": "backup_phrase",
  "newPhoneNumber": "+1987654321"
}
```

**Recovery Methods:**
- `backup_phrase`: 12-word backup phrase verification
- `emergency_contact`: Emergency contact verification
- `onchain_proof`: Blockchain transaction verification
- `multi_factor`: Multiple verification methods

**Response:**
```json
{
  "success": true,
  "message": "Recovery process initiated",
  "data": {
    "recoveryId": "rec_12345",
    "recoveryMethod": "backup_phrase",
    "expiresAt": "2024-01-01T12:30:00Z"
  }
}
```

### POST `/recovery/verify-backup-phrase`
Verify backup phrase for account recovery

**Request Body:**
```json
{
  "recoveryId": "rec_12345",
  "backupPhrase": "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Backup phrase verified successfully",
  "data": {
    "recoveryId": "rec_12345",
    "newPhoneHash": "hashed_phone_number",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### POST `/recovery/verify-emergency-contact`
Verify emergency contact for account recovery

**Request Body:**
```json
{
  "recoveryId": "rec_12345",
  "emergencyToken": "token_from_email"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Emergency contact verified successfully",
  "data": {
    "recoveryId": "rec_12345",
    "newPhoneHash": "hashed_phone_number",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### POST `/recovery/verify-onchain`
Verify blockchain proof for account recovery

**Request Body:**
```json
{
  "recoveryId": "rec_12345",
  "walletAddress": "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj0vs2qd4a6gtmk4l3zcjdkz0xn",
  "txHash": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Blockchain verification successful",
  "data": {
    "recoveryId": "rec_12345",
    "newPhoneHash": "hashed_phone_number",
    "txHash": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### GET `/recovery/status/{recoveryId}`
Get account recovery status

**Response:**
```json
{
  "success": true,
  "data": {
    "recoveryId": "rec_12345",
    "status": "pending",
    "recoveryMethod": "backup_phrase",
    "timestamp": "2024-01-01T12:00:00Z",
    "expiresAt": "2024-01-01T12:30:00Z",
    "verificationData": {
      "backupPhraseVerified": false,
      "emergencyContactVerified": false,
      "onchainProofVerified": false
    }
  }
}
```

**Recovery Status Values:**
- `pending`: Awaiting verification
- `verified`: Verification successful
- `completed`: Recovery completed
- `failed`: Recovery failed
- `expired`: Recovery request expired

---

## 8. System Routes

### GET `/health`
Health check endpoint

**Response:**
```json
{
  "success": true,
  "message": "System is healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-25T10:00:00Z",
    "version": "1.0.0",
    "uptime": 86400
  }
}
```

### GET `/status`
System status and statistics

**Response:**
```json
{
  "success": true,
  "message": "System status retrieved",
  "data": {
    "totalUsers": 1250,
    "totalSeedPhrases": 3420,

    "systemLoad": "normal",
    "maintenanceMode": false
  }
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  }
}
```

### Common Error Codes:
- `AUTH_INVALID_CREDENTIALS`: Invalid email or password
- `AUTH_TOKEN_EXPIRED`: Access token has expired
- `AUTH_TOKEN_INVALID`: Invalid access token
- `PHONE_ALREADY_EXISTS`: Phone number already registered
- `OTP_EXPIRED`: OTP has expired
- `OTP_INVALID`: Invalid OTP code
- `BIOMETRIC_VERIFICATION_FAILED`: Biometric authentication failed
- `PIN_INVALID`: Invalid PIN
- `USER_NOT_FOUND`: User not found
- `BIOMETRIC_NOT_ENROLLED`: Requested biometric type is not enrolled for user
- `LAST_AUTH_METHOD`: Cannot remove the last authentication method
- `PASSKEY_NOT_FOUND`: No passkeys found for the user
- `PASSKEY_VERIFICATION_FAILED`: Passkey authentication failed
- `WEBAUTHN_ERROR`: WebAuthn operation failed
- `VALIDATION_ERROR`: Request validation failed
- `SEED_PHRASE_NOT_FOUND`: Seed phrase not found
- `ACCESS_DENIED`: Insufficient permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVER_ERROR`: Internal server error
- `PHONE_CHANGE_REQUEST_NOT_FOUND`: Phone change request not found
- `PHONE_CHANGE_REQUEST_EXPIRED`: Phone change request has expired
- `PHONE_CHANGE_VERIFICATION_FAILED`: Phone change verification failed
- `PHONE_CHANGE_MAX_ATTEMPTS_EXCEEDED`: Maximum verification attempts exceeded
- `RECOVERY_REQUEST_NOT_FOUND`: Recovery request not found
- `RECOVERY_REQUEST_EXPIRED`: Recovery request has expired
- `BACKUP_PHRASE_INVALID`: Invalid backup phrase
- `EMERGENCY_CONTACT_NOT_FOUND`: Emergency contact not found
- `EMERGENCY_TOKEN_INVALID`: Invalid emergency contact token
- `ONCHAIN_VERIFICATION_FAILED`: Blockchain verification failed
- `RECOVERY_METHOD_NOT_SUPPORTED`: Recovery method not supported
- `RECOVERY_MAX_ATTEMPTS_EXCEEDED`: Maximum recovery attempts exceeded

---

## Rate Limiting

- Authentication endpoints: 5 requests per minute
- Seed phrase operations: 10 requests per minute
- Phone change operations: 3 requests per 15 minutes
- Account recovery operations: 5 requests per 30 minutes
- General endpoints: 100 requests per minute

---

## Request/Response Headers

### Required Request Headers:
```
Content-Type: application/json
Authorization: Bearer <access_token>
X-Device-ID: <device_identifier>
```

### Response Headers:
```
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## WebSocket Events (Optional)

For real-time notifications:

### Connection:
```
ws://localhost:3001/ws?token=<access_token>
```

### Events:
- `seed_phrase_accessed`: Seed phrase was accessed
- `security_alert`: Security-related notifications

---

This documentation provides all the API routes needed for the frontend developer to implement the seed phrase management system. Each route includes request/response examples and error handling information.