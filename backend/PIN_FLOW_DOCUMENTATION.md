# PIN-Based Authentication Flow Documentation

This document describes the complete implementation of the 4-digit PIN authentication system for K33P, including OTP verification during signup and PIN verification during signin.

## Overview

The system now supports:
1. **OTP verification during signup** - Users receive a real OTP (replacing the dummy 00000)
2. **4-digit PIN storage during signup** - PINs are securely stored for later verification
3. **PIN verification during signin** - Users can sign in using their phone number and 4-digit PIN

## API Endpoints

### 1. Send OTP During Signup
**POST** `/api/auth/send-otp`

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
    "requestId": "firebase-1234567890-abc123",
    "expiresIn": 300
  }
}
```

**Rate Limiting:** 3 requests per 5 minutes

### 2. Verify OTP During Signup
**POST** `/api/auth/verify-otp`

```json
{
  "requestId": "firebase-1234567890-abc123",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "data": {
    "verified": true
  }
}
```

**Rate Limiting:** 10 requests per 5 minutes

### 3. Complete Signup with PIN
**POST** `/api/auth/signup/pin`

```json
{
  "phoneNumber": "+1234567890",
  "pin": "1234",
  "userId": "user-unique-id",
  "username": "myusername",
  "verificationMethod": "pin"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "userId": "user-unique-id",
    "verificationMethod": "pin",
    "message": "DID created successfully. Welcome to K33P!",
    "depositAddress": null
  },
  "message": "DID created successfully. Welcome to K33P!",
  "token": "jwt-token-here"
}
```

**Validation:**
- PIN must be exactly 4 digits
- Phone number is required
- User ID is required
- Username must be 3-30 characters (letters, numbers, underscores only)

### 3. Sign In with Phone Number, OTP, and PIN

**Step 1: Send OTP for Sign In**
**Endpoint:** `POST /api/auth/send-otp`

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
    "requestId": "req-123-456"
  }
}
```

**Step 2: Verify OTP**
**Endpoint:** `POST /api/auth/verify-otp`

**Request Body:**
```json
{
  "requestId": "req-123-456",
  "code": "12345"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

**Step 3: Complete Sign In with PIN**
**Endpoint:** `POST /api/auth/signin`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "otpRequestId": "req-123-456",
  "otpCode": "12345",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sign in successful",
  "data": {
    "userId": "user-123",
    "phoneNumber": "+1234567890",
    "username": "testuser",
    "walletAddress": "addr1...",
    "verificationMethod": "pin"
  },
  "token": "jwt-token-here"
}
```

**Rate Limiting:** 10 requests per 15 minutes

## Desired 8-Step Signup Flow vs Current Implementation

### Step-by-Step Implementation Status

#### ✅ Step 1: User puts phone number
**Status**: IMPLEMENTED
- **Endpoint**: `POST /api/auth/send-otp`
- **Implementation**: Existing endpoint handles phone number input

#### ✅ Step 2: OTP is sent to the number
**Status**: IMPLEMENTED
- **Endpoint**: `POST /api/auth/send-otp`
- **Implementation**: Firebase integration sends real OTP

#### ✅ Step 3: User enters the sent OTP code to verify
**Status**: IMPLEMENTED
- **Endpoint**: `POST /api/auth/verify-otp`
- **Implementation**: Firebase integration verifies OTP

#### ⚠️ Step 4: User setup 4 digits PIN
**Status**: PARTIALLY IMPLEMENTED
- **Current**: PIN setup is part of the main signup endpoint
- **Needed**: Separate endpoint for PIN setup only
- **ZK Implementation**: Uses existing ZK proof generation with PIN data

#### ⚠️ Step 5: Verify the 4 digits PIN and confirm
**Status**: PARTIALLY IMPLEMENTED
- **Current**: PIN verification is part of signin flow
- **Needed**: Separate PIN confirmation step during signup
- **ZK Implementation**: Uses existing ZK proof verification

#### ⚠️ Step 6: Setup third party security option (Face ID, Fingerprint, Voice ID, Iris Scan)
**Status**: PARTIALLY IMPLEMENTED
- **Current**: Biometric setup is part of main signup with routes like `/api/auth/signup/faceid`
- **Needed**: Separate endpoint for adding biometric after PIN setup
- **ZK Implementation**: Uses existing biometric hash and ZK proof generation

#### ✅ Step 7: Create DID by sending 2 ADA and get refund
**Status**: IMPLEMENTED
- **Endpoints**: 
  - `GET /api/deposit-address` - Get deposit address
  - `POST /api/refund` - Manual refund processing
  - Auto-refund monitor - Automatic refund processing
- **Implementation**: Complete 2 ADA deposit and refund system

#### ⚠️ Step 8: Setup username of choice
**Status**: PARTIALLY IMPLEMENTED
- **Current**: Username can be set during main signup
- **Needed**: Separate endpoint for username setup after DID creation
- **ZK Implementation**: Username is stored in user data, no additional ZK proof needed

### Current vs Desired Flow

