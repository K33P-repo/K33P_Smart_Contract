# Storage Integration Documentation

## Overview

The K33P Identity System now features a comprehensive storage abstraction layer that provides unified access to both Iagon storage endpoints and PostgreSQL database with intelligent fallback mechanisms.

## Architecture

### Storage Abstraction Service

The `StorageAbstractionService` class provides:

- **Unified API**: Single interface for all storage operations
- **Intelligent Fallback**: Automatic failover between Iagon and PostgreSQL
- **Health Monitoring**: Real-time monitoring of storage service availability
- **Retry Logic**: Configurable retry mechanisms for failed operations
- **Caching**: Built-in caching for improved performance
- **Error Handling**: Comprehensive error handling and logging

### Storage Backends

#### Primary: Iagon Storage
- **Advantages**: Decentralized, secure, blockchain-integrated
- **Use Cases**: User profiles, encrypted data, permanent storage
- **Format**: JSON documents stored as files
- **Indexing**: Key-based access (requires userId for efficient lookup)

#### Fallback: PostgreSQL Database
- **Advantages**: Fast queries, complex relationships, ACID compliance
- **Use Cases**: Complex queries, reporting, temporary data
- **Format**: Relational tables with proper indexing
- **Indexing**: Full SQL query capabilities

## Configuration

### Environment Variables

```bash
# Storage Abstraction Configuration
PRIMARY_STORAGE=iagon                    # Primary storage backend (iagon|postgresql)
ENABLE_STORAGE_FALLBACK=true             # Enable automatic fallback
SYNC_BETWEEN_STORAGES=false              # Sync data between storages
STORAGE_HEALTH_CHECK_INTERVAL=60000      # Health check interval (ms)
STORAGE_RETRY_ATTEMPTS=3                 # Number of retry attempts
STORAGE_RETRY_DELAY=1000                 # Delay between retries (ms)
```

### Storage Selection Logic

1. **Primary Storage Available**: Use configured primary storage
2. **Primary Storage Unavailable**: 
   - If fallback enabled: Use available fallback storage
   - If fallback disabled: Attempt primary (will likely fail)
3. **Both Storages Unavailable**: Return error with detailed information

## API Methods

### User Management

#### `storeUser(userData)`
Stores a new user record.

```javascript
const result = await storageService.storeUser({
  userId: 'user123',
  walletAddress: 'addr_test1...',
  phoneHash: 'hashed_phone',
  zkCommitment: 'commitment_data'
});

if (result.success) {
  console.log('User stored:', result.data.id);
  console.log('Storage used:', result.storageUsed);
}
```

#### `findUser(query)`
Finds a user by various criteria.

```javascript
// Find by userId (efficient for both storages)
const result = await storageService.findUser({ userId: 'user123' });

// Find by wallet address (requires PostgreSQL fallback for Iagon)
const result = await storageService.findUser({ walletAddress: 'addr_test1...' });

// Find by phone hash
const result = await storageService.findUser({ phoneHash: 'hashed_phone' });
```

#### `updateUser(userId, updateData)`
Updates user information.

```javascript
const result = await storageService.updateUser('user123', {
  walletAddress: 'new_addr_test1...',
  verified: true
});
```

### Deposit Management

#### `storeUserDeposit(depositData)`
Stores deposit information.

```javascript
const result = await storageService.storeUserDeposit({
  userId: 'user123',
  userAddress: 'addr_test1...',
  amount: 2000000,
  txHash: 'transaction_hash'
});
```

#### `findUserDeposits(query)`
Finds deposits by various criteria.

```javascript
const result = await storageService.findUserDeposits({ userId: 'user123' });
```

## Health Monitoring

### Health Status

The service continuously monitors storage health:

```javascript
const health = storageService.getHealthStatus();
console.log('Iagon available:', health.iagon.available);
console.log('PostgreSQL available:', health.postgresql.available);
console.log('Response times:', {
  iagon: health.iagon.responseTime,
  postgresql: health.postgresql.responseTime
});
```

### Health Check Operations

- **Iagon**: Attempts to store a test document
- **PostgreSQL**: Executes a simple SELECT query
- **Frequency**: Configurable (default: 60 seconds)
- **Logging**: Detailed health status logging

## Error Handling

### Response Format

All operations return a standardized response:

```javascript
{
  success: boolean,
  data?: any,
  error?: string,
  storageUsed: 'iagon' | 'postgresql' | 'both',
  syncStatus?: 'synced' | 'pending' | 'failed'
}
```

### Error Scenarios

1. **Primary Storage Failure**: Automatic fallback (if enabled)
2. **Both Storages Failure**: Detailed error response
3. **Partial Failure**: Retry logic with exponential backoff
4. **Network Issues**: Timeout handling and retry

## Integration with Auth Routes

### Updated Routes

All authentication routes now use the storage abstraction:

