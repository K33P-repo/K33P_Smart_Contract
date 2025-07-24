# K33P User Management API Documentation

This document describes the comprehensive user management system built on top of Iagon's file storage services, providing secure storage and retrieval of user data and seed phrases in JSON format.

## Overview

The K33P User Management API provides:
- **User Profile Management**: Create, read, update, and delete user profiles
- **Seed Phrase Storage**: Secure storage of encrypted seed phrases on Iagon
- **JSON Format Storage**: All data stored in structured JSON format for easy retrieval
- **Custom User Layer**: Built on top of Iagon's storage API for enhanced functionality
- **Full Content Retrieval**: Complete access to stored data and metadata

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## User Profile Management

### Create User Profile
**POST** `/users`

Create a new user profile with comprehensive data storage on Iagon.

**Request Body:**
```json
{
  "userId": "user123",
  "email": "user@example.com",
  "username": "johndoe",
  "phoneNumber": "+1234567890",
  "userAddress": "addr1...",
  "biometricType": "fingerprint",
  "verificationMethod": "biometric",
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User profile created successfully",
  "user": {
    "id": "uuid-here",
    "userId": "user123",
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "iagonStorageId": "iagon-storage-id"
  }
}
```

### Get User Profile
**GET** `/users/{userId}`

Retrieve complete user profile with optional sensitive data.

