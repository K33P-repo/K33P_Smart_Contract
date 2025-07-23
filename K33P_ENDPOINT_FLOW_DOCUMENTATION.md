# K33P Smart Contract - Complete Endpoint Flow Documentation

## Overview

This document provides a comprehensive guide to the K33P Smart Contract authentication and refund system, detailing the complete flow from user signup to refund processing and login operations.

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [User Signup Process](#user-signup-process)
3. [Login Process](#login-process)
4. [Wallet Management](#wallet-management)
5. [Zero-Knowledge (ZK) Proof System](#zero-knowledge-zk-proof-system)
6. [Refund System](#refund-system)
7. [Session Management](#session-management)
8. [Error Handling](#error-handling)
9. [Security Features](#security-features)
10. [Environment Configuration](#environment-configuration)

---

## Authentication Flow

### Traditional Authentication Routes

#### 1. User Signup
**Endpoint:** `POST /api/signup`

**Request Body:**
```json
{
  "userAddress": "addr1...",
  "walletAddress": "addr1...",
  "phoneNumber": "+1234567890",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": "unique-user-id",
  "verificationRequired": true
}
```

**Process Flow:**
1. Validate user input (address format, phone number, email)
2. Check if user already exists
3. Generate verification code
4. Store user data in database
5. Send verification SMS/email
6. Return success response with verification requirement

#### 2. User Login
**Endpoint:** `POST /api/login`

**Request Body:**
```json
{
  "userAddress": "addr1...",
  "signature": "wallet-signature",
  "message": "login-message"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "address": "addr1...",
    "verified": true,
    "walletConnected": true
  }
}
```

#### 3. User Logout
**Endpoint:** `POST /api/logout`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### 4. Get User Information
**Endpoint:** `GET /api/user/:address`

**Response:**
```json
{
  "success": true,
  "user": {
    "address": "addr1...",
    "walletAddress": "addr1...",
    "verified": true,
    "phoneNumber": "+1234567890",
    "email": "user@example.com",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Wallet Management

#### 1. Verify Wallet
**Endpoint:** `POST /api/wallet/verify`

**Request Body:**
```json
{
  "address": "addr1...",
  "signature": "wallet-signature",
  "message": "verification-message"
}
```

#### 2. Connect Wallet
**Endpoint:** `POST /api/wallet/connect`

**Request Body:**
```json
{
  "userAddress": "addr1...",
  "walletAddress": "addr1...",
  "signature": "connection-signature"
}
```

---

## Zero-Knowledge (ZK) Proof System

### ZK Authentication Routes

#### 1. Generate ZK Commitment
**Endpoint:** `POST /api/zk/commitment`

**Request Body:**
```json
{
  "userAddress": "addr1...",
  "secret": "user-secret"
}
```

**Response:**
```json
{
  "success": true,
  "commitment": "zk-commitment-hash",
  "commitmentId": "unique-commitment-id"
}
```

#### 2. Generate ZK Proof
**Endpoint:** `POST /api/zk/proof`

**Request Body:**
```json
{
  "userAddress": "addr1...",
  "secret": "user-secret",
  "commitmentId": "unique-commitment-id",
  "challenge": "server-challenge"
}
```

**Response:**
```json
{
  "success": true,
  "proof": "zk-proof-data",
  "proofId": "unique-proof-id"
}
```

#### 3. Verify ZK Proof
**Endpoint:** `POST /api/zk/verify`

**Request Body:**
```json
{
  "proof": "zk-proof-data",
  "commitment": "zk-commitment-hash",
  "challenge": "server-challenge"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "message": "Proof verified successfully"
}
```

#### 4. ZK Login
**Endpoint:** `POST /api/zk/login`

**Request Body:**
```json
{
  "userAddress": "addr1...",
  "zkProof": "zk-proof-data",
  "commitmentId": "unique-commitment-id"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "address": "addr1...",
    "zkVerified": true
  }
}
```

---

## Refund System

### Immediate Refund

#### Endpoint: `POST /api/refund`

**Request Body:**
```json
{
  "userAddress": "addr1...",
  "walletAddress": "addr1..." // Optional - defaults to userAddress
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "transactionId": "tx-hash",
  "amount": "1000000", // in lovelace
  "refundAddress": "addr1..."
}
```

**Process Flow:**
1. Validate user address format
2. Check if user has pending deposits
3. Determine refund address (walletAddress or userAddress)
4. Process refund through K33P manager
5. Update database records
6. Return transaction details

### UTXO-Based Refund

#### Endpoint: `POST /api/utxo/refund`

**Request Body:**
```json
{
  "utxo": {
    "txHash": "transaction-hash",
    "outputIndex": 0,
    "amount": "1000000",
    "address": "addr1..."
  },
  "ownerAddress": "addr1...",
  "zkProof": "zk-proof-data"
}
```

**Response:**
```json
{
  "success": true,
  "message": "UTXO refund processed successfully",
  "transactionId": "tx-hash",
  "refundedAmount": "1000000"
}
```

**Process Flow:**
1. Validate UTXO details
2. Verify ZK proof for authorization
3. Check UTXO ownership
4. Build refund transaction
5. Submit to blockchain
6. Update UTXO status
7. Return transaction confirmation

### Automatic Refund Monitoring

The system includes automatic refund monitoring that:
- Monitors incoming transactions
- Processes automatic refunds for eligible deposits
- Maintains deposit records in the database
- Handles refund processing through the K33P manager

**Key Functions:**
- `processIncomingTransaction()`: Monitors and processes new deposits
- `processAutomaticRefund()`: Handles automatic refund logic
- Database integration for tracking deposit states

---

## Session Management

### Get Session Status
**Endpoint:** `GET /api/session`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "session": {
    "userId": "unique-user-id",
    "address": "addr1...",
    "authenticated": true,
    "expiresAt": "2024-01-01T00:00:00Z"
  }
}
```

### Refresh Session
**Endpoint:** `POST /api/session/refresh`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "token": "new-jwt-token",
  "expiresAt": "2024-01-01T00:00:00Z"
}
```

---

## Error Handling

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| AUTH_001 | Invalid credentials | 401 |
| AUTH_002 | Token expired | 401 |
| AUTH_003 | Insufficient permissions | 403 |
| USER_001 | User not found | 404 |
| USER_002 | User already exists | 409 |
| USER_003 | Invalid user data | 400 |
| WALLET_001 | Invalid wallet address | 400 |
| WALLET_002 | Wallet verification failed | 401 |
| WALLET_003 | Wallet not connected | 400 |
| ZK_001 | Invalid ZK proof | 400 |
| ZK_002 | ZK proof verification failed | 401 |
| ZK_003 | Commitment not found | 404 |
| REFUND_001 | Insufficient balance | 400 |
| REFUND_002 | Invalid refund request | 400 |
| REFUND_003 | Refund processing failed | 500 |
| UTXO_001 | UTXO not found | 404 |
| UTXO_002 | Invalid UTXO data | 400 |
| UTXO_003 | UTXO already spent | 409 |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details"
  }
}
```

---

## Security Features

### Authentication Security
- JWT token-based authentication
- Wallet signature verification
- Session timeout management
- Rate limiting on authentication endpoints

### ZK Proof Security
- Zero-knowledge proof generation and verification
- Commitment-based authentication
- Challenge-response mechanisms
- Proof replay protection

### Transaction Security
- Multi-signature wallet support
- Transaction validation
- UTXO verification
- Blockchain confirmation requirements

### Data Protection
- Encrypted sensitive data storage
- Secure communication (HTTPS)
- Input validation and sanitization
- SQL injection prevention

---

## Environment Configuration

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/k33p_db
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRATION=24h

# Blockchain Configuration
BACKEND_PRIVATE_KEY=your-backend-private-key
NETWORK=testnet # or mainnet
BLOCKFROST_API_KEY=your-blockfrost-api-key

# External Services
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Application Settings
PORT=3001
NODE_ENV=development # or production
CORS_ORIGIN=http://localhost:3000

# ZK Proof Configuration
ZK_CIRCUIT_PATH=./circuits/auth.wasm
ZK_PROVING_KEY=./keys/proving_key.zkey
ZK_VERIFICATION_KEY=./keys/verification_key.json
```

### Development vs Production

**Development:**
- Detailed error messages
- Debug logging enabled
- CORS enabled for localhost
- Mock ZK proofs for testing

**Production:**
- Minimal error exposure
- Error logging only
- Restricted CORS origins
- Full ZK proof verification
- Rate limiting enabled
- SSL/TLS required

---

## API Testing Examples

### Complete User Flow Example

```javascript
// 1. User Signup
const signupResponse = await fetch('/api/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userAddress: 'addr1...',
    walletAddress: 'addr1...',
    phoneNumber: '+1234567890',
    email: 'user@example.com'
  })
});

// 2. User Login
const loginResponse = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userAddress: 'addr1...',
    signature: 'wallet-signature',
    message: 'login-message'
  })
});

