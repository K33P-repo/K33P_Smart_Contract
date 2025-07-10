# PostgreSQL Database Setup for K33P Smart Contract

This guide will help you set up PostgreSQL database for the K33P Smart Contract project, replacing the existing JSON file storage system.

## 🚀 Quick Setup

Run the automated setup script:

```bash
node setup-database.js
```

This script will:
- Check prerequisites (PostgreSQL, Node.js)
- Install required dependencies
- Create `.env` file with database configuration
- Initialize database schema
- Optionally migrate existing JSON data

## 📋 Prerequisites

### 1. PostgreSQL Installation

**Windows:**
```bash
# Download and install from official website
# https://www.postgresql.org/download/windows/
```

**macOS:**
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database and user
CREATE DATABASE k33p_db;
CREATE USER k33p_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE k33p_db TO k33p_user;
\q
```

## ⚙️ Manual Setup

If you prefer manual setup:

### 1. Install Dependencies

```bash
npm install pg @types/pg
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure database settings:

```bash
cp .env.example .env
```

Update the following variables in `.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=k33p_db
DB_USER=k33p_user
DB_PASSWORD=your_password
```

### 3. Initialize Database Schema

```bash
npm run db:init
```

### 4. Migrate Existing Data (Optional)

If you have existing `user-deposits.json` or `mock-db.json` files:

```bash
npm run db:migrate
```

## 🗄️ Database Schema

The database includes the following tables:

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) UNIQUE NOT NULL,
    wallet_address VARCHAR(200) NOT NULL,
    phone_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Deposits Table
```sql
CREATE TABLE user_deposits (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(200) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    phone_hash VARCHAR(64) NOT NULL,
    zk_proof TEXT NOT NULL,
    amount BIGINT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    tx_hash VARCHAR(64),
    sender_wallet_address VARCHAR(200),
    verification_attempts INTEGER DEFAULT 0,
    pin_hash VARCHAR(64),
    biometric_hash VARCHAR(64),
    biometric_type VARCHAR(20),
    verification_method VARCHAR(20) DEFAULT 'phone',
    signup_completed BOOLEAN DEFAULT FALSE,
    refunded BOOLEAN DEFAULT FALSE,
    refund_tx_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(64) UNIQUE NOT NULL,
    from_address VARCHAR(200) NOT NULL,
    to_address VARCHAR(200) NOT NULL,
    amount BIGINT NOT NULL,
    confirmations INTEGER DEFAULT 0,
    block_time TIMESTAMP,
    transaction_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ZK Proofs Table
```sql
CREATE TABLE zk_proofs (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(200) NOT NULL,
    proof_data TEXT NOT NULL,
    verification_key TEXT,
    public_inputs TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Auth Data Table
```sql
CREATE TABLE auth_data (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(200) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    encrypted_data TEXT NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### System Logs Table
```sql
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Available Commands

### Database Management

```bash
# Initialize database schema
npm run db:init

# Migrate data from JSON files
npm run db:migrate

# Reset database (WARNING: deletes all data)
npm run db:reset
```

### Application Commands

```bash
# Start the application
npm start

# Start in development mode
npm run dev

# Run tests
npm test
```

## 🔄 Migration from JSON Files

The migration process will:

1. **Backup existing JSON files** to `backups/` directory
2. **Read data** from `user-deposits.json` and `mock-db.json`
3. **Transform and insert** data into PostgreSQL tables
4. **Validate** the migration by comparing record counts
5. **Create summary report** of migrated data

### Migration Report Example

```
📊 Migration Summary:
✅ Users migrated: 15
✅ Deposits migrated: 12
✅ Transactions migrated: 8
✅ ZK Proofs migrated: 12

📁 Backup files created:
• backups/user-deposits-backup-2024-01-15.json
• backups/mock-db-backup-2024-01-15.json
```

## 🔍 Database Service API

The new database service provides the following methods:

### User Operations
```typescript
// Create user
await dbService.createUser({
  userId: 'user123',
  walletAddress: 'addr1...',
  phoneHash: 'hash...'
});

// Get user
const user = await dbService.getUserById('user123');

// Update user
await dbService.updateUser('user123', { phoneHash: 'newHash...' });
```

### Deposit Operations
```typescript
// Create deposit
await dbService.createDeposit({
  userAddress: 'addr1...',
  userId: 'user123',
  phoneHash: 'hash...',
  zkProof: 'proof...',
  amount: 2000000n
});

// Get deposit
const deposit = await dbService.getDepositByUserAddress('addr1...');

// Mark as verified
await dbService.markDepositAsVerified('addr1...', 'txhash...');
```

### Transaction Operations
```typescript
// Create transaction
await dbService.createTransaction({
  txHash: 'hash...',
  fromAddress: 'addr1...',
  toAddress: 'addr2...',
  amount: 2000000n,
  transactionType: 'deposit',
  status: 'confirmed'
});
```

## 🛠️ Troubleshooting

### Common Issues

**1. Connection refused**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check if PostgreSQL is listening on port 5432: `netstat -an | grep 5432`

**2. Authentication failed**
```
Error: password authentication failed for user "k33p_user"
```
- Verify credentials in `.env` file
- Reset user password in PostgreSQL

**3. Database does not exist**
```
Error: database "k33p_db" does not exist
```
- Create the database: `createdb k33p_db`
- Or run: `psql -U postgres -c "CREATE DATABASE k33p_db;"`

**4. Permission denied**
```
Error: permission denied for table users
```
- Grant permissions: `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO k33p_user;`

### Database Connection Test

```bash
# Test connection using psql
psql -h localhost -p 5432 -U k33p_user -d k33p_db

# Test connection using Node.js
node -e "require('./src/database/config.js').testConnection().then(console.log)"
```

### Reset Everything

If you need to start fresh:

```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS k33p_db;"
psql -U postgres -c "CREATE DATABASE k33p_db;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE k33p_db TO k33p_user;"

# Reinitialize schema
npm run db:init
```

## 📈 Performance Considerations

### Indexes

The schema includes optimized indexes for:
- User lookups by `user_id` and `wallet_address`
- Deposit lookups by `user_address` and verification status
- Transaction lookups by `tx_hash` and addresses
- Time-based queries on `created_at` fields

### Connection Pooling

The database service uses connection pooling with:
- Maximum 20 connections
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Query Optimization

- Use prepared statements for repeated queries
- Batch operations when possible
- Implement pagination for large result sets

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit `.env` file to version control
2. **Database User**: Use dedicated database user with minimal privileges
3. **Connection Security**: Use SSL in production environments
4. **Data Encryption**: Sensitive data is hashed before storage
5. **Input Validation**: All inputs are validated and sanitized

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg Library](https://node-postgres.com/)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl-best-practices.html)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your PostgreSQL installation and configuration
3. Ensure all environment variables are correctly set
4. Check application logs for detailed error messages

For additional help, please refer to the project documentation or create an issue in the repository.