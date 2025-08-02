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

## Complete Flow Example

### Signup Flow (Consistent for All Auth Methods)
1. **Send OTP**: `POST /api/auth/send-otp` with phone number
2. **Verify OTP**: `POST /api/auth/verify-otp` with request ID and code
3. **Complete Signup**: `POST /api/auth/signup/{method}` with phone, auth method data, and user details
   - For PIN: `POST /api/auth/signup/pin` with PIN
   - For Biometric: `POST /api/auth/signup/biometric` with biometric data
   - For Passkey: `POST /api/auth/signup/passkey` with passkey data

**Note:** The signup flow is identical regardless of the authentication method chosen. Only the final signup endpoint and required authentication data differ.

### Signin Flow
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