const { token } = await loginResponse.json();

// 3. Process Refund
const refundResponse = await fetch('/api/refund', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    userAddress: 'addr1...',
    walletAddress: 'addr1...'
  })
});

// 4. Logout
const logoutResponse = await fetch('/api/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### ZK Proof Flow Example

```javascript
// 1. Generate Commitment
const commitmentResponse = await fetch('/api/zk/commitment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userAddress: 'addr1...',
    secret: 'user-secret'
  })
});

const { commitmentId } = await commitmentResponse.json();

// 2. Generate Proof
const proofResponse = await fetch('/api/zk/proof', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userAddress: 'addr1...',
    secret: 'user-secret',
    commitmentId: commitmentId,
    challenge: 'server-challenge'
  })
});

const { proof } = await proofResponse.json();

// 3. ZK Login
const zkLoginResponse = await fetch('/api/zk/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userAddress: 'addr1...',
    zkProof: proof,
    commitmentId: commitmentId
  })
});
```

---

## Conclusion

This documentation provides a comprehensive overview of the K33P Smart Contract authentication and refund system. The system supports both traditional wallet-based authentication and advanced zero-knowledge proof authentication, with robust refund mechanisms for both immediate and UTXO-based transactions.

For additional support or questions, please refer to the individual documentation files:
- `AUTHENTICATION_ROUTES_DOCUMENTATION.md`
- `API_DOCUMENTATION.md`
- `API_ROUTES_DOCUMENTATION.md`
- `AUTOMATIC_REFUND_IMPLEMENTATION.md`