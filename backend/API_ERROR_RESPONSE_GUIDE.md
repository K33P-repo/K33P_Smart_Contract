# API Error Response Guide

This guide provides comprehensive documentation for all error codes used in the K33P Smart Contract API. All error responses follow a consistent structure and use specific error codes for better client-side error handling.

## Error Response Structure

All API error responses follow this consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "details": {}, // Optional additional details
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Error Categories

### Authentication & Authorization Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password | User provided incorrect login credentials |
| `AUTH_TOKEN_EXPIRED` | 401 | Your session has expired. Please log in again | JWT token has expired |
| `AUTH_TOKEN_INVALID` | 401 | Invalid authentication token | JWT token is malformed or invalid |
| `AUTH_TOKEN_MISSING` | 401 | Authentication required | No authentication token provided |
| `TOKEN_REQUIRED` | 400 | Authentication token is required | Token parameter is missing from request |
| `TOKEN_INVALID` | 401 | Invalid or expired token | Token verification failed |
| `ACCESS_DENIED` | 403 | Access denied. Insufficient permissions | User lacks required permissions |

### User Management Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `USER_NOT_FOUND` | 404 | User account not found | User does not exist in the system |
| `USER_ALREADY_EXISTS` | 409 | An account with this information already exists | Duplicate user registration attempt |
| `USER_ALREADY_SIGNED_UP` | 409 | You have already completed the signup process and a refund has been issued | User trying to signup again |
| `USER_ALREADY_REFUNDED` | 409 | A refund has already been processed for this account | Duplicate refund request |
| `USER_NO_ADA_SENT` | 400 | No ADA deposit found for this account. Please send the required deposit first | User hasn't made required deposit |
| `USER_SECOND_TIME_USE` | 409 | This account has been used before. Each account can only be used once | Account reuse attempt |
| `USER_CREATION_FAILED` | 500 | Failed to create user account. Please try again | Server error during user creation |
| `USER_UPDATE_FAILED` | 500 | Failed to update user information | Server error during user update |

### Phone & Wallet Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `PHONE_ALREADY_EXISTS` | 409 | This phone number is already registered with another account | Duplicate phone number |
| `PHONE_INVALID_FORMAT` | 400 | Please enter a valid phone number | Phone number format validation failed |
| `PHONE_REQUIRED` | 400 | Phone number is required | Missing phone number parameter |
| `WALLET_ALREADY_EXISTS` | 409 | This wallet is already registered with another account | Duplicate wallet registration |
| `WALLET_ADDRESS_IN_USE` | 409 | This wallet address is already associated with another account | Wallet already linked to another user |
| `WALLET_ADDRESS_INVALID` | 400 | Please enter a valid Cardano wallet address | Invalid wallet address format |
| `WALLET_ADDRESS_REQUIRED` | 400 | Wallet address is required | Missing wallet address parameter |
| `WALLET_ADDRESS_NOT_FOUND` | 404 | No wallet address found for this account | User has no linked wallet |
| `WALLET_IN_USE` | 409 | This wallet address is already in use | General wallet conflict error |

### OTP & Verification Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `OTP_EXPIRED` | 410 | Verification code has expired. Please request a new one | OTP has exceeded time limit |
| `OTP_INVALID` | 400 | Invalid verification code. Please try again | OTP verification failed |
| `OTP_SEND_FAILED` | 500 | Failed to send verification code. Please try again | SMS/email delivery failed |
| `OTP_REQUEST_ID_REQUIRED` | 400 | OTP request ID is required | Missing OTP request identifier |
| `OTP_CODE_REQUIRED` | 400 | OTP code is required | Missing OTP code parameter |
| `OTP_CODE_INVALID_FORMAT` | 400 | OTP code must be exactly 5 digits | OTP format validation failed |

### Biometric & PIN Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `BIOMETRIC_VERIFICATION_FAILED` | 401 | Biometric verification failed. Please try again | Biometric authentication failed |
| `BIOMETRIC_NOT_ENROLLED` | 400 | Biometric authentication is not set up for your account | User hasn't enrolled biometrics |
| `BIOMETRIC_DATA_REQUIRED` | 400 | Biometric data is required for this verification method | Missing biometric data |
| `PIN_INVALID` | 401 | Incorrect PIN. Please try again | PIN verification failed |
| `PIN_SETUP_FAILED` | 500 | Failed to set up PIN. Please try again | Server error during PIN setup |
| `PIN_REQUIRED` | 400 | PIN is required | Missing PIN parameter |
| `PIN_INVALID_FORMAT` | 400 | PIN must be exactly 4 digits | PIN format validation failed |
| `PIN_NOT_FOUND` | 404 | No PIN found for this user. Please contact support | User has no PIN configured |

### Username & Session Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `USERNAME_REQUIRED` | 400 | Username is required | Missing username parameter |
| `USERNAME_ALREADY_EXISTS` | 409 | This username is already taken. Please choose another | Duplicate username |
| `USERNAME_INVALID_FORMAT` | 400 | Username format is invalid | Username validation failed |
| `SESSION_ID_REQUIRED` | 400 | Session ID is required | Missing session identifier |
| `SESSION_NOT_FOUND` | 404 | Session not found or expired | Session doesn't exist |
| `SESSION_INVALID` | 401 | Invalid session | Session verification failed |

