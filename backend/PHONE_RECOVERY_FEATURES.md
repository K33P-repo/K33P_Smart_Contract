# Phone Number Change and Account Recovery Features

## Overview

The K33P backend now includes comprehensive phone number management and account recovery capabilities. These features provide users with secure methods to update their phone numbers and recover their accounts using multiple verification strategies.

## Features

### 1. Phone Number Change

Allows authenticated users to securely change their phone numbers with multiple verification methods.

**Supported Verification Methods:**
- SMS verification to current phone
- Email verification
- Blockchain transaction verification

### 2. Account Recovery

Provides multiple recovery strategies for users who have lost access to their accounts.

**Supported Recovery Methods:**
- **Backup Phrase Recovery**: 12-word backup phrase verification
- **Emergency Contact Recovery**: Verification through pre-registered emergency contact
- **Blockchain Proof Recovery**: Transaction verification from registered wallet
- **Multi-Factor Recovery**: Combination of multiple verification methods for enhanced security

## API Endpoints

### Phone Number Change Endpoints

#### 1. Initiate Phone Number Change
```
POST /api/phone/change/initiate
```

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "currentPhoneNumber": "+1234567890",
  "newPhoneNumber": "+1987654321",
  "verificationMethod": "sms" // "sms", "email", or "onchain"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone change request initiated",
  "data": {
    "requestId": "uuid-string",
    "verificationMethod": "sms",
    "expiresAt": "2024-01-01T12:00:00Z"
  }
}
```

#### 2. Verify Phone Number Change
```
POST /api/phone/change/verify
```

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "requestId": "uuid-string",
  "verificationCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number changed successfully",
  "data": {
    "newPhoneHash": "hashed-phone-number",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### 3. Get Phone Change Status
```
GET /api/phone/change/status/:requestId
```

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "requestId": "uuid-string",
    "status": "pending", // "pending", "verified", "completed", "failed", "expired"
    "verificationMethod": "sms",
    "attemptsRemaining": 2,
    "expiresAt": "2024-01-01T12:00:00Z"
  }
}
```

### Account Recovery Endpoints

#### 1. Initiate Account Recovery
```
POST /api/recovery/initiate
```

**Request Body:**
```json
{
  "identifier": "+1234567890", // Phone number or email
  "recoveryMethod": "backup_phrase", // "backup_phrase", "emergency_contact", "onchain_proof", "multi_factor"
  "newPhoneNumber": "+1987654321"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recovery process initiated",
  "data": {
    "recoveryId": "uuid-string",
    "recoveryMethod": "backup_phrase",
    "expiresAt": "2024-01-01T12:00:00Z"
  }
}
```

#### 2. Verify Backup Phrase
```
POST /api/recovery/verify-backup-phrase
```

**Request Body:**
```json
{
  "recoveryId": "uuid-string",
  "backupPhrase": "word1 word2 word3 ... word12"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Backup phrase verified successfully",
  "data": {
    "recoveryId": "uuid-string",
    "newPhoneHash": "hashed-phone-number",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### 3. Verify Emergency Contact
```
POST /api/recovery/verify-emergency-contact
```

**Request Body:**
```json
{
  "recoveryId": "uuid-string",
  "emergencyToken": "uuid-token-from-email"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Emergency contact verified successfully",
  "data": {
    "recoveryId": "uuid-string",
    "newPhoneHash": "hashed-phone-number",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### 4. Verify Blockchain Proof
```
POST /api/recovery/verify-onchain
```

**Request Body:**
```json
{
  "recoveryId": "uuid-string",
  "walletAddress": "addr1...",
  "txHash": "transaction-hash-64-chars"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Blockchain verification successful",
  "data": {
    "recoveryId": "uuid-string",
    "newPhoneHash": "hashed-phone-number",
    "txHash": "transaction-hash",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### 5. Get Recovery Status
```
GET /api/recovery/status/:recoveryId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recoveryId": "uuid-string",
    "status": "pending", // "pending", "verified", "completed", "failed", "expired"
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

## Database Schema

The following tables have been added to support these features:

### Emergency Contacts Table
```sql
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(128),
    token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Backup Phrases Table
```sql
CREATE TABLE backup_phrases (
    id UUID PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    phrase_hash VARCHAR(128) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE
);
```

### Phone Change Requests Table
```sql
CREATE TABLE phone_change_requests (
    id UUID PRIMARY KEY,
    request_id VARCHAR(128) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    current_phone_hash VARCHAR(128) NOT NULL,
    new_phone_hash VARCHAR(128) NOT NULL,
    verification_method VARCHAR(20),
    verification_code VARCHAR(10),
    verification_data JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);
```

### Recovery Requests Table
```sql
CREATE TABLE recovery_requests (
    id UUID PRIMARY KEY,
    recovery_id VARCHAR(128) UNIQUE NOT NULL,
    user_id VARCHAR(50),
    identifier_hash VARCHAR(128) NOT NULL,
    new_phone_hash VARCHAR(128) NOT NULL,
    recovery_method VARCHAR(20),
    verification_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);
```

### Account Activity Table
```sql
CREATE TABLE account_activity (
    id UUID PRIMARY KEY,
    user_id VARCHAR(50),
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    success BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Security Features

### Rate Limiting
- Phone change requests: 3 attempts per 15 minutes
- Recovery requests: 5 attempts per 30 minutes
- Backup phrase verification: 3 attempts per 15 minutes

### Encryption and Hashing
- Phone numbers are hashed using SHA-256 with salt
- Backup phrases are hashed using SHA-256 with unique salt per user
- All sensitive data is encrypted at rest

### Expiration
- Phone change requests expire after 30 minutes
- Recovery requests expire after 30 minutes
- Emergency tokens expire after 30 minutes

### Audit Logging
- All activities are logged in the `account_activity` table
- Failed attempts are tracked and rate-limited
- Successful recoveries are logged with timestamps

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "details": ["Additional error details"]
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid input parameters
- `RATE_LIMITED`: Too many attempts
- `EXPIRED`: Request or token expired
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `SERVER_ERROR`: Internal server error

## Environment Variables

Required environment variables for these features:

```env
# Phone number hashing
PHONE_SALT=your-phone-salt-here

# Email configuration for emergency contacts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@k33p.io

# Frontend URL for recovery links
FRONTEND_URL=https://your-frontend-domain.com

# Recovery deposit address (for blockchain verification)
RECOVERY_DEPOSIT_ADDRESS=addr1...
```

## Usage Examples

### Phone Number Change Flow
1. User initiates phone change with current and new phone numbers
2. System sends verification code via chosen method (SMS/email/blockchain)
3. User provides verification code
4. System updates user's phone number hash

### Account Recovery Flow
1. User provides identifier (phone/email) and new phone number
2. User selects recovery method
3. System initiates appropriate verification process
4. User completes verification step(s)
5. System updates user's phone number and completes recovery

### Multi-Factor Recovery Flow
1. User initiates multi-factor recovery
2. System requires backup phrase verification first
3. After backup phrase success, system requires emergency contact verification
4. Both verifications must succeed to complete recovery

## Integration Notes

- All endpoints follow RESTful conventions
- Authentication is required for phone change endpoints
- Recovery endpoints are public but rate-limited
- All responses include proper HTTP status codes
- CORS is enabled for frontend integration
- All sensitive operations are logged for security auditing