**Query Parameters:**
- `includeSecrets` (boolean): Include sensitive data like PIN and storage IDs

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "userId": "user123",
    "email": "user@example.com",
    "username": "johndoe",
    "phoneNumber": "+1234567890",
    "userAddress": "addr1...",
    "biometricType": "fingerprint",
    "verificationMethod": "biometric",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastUpdated": "2024-01-01T00:00:00.000Z",
    "seedPhrases": [
      {
        "id": "seed-phrase-id",
        "walletName": "Main Wallet",
        "walletType": "HD",
        "walletAddress": "addr1...",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "lastAccessed": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### Update User Profile
**PUT** `/users/{userId}`

Update user profile information.

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "username": "newusername",
  "phoneNumber": "+0987654321"
}
```

### Delete User Profile
**DELETE** `/users/{userId}`

Delete user profile and optionally all associated data.

**Query Parameters:**
- `deleteAllData` (boolean): Delete all user data including seed phrases from Iagon

### Search Users
**GET** `/users/search`

Search for users by various criteria.

**Query Parameters:**
- `email` (string): Search by email
- `username` (string): Search by username
- `phoneNumber` (string): Search by phone number
- `userAddress` (string): Search by wallet address
- `limit` (number): Maximum results (default: 10)

## Seed Phrase Management

### Add Seed Phrase
**POST** `/users/{userId}/seed-phrases`

Store a new encrypted seed phrase on Iagon in JSON format.

**Request Body:**
```json
{
  "seedPhrase": "word1 word2 word3 ... word24",
  "encryptionPassword": "strong-password",
  "walletName": "Main Wallet",
  "walletType": "HD",
  "walletAddress": "addr1..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Seed phrase added successfully",
  "seedPhrase": {
    "id": "seed-phrase-id",
    "walletName": "Main Wallet",
    "walletType": "HD",
    "walletAddress": "addr1...",
    "iagonStorageId": "iagon-storage-id",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get User's Seed Phrases
**GET** `/users/{userId}/seed-phrases`

Retrieve list of user's seed phrases (metadata only, not the actual phrases).

**Response:**
```json
{
  "success": true,
  "seedPhrases": [
    {
      "id": "seed-phrase-id",
      "walletName": "Main Wallet",
      "walletType": "HD",
      "walletAddress": "addr1...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastAccessed": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Retrieve Specific Seed Phrase
**GET** `/users/{userId}/seed-phrases/{seedPhraseId}`

Retrieve and decrypt a specific seed phrase with full details.

**Query Parameters:**
- `encryptionPassword` (required): Password to decrypt the seed phrase
- `includeFullDocument` (boolean): Include complete JSON document from Iagon

**Response:**
```json
{
  "success": true,
  "seedPhrase": "word1 word2 word3 ... word24",
  "metadata": {
    "id": "seed-phrase-id",
    "userId": "user123",
    "walletName": "Main Wallet",
    "walletType": "HD",
    "mnemonicType": "BIP39",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastAccessed": "2024-01-01T00:00:00.000Z",
    "accessCount": 5
  },
  "walletInfo": {
    "walletName": "Main Wallet",
    "walletType": "HD",
    "walletAddress": "addr1..."
  },
  "fullDocument": {
    "id": "seed-phrase-id",
    "walletAddress": "addr1...",
    "accessLog": {
      "lastAccessed": "2024-01-01T00:00:00.000Z",
      "accessCount": 5
    },
    "storageFormat": "encrypted-json",
    "version": "2.0"
  }
}
```

### Remove Seed Phrase
**DELETE** `/users/{userId}/seed-phrases/{seedPhraseId}`

Remove seed phrase from user profile and optionally from Iagon storage.

**Query Parameters:**
- `deleteFromIagon` (boolean): Also delete from Iagon storage

## Storage Management

### Get Storage Statistics
**GET** `/users/{userId}/storage/stats`

Retrieve user's storage statistics and usage information.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalSeedPhrases": 3,
    "totalStorageUsed": "2.5 KB",
    "lastBackup": "2024-01-01T00:00:00.000Z",
    "storageHealth": "good",
    "iagonStorageIds": [
      "storage-id-1",
      "storage-id-2",
      "storage-id-3"
    ]
  }
}
```

### Create Backup
**POST** `/users/{userId}/backup`

Create a backup of user data on Iagon.

**Request Body:**
```json
{
  "includeMetadata": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Backup created successfully",
  "backup": {
    "backupId": "backup-id",
    "iagonStorageId": "backup-storage-id",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "size": "5.2 KB",
    "includedItems": {
      "userProfile": true,
      "seedPhrases": 3,
      "metadata": true
    }
  }
}
```

## JSON Storage Format

All data is stored on Iagon in structured JSON format for easy retrieval and management.

### User Profile JSON Structure
```json
{
  "version": "1.0",
  "id": "user-profile-id",
  "userId": "user123",
  "profile": {
    "email": "user@example.com",
    "username": "johndoe",
    "phoneNumber": "+1234567890",
    "userAddress": "addr1...",
    "biometricType": "fingerprint",
    "verificationMethod": "biometric",
    "pin": "encrypted-pin"
  },
  "seedPhrases": [
    {
      "id": "seed-phrase-id",
      "walletName": "Main Wallet",
      "walletType": "HD",
      "walletAddress": "addr1...",
      "iagonStorageId": "seed-storage-id",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastAccessed": "2024-01-01T00:00:00.000Z"
    }
  ],
  "metadata": {
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastUpdated": "2024-01-01T00:00:00.000Z",
    "storageVersion": "1.0"
  }
}
```

### Seed Phrase JSON Structure
```json
{
  "version": "2.0",
  "id": "seed-phrase-id",
  "walletAddress": "addr1...",
  "encryptedData": {
    "encryptedSeedPhrase": "encrypted-content",
    "salt": "random-salt",
    "iv": "initialization-vector",
    "metadata": {
      "userId": "user123",
      "walletName": "Main Wallet",
      "walletType": "HD",
      "mnemonicType": "BIP39",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "storageFormat": "encrypted-json"
    }
  },
  "accessLog": {
    "lastAccessed": "2024-01-01T00:00:00.000Z",
    "accessCount": 5
  },
  "metadata": {
    "storageFormat": "encrypted-json",
    "encryptionAlgorithm": "AES-256-GCM"
  }
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `404`: Not Found
- `409`: Conflict (user already exists)
- `500`: Internal Server Error

## Usage Examples

### Complete User Workflow

1. **Create User:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice123",
    "email": "alice@example.com",
    "username": "alice",
    "phoneNumber": "+1234567890",
    "userAddress": "addr1qx...",
    "verificationMethod": "pin",
    "pin": "1234"
  }'
```

2. **Add Seed Phrase:**
```bash
curl -X POST http://localhost:3000/api/users/alice123/seed-phrases \
  -H "Content-Type: application/json" \
  -d '{
    "seedPhrase": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    "encryptionPassword": "my-strong-password",
    "walletName": "Main Wallet",
    "walletType": "HD",
    "walletAddress": "addr1qx..."
  }'
```

3. **Retrieve Seed Phrase:**
```bash
curl "http://localhost:3000/api/users/alice123/seed-phrases/seed-phrase-id?encryptionPassword=my-strong-password&includeFullDocument=true"
```

4. **Get User Profile:**
```bash
curl "http://localhost:3000/api/users/alice123?includeSecrets=true"
```

## Security Considerations

- All seed phrases are encrypted before storage on Iagon
- Encryption passwords are never stored, only used for encryption/decryption
- User PINs are hashed before storage
- Access logs track seed phrase retrieval for security auditing
- Sensitive data is only returned when explicitly requested
- All API calls should use HTTPS in production

## Integration with Existing K33P System

This user management system integrates seamlessly with the existing K33P authentication system:

- Use `/api/auth/signup` for initial user registration
- Use `/api/users` endpoints for comprehensive user management
- Seed phrases stored via this system are accessible through both APIs
- All data is stored on Iagon for decentralized, secure storage

The system provides a complete user management layer on top of Iagon's storage services, enabling full control over user data and seed phrase management with comprehensive JSON-based storage and retrieval capabilities.