### Zero-Knowledge Proof Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `ZK_PROOF_INVALID` | 400 | Invalid zero-knowledge proof | ZK proof verification failed |
| `ZK_PROOF_GENERATION_FAILED` | 500 | Failed to generate zero-knowledge proof | Server error during ZK proof generation |
| `ZK_COMMITMENT_INVALID` | 400 | Invalid zero-knowledge commitment | ZK commitment verification failed |
| `ZK_PROOF_REQUIRED` | 400 | Zero-knowledge proof is required | Missing ZK proof parameter |
| `ZK_COMMITMENT_REQUIRED` | 400 | Zero-knowledge commitment is required | Missing ZK commitment parameter |

### Transaction & Refund Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `TRANSACTION_FAILED` | 500 | Transaction failed. Please try again | Blockchain transaction failed |
| `TRANSACTION_NOT_FOUND` | 404 | No valid transaction found | Required transaction not found |
| `REFUND_FAILED` | 500 | Refund processing failed. Our team has been notified and will resolve this issue | Refund transaction failed |
| `REFUND_ALREADY_PROCESSED` | 409 | A refund has already been processed for this transaction | Duplicate refund attempt |
| `REFUND_NOT_ELIGIBLE` | 400 | This transaction is not eligible for a refund | Transaction doesn't meet refund criteria |
| `DEPOSIT_VERIFICATION_FAILED` | 400 | Could not verify your ADA deposit. Please ensure the transaction is confirmed | Deposit verification failed |
| `DEPOSIT_NOT_FOUND` | 404 | No valid deposit found | Required deposit not found |

### Validation Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `VALIDATION_ERROR` | 400 | Please check your input and try again | General validation error |
| `INVALID_INPUT` | 400 | Invalid input provided | Input format or type error |
| `MISSING_REQUIRED_FIELDS` | 400 | Please fill in all required fields | Required parameters missing |
| `IDENTIFIER_REQUIRED` | 400 | User identifier is required | Missing user ID or identifier |

### Rate Limiting Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests. Please wait a moment and try again | API rate limit exceeded |

### Server Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `SERVER_ERROR` | 500 | Something went wrong on our end. Please try again later | General server error |
| `DATABASE_ERROR` | 500 | Database connection error. Please try again later | Database operation failed |
| `EXTERNAL_SERVICE_ERROR` | 503 | External service temporarily unavailable. Please try again later | Third-party service error |

### Storage & Seed Phrase Errors

| Error Code | HTTP Status | Message | Description |
|------------|-------------|---------|-------------|
| `SEED_PHRASE_NOT_FOUND` | 404 | Seed phrase not found | User's seed phrase not found |
| `SEED_PHRASE_ENCRYPTION_FAILED` | 500 | Failed to encrypt seed phrase | Encryption process failed |
| `STORAGE_SERVICE_ERROR` | 503 | Storage service error. Please try again later | Storage service unavailable |

## Error Handling Best Practices

### For Frontend Developers

1. **Always check the `success` field** first to determine if the request was successful
2. **Use the `error.code`** for programmatic error handling rather than parsing messages
3. **Display the `error.message`** to users as it's designed to be user-friendly
4. **Check `error.details`** for additional context when available
5. **Implement retry logic** for 5xx errors and rate limiting (429)

### Example Error Handling

```javascript
// Example API response handling
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify(userData)
});

const result = await response.json();

if (!result.success) {
  switch (result.error.code) {
    case 'PHONE_ALREADY_EXISTS':
      showError('This phone number is already registered');
      break;
    case 'WALLET_IN_USE':
      showError('Wallet address is already in use');
      break;
    case 'RATE_LIMIT_EXCEEDED':
      const retryAfter = result.error.details?.retryAfter || 60;
      showError(`Too many requests. Please wait ${retryAfter} seconds`);
      break;
    case 'SERVER_ERROR':
      showError('Server error. Please try again later');
      break;
    default:
      showError(result.error.message);
  }
} else {
  // Handle success
  console.log('Operation successful:', result.data);
}
```

### Rate Limiting Details

When a rate limit is exceeded, the response includes additional details:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait a moment and try again",
    "details": {
      "retryAfter": 60,
      "limit": 10,
      "windowMs": 300000
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## API Endpoints and Common Errors

### Authentication Endpoints

- **POST /api/auth/signup** - Common errors: `PHONE_REQUIRED`, `WALLET_IN_USE`, `USER_CREATION_FAILED`
- **POST /api/auth/login** - Common errors: `USER_NOT_FOUND`, `ZK_PROOF_INVALID`
- **POST /api/auth/signin** - Common errors: `PHONE_REQUIRED`, `PIN_INVALID`, `OTP_INVALID`
- **POST /api/auth/logout** - Common errors: `SERVER_ERROR`
- **GET /api/auth/me** - Common errors: `USER_NOT_FOUND`, `TOKEN_INVALID`

### Wallet Endpoints

- **POST /api/auth/verify-wallet** - Common errors: `WALLET_ADDRESS_REQUIRED`, `WALLET_IN_USE`, `TRANSACTION_NOT_FOUND`
- **GET /api/auth/wallet-connect** - Common errors: `USER_NOT_FOUND`, `WALLET_ADDRESS_NOT_FOUND`
- **POST /api/auth/verify-deposit** - Common errors: `WALLET_ADDRESS_REQUIRED`, `DEPOSIT_NOT_FOUND`

### Verification Endpoints

- **POST /api/auth/send-otp** - Common errors: `PHONE_REQUIRED`, `OTP_SEND_FAILED`
- **POST /api/auth/verify-otp** - Common errors: `OTP_INVALID`, `OTP_EXPIRED`
- **POST /api/auth/verify** - Common errors: `TOKEN_REQUIRED`, `SESSION_INVALID`

This guide should be updated whenever new error codes are added or existing ones are modified.