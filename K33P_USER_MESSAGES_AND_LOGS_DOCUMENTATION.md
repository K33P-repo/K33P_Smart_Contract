# K33P Smart Contract - User Messages and Logs Documentation

This comprehensive document outlines all user-facing messages, API responses, error messages, and logging patterns used throughout the K33P Smart Contract application during user interactions.

## Table of Contents

1. [API Response Structure](#api-response-structure)
2. [Authentication Messages](#authentication-messages)
3. [User Management Messages](#user-management-messages)
4. [Transaction and UTXO Messages](#transaction-and-utxo-messages)
5. [Verification and ZK Proof Messages](#verification-and-zk-proof-messages)
6. [Error Messages and Codes](#error-messages-and-codes)
7. [Logging Patterns](#logging-patterns)
8. [Frontend User Interface Messages](#frontend-user-interface-messages)
9. [System Health and Status Messages](#system-health-and-status-messages)
10. [Security and Audit Messages](#security-and-audit-messages)

---

## API Response Structure

All API endpoints follow a consistent response structure:

### Success Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-25T12:34:56.789Z",
  "meta": {}
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-25T12:34:56.789Z",
  "details": {}
}
```

---

## Authentication Messages

### Signup Messages

#### Success Messages
- **"Signup successful!"** - Default success message for completed signup
- **"Signup successful! Verification complete."** - When user is immediately verified
- **"Signup recorded! Please follow verification instructions and send 2 ADA to the deposit address."** - When verification is pending
- **"User registered successfully"** - Backend confirmation of user creation
- **"Transaction created successfully"** - When signup transaction is built

#### Error Messages
- **"Failed to sign up. Please try again."** - Generic signup failure
- **"User already exists"** - When attempting to register existing user
- **"Wallet address already registered"** - Duplicate wallet address
- **"Invalid or missing parameters"** - Validation failure
- **"Either walletAddress or phone must be provided"** - Missing required fields

### Login Messages

#### Success Messages
- **"ZK login successful"** - Successful zero-knowledge proof login
- **"Authentication successful"** - General login success
- **"Passkey authentication successful"** - WebAuthn/passkey login success
- **"Token refreshed successfully"** - Access token renewal

#### Error Messages
- **"Invalid credentials"** - Wrong username/password
- **"ZK proof verification failed"** - Invalid zero-knowledge proof
- **"User not found"** - Account doesn't exist
- **"Invalid commitment for this user"** - ZK commitment mismatch
- **"Passkey authentication failed"** - WebAuthn verification failed
- **"Token expired"** - JWT token has expired
- **"Unauthorized access"** - Missing or invalid authentication

---

## User Management Messages

### Profile Management

#### Success Messages
- **"User profile created successfully"** - New profile creation
- **"Profile updated successfully"** - Profile modification
- **"User profile retrieved successfully"** - Profile data fetch
- **"Avatar uploaded successfully"** - Profile picture update
- **"Preferences saved successfully"** - Settings update

#### Error Messages
- **"User ID and email are required"** - Missing required profile fields
- **"Failed to create user profile"** - Profile creation failure
- **"User profile not found"** - Profile doesn't exist
- **"Invalid user ID format"** - Malformed user identifier
- **"Profile update failed"** - Modification error

### Phone Number Management

#### Success Messages
- **"Phone number change initiated"** - Change request started
- **"Verification code sent"** - OTP sent successfully
- **"Phone number updated successfully"** - Change completed
- **"Phone verification completed"** - Number verified

#### Error Messages
- **"Phone number already exists"** - Duplicate phone number
- **"Invalid phone number format"** - Format validation failure
- **"Phone change request not found"** - Invalid change request
- **"Phone change request expired"** - Request timeout
- **"Maximum verification attempts exceeded"** - Too many failed attempts

---

## Transaction and UTXO Messages

### Deposit Messages

#### Success Messages
- **"Deposit verified successfully"** - Transaction confirmation
- **"Transaction found and verified"** - Blockchain verification success
- **"Deposit amount confirmed"** - Correct amount received
- **"User deposit recorded"** - Database entry created

#### Error Messages
- **"Deposit not found"** - Transaction not located
- **"Insufficient deposit amount"** - Amount below required threshold
- **"Transaction verification failed"** - Blockchain verification error
- **"Deposit already processed"** - Duplicate processing attempt
- **"Invalid transaction hash"** - Malformed transaction ID

### Refund Messages

#### Success Messages
- **"Refund processed successfully"** - Refund transaction completed
- **"Refund transaction created"** - Transaction built and submitted
- **"Automatic refund initiated"** - System-triggered refund
- **"Refund verification completed"** - Refund confirmed on blockchain

#### Error Messages
- **"User not found or already refunded"** - Invalid refund request
- **"Refund processing failed"** - Transaction creation error
- **"Insufficient funds for refund"** - Wallet balance too low
- **"Refund transaction failed"** - Blockchain submission error
- **"User not eligible for refund"** - Conditions not met

---

## Verification and ZK Proof Messages

### Verification Messages

#### Success Messages
- **"Verification completed successfully"** - User verification finished
- **"ZK proof generated successfully"** - Proof creation success
- **"Commitment verified"** - ZK commitment validation
- **"Verification retry initiated"** - Manual retry started
- **"Auto-verification completed"** - Batch verification finished

#### Error Messages
- **"Verification failed"** - General verification error
- **"Invalid ZK proof"** - Proof validation failure
- **"Commitment generation failed"** - ZK commitment error
- **"Verification timeout"** - Process took too long
- **"Maximum verification attempts reached"** - Retry limit exceeded

### OTP Messages

#### Success Messages
- **"Verification code sent"** - OTP delivery success
- **"OTP verified successfully"** - Code validation success
- **"Verification cancelled"** - User-initiated cancellation

#### Error Messages
- **"Failed to send verification code"** - OTP delivery failure
- **"Invalid verification code"** - Wrong OTP entered
- **"Verification code expired"** - OTP timeout
- **"Too many verification attempts"** - Rate limit exceeded
- **"OTP service unavailable"** - External service error

---

## Error Messages and Codes

### Common Error Codes

| Error Code | HTTP Status | User Message |
|------------|-------------|-------------|
| `INVALID_INPUT` | 400 | "Invalid or missing parameters" |
| `UNAUTHORIZED` | 401 | "Authentication required or invalid credentials" |
| `FORBIDDEN` | 403 | "Insufficient permissions" |
| `NOT_FOUND` | 404 | "Resource not found" |
| `CONFLICT` | 409 | "Resource conflict" |
| `WALLET_IN_USE` | 400 | "Wallet address already registered" |
| `INTERNAL_ERROR` | 500 | "Internal server error" |
| `RATE_LIMITED` | 429 | "Too many requests, please try again later" |
| `VALIDATION_ERROR` | 400 | "Request validation failed" |
| `SERVICE_UNAVAILABLE` | 503 | "Service temporarily unavailable" |

### Authentication Error Codes

| Error Code | User Message |
|------------|-------------|
| `AUTH_INVALID_CREDENTIALS` | "Invalid email or password" |
| `AUTH_TOKEN_EXPIRED` | "Access token has expired" |
| `AUTH_TOKEN_INVALID` | "Invalid access token" |
| `ZK_VERIFICATION_FAILED` | "Zero-knowledge proof verification failed" |
| `PASSKEY_VERIFICATION_FAILED` | "Passkey authentication failed" |
| `WEBAUTHN_ERROR` | "WebAuthn operation failed" |

### User Management Error Codes

| Error Code | User Message |
|------------|-------------|
| `USER_NOT_FOUND` | "User not found" |
| `PHONE_ALREADY_EXISTS` | "Phone number already registered" |
| `BIOMETRIC_NOT_ENROLLED` | "Requested biometric type is not enrolled" |
| `LAST_AUTH_METHOD` | "Cannot remove the last authentication method" |
| `SEED_PHRASE_NOT_FOUND` | "Seed phrase not found" |

---

## Logging Patterns

### Log Levels and Usage

#### INFO Level Logs
- **"✅ User registered successfully"** - Successful user creation
- **"✅ Deposit verified successfully"** - Transaction verification
- **"✅ Refund processed successfully"** - Refund completion
- **"✅ ZK proof generated and stored successfully"** - Proof creation
- **"✅ Mock database initialized successfully"** - System initialization
- **"Audit Log"** - Successful operations audit

#### WARN Level Logs
- **"PostgreSQL connection failed, initializing mock database..."** - Fallback activation
- **"Audit Log - Failed Operation"** - Failed operations audit
- **"User found using fallback storage"** - Storage fallback usage
- **"Rate limit exceeded for user"** - Rate limiting triggered

#### ERROR Level Logs
- **"❌ Signup failed"** - Registration failure
- **"❌ Refund processing failed"** - Refund error
- **"❌ Unexpected error processing refund"** - Unexpected refund error
- **"❌ Transaction verification failed"** - Verification error
- **"Failed to create user profile"** - Profile creation error
- **"Fallback storage also failed"** - Complete storage failure

### Audit Logging

Audit logs capture:
- **User ID** - Who performed the action
- **Action** - What was done (LOGIN, REGISTER, ACCESS, etc.)
- **Resource** - What was accessed (USER_AUTH, SEED_PHRASE, etc.)
- **IP Address** - Where the request came from
- **User Agent** - Client information
- **Success Status** - Whether the operation succeeded
- **Performance Metrics** - Duration, request/response sizes

#### Audit Log Examples
```json
{
  "userId": "user123",
  "action": "LOGIN",
  "resource": "USER_AUTH",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2024-01-25T12:34:56.789Z",
  "success": true,
  "details": {
    "method": "POST",
    "path": "/api/auth/login",
    "statusCode": 200,
    "duration": 150
  }
}
```

---

## Frontend User Interface Messages

### Signup Flow Messages

#### Step Indicators
- **"Step 1: Wallet Connection"** - Initial wallet setup
- **"Step 2: Phone Verification"** - Phone number entry
- **"Step 3: Biometric Setup"** - Biometric enrollment
- **"Step 4: Deposit Information"** - Payment instructions

#### User Guidance
- **"Please connect your wallet to continue"** - Wallet connection prompt
- **"Enter your phone number for verification"** - Phone input instruction
- **"Set up biometric authentication for enhanced security"** - Biometric setup
- **"Send exactly 2 ADA to the address below"** - Deposit instruction
- **"Your signup is being processed"** - Processing status

#### Loading States
- **"Connecting to wallet..."** - Wallet connection in progress
- **"Sending verification code..."** - OTP delivery
- **"Verifying transaction..."** - Blockchain verification
- **"Processing signup..."** - Final registration

### Error Display Messages

#### Connection Errors
- **"Failed to connect to wallet"** - Wallet connection failure
- **"Network connection error"** - Internet connectivity issue
- **"Server temporarily unavailable"** - Backend service down

#### Validation Errors
- **"Please enter a valid phone number"** - Phone format error
- **"Wallet address is required"** - Missing wallet address
- **"Please complete all required fields"** - Form validation

---

## System Health and Status Messages

### Health Check Responses

#### Healthy System
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

#### System Issues
```json
{
  "success": false,
  "message": "System experiencing issues",
  "data": {
    "status": "degraded",
    "issues": ["Database connection slow", "High memory usage"]
  }
}
```

### Status Messages
- **"All systems operational"** - Everything working normally
- **"Partial service degradation"** - Some features affected
- **"Maintenance mode active"** - System under maintenance
- **"Service temporarily unavailable"** - Complete outage

---

## Security and Audit Messages

### Security Events

#### Login Security
- **"New login detected from unknown device"** - Security alert
- **"Multiple failed login attempts detected"** - Brute force warning
- **"Account locked due to suspicious activity"** - Security lockout
- **"Password changed successfully"** - Security update

#### Transaction Security
- **"Large transaction detected, additional verification required"** - High-value alert
- **"Unusual transaction pattern detected"** - Fraud prevention
- **"Transaction blocked by security filters"** - Automatic protection

### Audit Trail Messages

#### User Actions
- **"User profile accessed"** - Profile view
- **"Seed phrase retrieved"** - Sensitive data access
- **"Authentication method changed"** - Security setting update
- **"Account recovery initiated"** - Recovery process start

#### System Actions
- **"Automatic backup completed"** - Data backup
- **"Security scan completed"** - System security check
- **"Database maintenance performed"** - System maintenance
- **"Log rotation completed"** - Log management

---

## Rate Limiting Messages

### Rate Limit Responses
- **"Too many signup attempts, please try again later"** - Signup rate limit
- **"Too many login attempts, please try again later"** - Login rate limit
- **"Too many verification attempts"** - OTP rate limit
- **"API rate limit exceeded"** - General API limit
- **"Please wait before making another request"** - Cooldown message

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Notification Messages

### Email Notifications
- **"Welcome to K33P Identity System"** - Welcome email
- **"Your account has been verified"** - Verification confirmation
- **"Security alert: New device login"** - Security notification
- **"Password reset requested"** - Password reset email
- **"Account recovery completed"** - Recovery confirmation

### SMS Notifications
- **"Your K33P verification code is: {code}"** - OTP message
- **"K33P Security Alert: New login detected"** - Security SMS
- **"Your K33P account has been verified"** - Verification SMS

### Push Notifications
- **"Transaction confirmed"** - Blockchain confirmation
- **"Refund processed"** - Refund notification
- **"Security update required"** - Security prompt
- **"Backup reminder"** - Data backup reminder

---

## Development and Debug Messages

### Console Logs (Development)
- **"=== SIGNUP DEBUG START ==="** - Debug session start
- **"Request body: {data}"** - Request debugging
- **"Environment variables check:"** - Configuration validation
- **"Extracted fields: {fields}"** - Data extraction debug
- **"No token received from signup response"** - Token debug

### Error Stack Traces
```
Error: Transaction verification failed
    at verifyTransaction (/src/utils/blockchain.js:45)
    at processDeposit (/src/services/deposit.js:123)
    at /src/routes/auth.js:234
```

---

## Conclusion

This documentation provides a comprehensive overview of all user-facing messages and logging patterns in the K33P Smart Contract application. These messages are designed to:

1. **Provide clear feedback** to users about the status of their operations
2. **Maintain security** by not exposing sensitive system information
3. **Enable debugging** through comprehensive logging
4. **Support audit requirements** through detailed audit trails
5. **Ensure consistency** across all application components

For developers working with the K33P system, this documentation serves as a reference for understanding the communication patterns and can be used to maintain consistency when adding new features or modifying existing functionality.