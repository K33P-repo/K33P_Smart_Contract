# New Signup Flow Endpoints

This document describes the new 8-step signup flow endpoints that separate PIN setup, PIN confirmation, biometric setup, and username setup into individual API calls.

## Overview

The new signup flow consists of 8 distinct steps:

1. **Phone Number Input** (existing)
2. **OTP Sending** (existing)
3. **OTP Verification** (existing)
4. **PIN Setup** (NEW)
5. **PIN Confirmation** (NEW)
6. **Biometric Setup** (NEW)
7. **DID Creation & Signup Completion** (NEW)
8. **Username Setup** (NEW)

## Session Management

All new endpoints use session-based state management with a 30-minute TTL. Each session is identified by a unique `sessionId` that must be passed between endpoints.

## New Endpoints

### 1. Setup PIN - Step 4

**POST** `/api/auth/setup-pin`

Sets up a 4-digit PIN after OTP verification.

#### Request Body
```json
{
  "phoneNumber": "+1234567890",
  "pin": "1234",
  "sessionId": "signup_uuid" // Optional, will be generated if not provided
}
```

#### Response
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

#### Validation
- PIN must be exactly 4 digits
- Phone number is required
- Rate limited: 10 attempts per 15 minutes

---

### 2. Confirm PIN - Step 5

**POST** `/api/auth/confirm-pin`

Confirms the 4-digit PIN by re-entering it.

#### Request Body
```json
{
  "sessionId": "signup_uuid",
  "pin": "1234"
}
```

#### Response
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

#### Validation
- Session must exist and be valid
- PIN must match the one set in step 4
- Rate limited: 10 attempts per 15 minutes

---

### 3. Setup Biometric - Step 6

**POST** `/api/auth/setup-biometric`

Sets up biometric authentication (optional step).

#### Request Body
```json
{
  "sessionId": "signup_uuid",
  "biometricType": "fingerprint", // Optional: "fingerprint", "faceid", "voice", "iris"
  "biometricData": "base64_encoded_data" // Optional: biometric template data
}
```

#### Response
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

#### Validation
- Session must exist and PIN must be confirmed
- Biometric type must be one of: fingerprint, faceid, voice, iris
- Both biometricType and biometricData are optional (can skip biometric setup)
- Rate limited: 10 attempts per 15 minutes

---

### 4. Complete Signup - Step 7

**POST** `/api/auth/complete-signup`

Completes the signup process with DID creation and ZK proof generation.

#### Request Body
```json
{
  "sessionId": "signup_uuid"
}
```

#### Response
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

#### Process
- Creates DID and wallet address
- Generates ZK commitments and proofs
- Processes 2 ADA deposit and refund
- Stores user data in the system
- Rate limited: 5 attempts per 15 minutes

---

### 5. Setup Username - Step 8

**POST** `/api/auth/setup-username`

Sets up a username after DID creation.

#### Request Body
```json
{
  "sessionId": "signup_uuid",
  "username": "myusername",
  "userId": "user_uuid" // Optional, will use session userId if not provided
}
```

#### Response
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

#### Validation
- Username must be 3-30 characters
- Username can only contain letters, numbers, and underscores
- Username must be unique
- Signup must be completed before username setup
- Rate limited: 10 attempts per 15 minutes

---

### 6. Session Status - Helper Endpoint

**GET** `/api/auth/session-status/:sessionId`

Returns the current status of a signup session.

#### Response
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

#### Features
- Phone number is masked for privacy
- No sensitive data (PIN, biometric data) is returned
- Rate limited: 20 requests per 5 minutes

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common Error Codes

- **400 Bad Request**: Invalid input data or missing required fields
- **404 Not Found**: Session not found or expired
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error

## Rate Limiting

All endpoints have rate limiting to prevent abuse:

- **PIN Setup/Confirmation**: 10 attempts per 15 minutes
- **Biometric Setup**: 10 attempts per 15 minutes
- **Complete Signup**: 5 attempts per 15 minutes
- **Username Setup**: 10 attempts per 15 minutes
- **Session Status**: 20 requests per 5 minutes

## Security Features

1. **Session Expiration**: All sessions expire after 30 minutes
2. **Data Validation**: Strict validation on all input fields
3. **Rate Limiting**: Prevents brute force attacks
4. **Data Masking**: Sensitive data is masked in responses
5. **Step Validation**: Each step validates that previous steps were completed
6. **ZK Proofs**: Zero-knowledge proofs for privacy-preserving authentication

## Integration Example

```javascript
// Step 4: Setup PIN
const pinSetup = await fetch('/api/auth/setup-pin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+1234567890',
    pin: '1234'
  })
});
const { sessionId } = await pinSetup.json();

// Step 5: Confirm PIN
const pinConfirm = await fetch('/api/auth/confirm-pin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    pin: '1234'
  })
});

// Step 6: Setup Biometric (optional)
const biometricSetup = await fetch('/api/auth/setup-biometric', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    biometricType: 'fingerprint',
    biometricData: 'base64_data'
  })
});

// Step 7: Complete Signup
const signupComplete = await fetch('/api/auth/complete-signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId })
});
const { userId } = await signupComplete.json();

// Step 8: Setup Username
const usernameSetup = await fetch('/api/auth/setup-username', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    username: 'myusername',
    userId
  })
});
const { token } = await usernameSetup.json();

// Store token for authenticated requests
localStorage.setItem('authToken', token);
```

## Migration from Legacy Signup

The existing all-in-one signup endpoint (`/api/auth/signup`) remains functional for backward compatibility. New applications should use the 8-step flow for better user experience and error handling.

## Production Considerations

1. **Session Storage**: Replace NodeCache with Redis for production scalability
2. **Rate Limiting**: Consider using Redis for distributed rate limiting
3. **Monitoring**: Add comprehensive logging and monitoring for each step
4. **Error Tracking**: Implement error tracking for failed signup attempts
5. **Analytics**: Track conversion rates at each step of the signup flow