**Current Implementation:**
```
1. Send OTP → 2. Verify OTP → 3. Complete Signup (all-in-one)
```

**Desired 8-Step Flow:**
```
1. Phone Input → 2. OTP Send → 3. OTP Verify → 4. PIN Setup → 
5. PIN Confirm → 6. Biometric Setup → 7. DID Creation → 8. Username Setup
```

### ZK Implementation Status

**Already Implemented ZK Features:**
- ✅ Phone number hashing and ZK commitment
- ✅ PIN hashing and ZK proof generation
- ✅ Biometric data hashing and ZK proof
- ✅ ZK proof verification for authentication
- ✅ Comprehensive ZK proof storage via ZKProofService

**No Additional ZK Implementation Needed:**
All ZK functionality is already implemented in the current system. The 8-step flow would use the existing ZK implementations but break them into separate endpoints for better UX.

## Implementation Summary

### What's Already Working ✅
- **Steps 1-3**: Phone input, OTP sending, and OTP verification
- **Step 7**: 2 ADA deposit and refund system
- **ZK Infrastructure**: Complete ZK proof system for all authentication methods

### What Needs New Endpoints ⚠️
- **Step 4**: Separate PIN setup endpoint
- **Step 5**: PIN confirmation endpoint
- **Step 6**: Separate biometric setup endpoint (post-PIN)
- **Step 8**: Username setup endpoint (post-DID creation)

### Recommended Implementation Approach
1. Create session management to track signup progress
2. Break current all-in-one signup into separate step endpoints
3. Add step validation to ensure proper flow sequence
4. Maintain existing ZK implementations (no changes needed)

---

## Current Implementation Details

### Current Signup Flow (All-in-One)
1. **Send OTP**: `POST /api/auth/send-otp` with phone number
2. **Verify OTP**: `POST /api/auth/verify-otp` with request ID and code
3. **Complete Signup**: `POST /api/auth/signup/{method}` with phone, auth method data, and user details
   - For PIN: `POST /api/auth/signup/pin` with PIN
   - For Biometric: `POST /api/auth/signup/biometric` with biometric data
   - For Passkey: `POST /api/auth/signup/passkey` with passkey data

**Note:** The signup flow is identical regardless of the authentication method chosen. Only the final signup endpoint and required authentication data differ.

### Current Signin Flow
1. **Send OTP**: `POST /api/auth/send-otp` with phone number
2. **Verify OTP**: `POST /api/auth/verify-otp` with request ID and code
3. **Complete Sign In**: `POST /api/auth/signin` with phone number, OTP details, and authentication method data
   - Users must sign in using the same authentication method they set up during signup

## Security Features

### Rate Limiting
- **OTP Sending**: 3 requests per 5 minutes per IP
- **OTP Verification**: 10 requests per 5 minutes per IP
- **Signup**: 5 attempts per 15 minutes per IP
- **Signin**: 10 attempts per 15 minutes per IP

### Data Storage
- **Phone Numbers**: Stored as hashed values for privacy
- **PINs**: Currently stored as plain text (consider hashing for production)
- **Sessions**: Managed through JWT tokens with configurable expiration

### Validation
- Phone number format validation
- PIN format validation (exactly 4 digits)
- Username validation (3-30 characters, alphanumeric + underscore)
- Request ID validation for OTP verification

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "error": "PIN must be exactly 4 digits"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Invalid PIN. Please try again."
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "User not found with this phone number"
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "error": "Too many OTP requests, please try again later"
}
```

## Testing

A test script is provided (`test_pin_flow.js`) that demonstrates the complete flow:

```bash
node test_pin_flow.js
```

This script will:
1. **Signup Flow:**
   - Send OTP to a test phone number
   - Verify the OTP
   - Complete signup with a 4-digit PIN
2. **Signin Flow:**
   - Send OTP for signin
   - Verify the OTP
   - Complete signin with phone number, OTP details, and PIN
3. **Error Testing:**
   - Test signin with wrong PIN (should fail)

## Firebase Integration

The system uses Firebase for OTP delivery:
- **Development**: Uses placeholder implementation that accepts any OTP
- **Production**: Requires proper Firebase configuration with service account

See `FIREBASE_AUTH_GUIDE.md` for Firebase setup instructions.

## Database Schema

User records include the following PIN-related fields:
- `phoneHash`: Hashed phone number for lookup
- `phoneNumber`: Original phone number (stored for reference)
- `pin`: 4-digit PIN (consider hashing for production)
- `verificationMethod`: Set to 'pin' for PIN-based users

## Production Considerations

1. **PIN Security**: Consider hashing PINs before storage
2. **Firebase Setup**: Configure proper Firebase credentials
3. **Rate Limiting**: Adjust rate limits based on usage patterns
4. **Monitoring**: Add logging and monitoring for authentication attempts
5. **Backup Authentication**: Consider implementing backup authentication methods

## Migration from Dummy OTP

The system now replaces the dummy OTP (00000) with real OTP verification:
- Existing users are not affected
- New signups will use the real OTP flow
- The dummy OTP is no longer accepted