- `POST /api/auth/signup` - User creation with storage abstraction
- `POST /api/auth/login` - User lookup with fallback
- `GET /api/auth/me` - User profile retrieval
- `POST /api/auth/verify-wallet` - Wallet verification and updates
- `GET /api/auth/wallet-connect` - Wallet address retrieval
- `POST /api/auth/verify-deposit` - Deposit verification and user updates
- `POST /api/auth/verify` - Token verification with user lookup

### Response Enhancements

API responses now include storage information:

```javascript
{
  "success": true,
  "data": { ... },
  "storageUsed": "iagon",
  "message": "Operation completed successfully"
}
```

## Performance Considerations

### Iagon Storage

- **Strengths**: Decentralized, secure, permanent
- **Limitations**: Key-based access only, slower for complex queries
- **Best For**: User profiles, encrypted data, audit trails

### PostgreSQL Storage

- **Strengths**: Fast queries, complex relationships, full-text search
- **Limitations**: Centralized, requires maintenance
- **Best For**: Analytics, reporting, complex queries

### Optimization Strategies

1. **Query Routing**: Route complex queries to PostgreSQL
2. **Caching**: Cache frequently accessed data
3. **Batch Operations**: Group multiple operations when possible
4. **Health-Based Routing**: Route to healthiest storage backend

## Deployment Considerations

### Development Environment

```bash
# Use Iagon as primary with PostgreSQL fallback
PRIMARY_STORAGE=iagon
ENABLE_STORAGE_FALLBACK=true

# Enable Iagon storage
IAGON_API_URL=https://gw.iagon.com/api/v2
IAGON_PERSONAL_ACCESS_TOKEN=your_token_here
```

### Production Environment

```bash
# Use Iagon as primary with PostgreSQL fallback
PRIMARY_STORAGE=iagon
ENABLE_STORAGE_FALLBACK=true
SYNC_BETWEEN_STORAGES=true

# Optimized health checking
STORAGE_HEALTH_CHECK_INTERVAL=30000
STORAGE_RETRY_ATTEMPTS=5
```

### High Availability Setup

```bash
# Use PostgreSQL as primary for high availability
PRIMARY_STORAGE=postgresql
ENABLE_STORAGE_FALLBACK=true
SYNC_BETWEEN_STORAGES=true
```

## Monitoring and Logging

### Log Levels

- **INFO**: Storage operations, health status changes
- **WARN**: Fallback activations, retry attempts
- **ERROR**: Storage failures, data inconsistencies
- **DEBUG**: Detailed operation traces

### Metrics to Monitor

1. **Storage Health**: Availability percentages
2. **Response Times**: Average response times per storage
3. **Fallback Rate**: Frequency of fallback usage
4. **Error Rate**: Storage operation failure rates
5. **Data Consistency**: Sync status between storages

## Security Considerations

### Data Encryption

- **Iagon**: Built-in encryption for stored data
- **PostgreSQL**: Application-level encryption for sensitive fields
- **Transit**: HTTPS/TLS for all communications

### Access Control

- **Iagon**: Personal Access Token authentication
- **PostgreSQL**: Database user credentials
- **Application**: JWT-based user authentication

### Data Privacy

- **Phone Numbers**: Always stored as hashes
- **Biometric Data**: Encrypted before storage
- **Wallet Addresses**: Public information, stored in plain text
- **ZK Commitments**: Cryptographic commitments, safe to store

## Troubleshooting

### Common Issues

1. **Iagon Connection Failures**
   - Check `IAGON_PERSONAL_ACCESS_TOKEN`
   - Verify network connectivity
   - Check Iagon service status

2. **PostgreSQL Connection Failures**
   - Verify database credentials
   - Check network connectivity
   - Ensure database is running

3. **Fallback Not Working**
   - Check `ENABLE_STORAGE_FALLBACK=true`
   - Verify fallback storage health
   - Review error logs

### Debug Commands

```javascript
// Check storage health
const health = storageService.getHealthStatus();
console.log(JSON.stringify(health, null, 2));

// Test storage operations
const testResult = await storageService.storeUser({
  userId: 'test_user',
  phoneHash: 'test_hash'
});
console.log('Test result:', testResult);
```

## Future Enhancements

### Planned Features

1. **Data Synchronization**: Automatic sync between storages
2. **Conflict Resolution**: Handle data conflicts between storages
3. **Performance Analytics**: Detailed performance metrics
4. **Storage Migration**: Tools for migrating between storage backends
5. **Backup and Recovery**: Automated backup strategies

### Scalability Improvements

1. **Connection Pooling**: Optimize database connections
2. **Caching Layer**: Redis integration for improved performance
3. **Load Balancing**: Distribute load across multiple storage instances
4. **Sharding**: Partition data across multiple storage backends

## Conclusion

The storage abstraction layer provides a robust, flexible foundation for the K33P Identity System. It ensures high availability through intelligent fallback mechanisms while maintaining the benefits of decentralized storage through Iagon integration.

The system is designed to be:
- **Resilient**: Automatic failover and retry mechanisms
- **Performant**: Optimized routing and caching
- **Secure**: Encryption and access control
- **Scalable**: Configurable for different deployment scenarios
- **Maintainable**: Comprehensive logging and monitoring