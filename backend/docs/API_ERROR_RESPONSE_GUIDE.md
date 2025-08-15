# K33P API Error and Success Response Guide

This document provides a comprehensive overview of error and success handling across all K33P API endpoints, highlighting the differences between console logging and user-facing responses.

## Response Format Standards

### Success Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "details": "Additional context (optional)"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Scenario-Based Error Handling

### Scenario-Based Examples

### User Already Signed Up and Refund Issued
```json
{
  "success": false,
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "User account already exists. Previous refund has been processed.",
    "details": "A 2 ADA refund was issued for the previous signup attempt"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### User Already Sign Up (General Case)
```json
{
  "success": false,
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "This user account already exists in our system.",
    "details": "Please use the login flow instead of signup"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Phone Number in Use
```json
{
  "success": false,
  "error": {
    "code": "PHONE_ALREADY_EXISTS",
    "message": "This phone number is already registered with another account.",
    "details": "Each phone number can only be associated with one account"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 1. User Already Signed Up and Refund Has Been Issued

**Console Response:**
```
[INFO] Existing user found - updating with new ZK commitment and processing refund
[INFO] 2 ADA refund processed successfully for existing user: tx_hash_12345
[INFO] User profile updated with new verification method
```

**User-Facing Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_12345",
    "refundTxHash": "tx_hash_12345",
    "refundAmount": "2000000",
    "status": "updated"
  },
  "message": "Account updated successfully. Your 2 ADA refund has been processed.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. User Has Signed Up and No ADA Sent Yet

**Console Response:**
```
[INFO] New user signup initiated
[INFO] ZK commitment generated successfully
[WARN] No deposit detected for user wallet: addr_12345
[INFO] User created with pending deposit status
```

**User-Facing Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_12345",
    "status": "pending_deposit",
    "depositAddress": "addr_script_12345",
    "requiredAmount": "2000000"
  },
  "message": "Account created successfully. Please send 2 ADA to complete verification.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. User Signed Up and Sent Money but Refund Failed

**Console Response:**
```
[ERROR] Refund transaction failed: Insufficient UTXOs in refund wallet
[ERROR] Refund processing error: {error details}
[INFO] User signup completed despite refund failure
[ALERT] Manual refund required for user: user_12345
```

**User-Facing Response:**
```json
{
  "success": false,
  "error": {
    "code": "REFUND_FAILED",
    "message": "Your account was created but the refund could not be processed automatically. Our team will process your refund manually within 24 hours.",
    "details": "Reference ID: ref_12345"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 4. User Using an Account for the Second Time

**Console Response:**
```
[INFO] Returning user detected: user_12345
[INFO] Generating new session token
[INFO] User authentication successful
[INFO] Previous session data retrieved
```

**User-Facing Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_12345",
    "sessionToken": "jwt_token_12345",
    "lastLogin": "2024-01-14T15:20:00.000Z",
    "accountStatus": "active"
  },
  "message": "Welcome back! You have been successfully authenticated.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 5. Wallet Address Already in Use

**Console Response:**
```
[WARN] Wallet address collision detected: addr_12345
[INFO] Existing user found with wallet: user_67890
[ERROR] Duplicate wallet address registration attempt
```

**User-Facing Response:**
```json
{
  "success": false,
  "error": {
    "code": "WALLET_ALREADY_EXISTS",
    "message": "This wallet address is already associated with another account. Please use a different wallet or contact support if this is your wallet.",
    "details": "Each wallet can only be linked to one K33P account"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 6. Phone Number Already in Use

**Console Response:**
```
[WARN] Phone number collision detected: +1234567890
[INFO] Existing user found with phone hash: hash_12345
[ERROR] Duplicate phone number registration attempt
```

**User-Facing Response:**
```json
{
  "success": false,
  "error": {
    "code": "PHONE_ALREADY_EXISTS",
    "message": "This phone number is already registered. Please use a different number or try logging in if this is your account.",
    "details": "Each phone number can only be associated with one account"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Common Error Codes and Responses

### Authentication Errors

| Error Code | HTTP Status | User Message | Console Log |
|------------|-------------|--------------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | "Invalid credentials provided" | `[ERROR] Authentication failed for user: {userId}` |
| `AUTH_TOKEN_EXPIRED` | 401 | "Your session has expired. Please log in again" | `[WARN] Expired token used: {tokenId}` |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | "You don't have permission to access this resource" | `[WARN] Unauthorized access attempt: {userId} -> {resource}` |

### Validation Errors

| Error Code | HTTP Status | User Message | Console Log |
|------------|-------------|--------------|-------------|
| `VALIDATION_ERROR` | 400 | "Please check your input and try again" | `[ERROR] Validation failed: {field} - {reason}` |
| `INVALID_PHONE_FORMAT` | 400 | "Please enter a valid phone number" | `[ERROR] Invalid phone format: {phoneNumber}` |
| `INVALID_ZK_PROOF` | 400 | "Verification failed. Please try again" | `[ERROR] ZK proof validation failed: {proofId}` |

### System Errors

| Error Code | HTTP Status | User Message | Console Log |
|------------|-------------|--------------|-------------|
| `INTERNAL_ERROR` | 500 | "Something went wrong. Please try again later" | `[ERROR] Internal server error: {errorDetails}` |
| `DATABASE_ERROR` | 500 | "Service temporarily unavailable" | `[ERROR] Database operation failed: {operation} - {error}` |
| `EXTERNAL_SERVICE_ERROR` | 502 | "External service unavailable. Please try again" | `[ERROR] External service failure: {service} - {error}` |

### Transaction Errors

| Error Code | HTTP Status | User Message | Console Log |
|------------|-------------|--------------|-------------|
| `REFUND_FAILED` | 500 | "Refund processing failed. Our team will assist you" | `[ERROR] Refund transaction failed: {txDetails}` |
| `INSUFFICIENT_FUNDS` | 400 | "Insufficient funds for this transaction" | `[WARN] Insufficient funds: {walletAddress} - {requiredAmount}` |
| `TRANSACTION_TIMEOUT` | 408 | "Transaction timed out. Please try again" | `[ERROR] Transaction timeout: {txHash}` |

## Rate Limiting Responses

**Console Response:**
```
[WARN] Rate limit exceeded for IP: 192.168.1.1
[INFO] Rate limit: 10 requests per 15 minutes
[INFO] Next allowed request: 2024-01-15T10:45:00.000Z
```

**User-Facing Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before trying again.",
    "details": "Rate limit: 10 requests per 15 minutes"
  },
  "retryAfter": 900,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Success Response Examples

### Successful OTP Send

**Console Response:**
```
[INFO] OTP sent successfully to: +1234567890
[INFO] OTP expires in: 300 seconds
[INFO] Request ID: req_12345
```

**User-Facing Response:**
```json
{
  "success": true,
  "data": {
    "requestId": "req_12345",
    "expiresIn": 300
  },
  "message": "OTP sent successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Successful Refund

**Console Response:**
```
[INFO] Refund transaction initiated: tx_12345
[INFO] Refund amount: 2000000 lovelace
[INFO] Recipient address: addr_12345
[INFO] Transaction confirmed on blockchain
```

**User-Facing Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "tx_12345",
    "amount": "2000000",
    "recipientAddress": "addr_12345"
  },
  "message": "Refund issued successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Implementation Notes

### Console Logging Guidelines
- Use appropriate log levels: `INFO`, `WARN`, `ERROR`, `DEBUG`
- Include relevant context: user IDs, transaction hashes, timestamps
- Log sensitive operations for audit trails
- Never log sensitive data like private keys or raw biometric data

### User-Facing Message Guidelines
- Keep messages clear and actionable
- Avoid technical jargon
- Provide next steps when possible
- Include support contact information for critical errors
- Use consistent error codes across all endpoints

### Security Considerations
- Never expose internal system details in user messages
- Log security events with appropriate detail levels
- Implement proper error message sanitization
- Use generic messages for authentication failures to prevent enumeration attacks

## Monitoring and Alerting

### Critical Errors Requiring Immediate Attention
- `REFUND_FAILED`: Manual intervention required
- `DATABASE_ERROR`: System health check needed
- `EXTERNAL_SERVICE_ERROR`: Service dependency issues

### Warning Conditions
- High rate of `VALIDATION_ERROR`: Possible attack or client issues
- Frequent `AUTH_INVALID_CREDENTIALS`: Potential brute force attempts
- Multiple `WALLET_ALREADY_EXISTS`: Possible duplicate account creation attempts

This guide ensures consistent error handling across the K33P platform while maintaining security and providing excellent user experience.