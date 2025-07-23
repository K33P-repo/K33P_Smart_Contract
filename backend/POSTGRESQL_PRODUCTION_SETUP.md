# PostgreSQL Production Setup Guide

## Overview
This guide helps you set up PostgreSQL for production use with the K33P Identity System, replacing the mock database with a real PostgreSQL instance.

## 🚀 Quick Setup for Production

### 1. PostgreSQL Installation

#### Option A: Local PostgreSQL Installation
```bash
# Windows (using Chocolatey)
choco install postgresql

# Or download from: https://www.postgresql.org/download/windows/
```

#### Option B: Cloud PostgreSQL (Recommended for Production)
- **Render PostgreSQL**: https://render.com/docs/databases
- **AWS RDS**: https://aws.amazon.com/rds/postgresql/
- **Google Cloud SQL**: https://cloud.google.com/sql/postgresql
- **Azure Database**: https://azure.microsoft.com/en-us/services/postgresql/
- **Supabase**: https://supabase.com/database
- **Neon**: https://neon.tech/

### 2. Database Configuration

#### Update your `.env` file with PostgreSQL credentials:
```env
# Database Configuration (PostgreSQL)
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=k33p_production
DB_USER=your-username
DB_PASSWORD=your-secure-password

# For cloud providers, you might use a connection string:
# DATABASE_URL=postgresql://username:password@hostname:port/database?sslmode=require

# Production settings
NODE_ENV=production

# Auto-refund configuration
AUTO_REFUND_ENABLED=true
AUTO_REFUND_POLLING_INTERVAL=30000  # 30 seconds for mobile-optimized polling
```

### 3. Database Initialization

Run the database setup script:
```bash
cd backend
npm run setup-db
```

Or manually initialize:
```bash
node src/database/init.js
```

### 4. Mobile-Optimized Configuration

The system is configured for mobile-first operation:

- **Fast Polling**: 30-second intervals for deposit detection
- **Immediate Refunds**: Automatic 2 ADA refunds upon deposit detection
- **Mobile-Friendly APIs**: Optimized response times and data structures
- **Real-time Updates**: WebSocket support for instant notifications

## 🔧 Production Environment Variables

Ensure these variables are set in your production environment:

```env
# Core Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-frontend-domain.com

# Database (PostgreSQL)
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=k33p_production
DB_USER=your-username
DB_PASSWORD=your-secure-password

# Security
JWT_SECRET=your-super-secure-jwt-secret-256-bits
ADMIN_API_KEY=your-admin-api-key
PHONE_HASH_SALT=your-phone-salt
PIN_SALT=your-pin-salt

# Cardano Network
BLOCKFROST_API_KEY=your-mainnet-blockfrost-key
BLOCKFROST_URL=https://cardano-mainnet.blockfrost.io/api/v0
NETWORK=Mainnet

# Smart Contract (Update for mainnet deployment)
SCRIPT_ADDRESS=addr1...
SCRIPT_HASH=your-script-hash
DEPOSIT_ADDRESS=addr1...

# Backend Wallet
SEED_PHRASE="your production seed phrase with sufficient ADA for refunds"
BACKEND_PRIVATE_KEY=your-backend-private-key

# Auto-Refund System
AUTO_REFUND_ENABLED=true
AUTO_REFUND_POLLING_INTERVAL=30000
```

## 📱 Mobile-First Features

### Automatic 2 ADA Refund System
The system now includes:

1. **Real-time Monitoring**: Continuously monitors for incoming 2 ADA deposits
2. **Instant Processing**: Processes refunds within 30 seconds of deposit detection
3. **Mobile Optimization**: Optimized for mobile wallet interactions
4. **Error Handling**: Robust error handling for network issues

### API Endpoints for Mobile

- `GET /api/health` - System health check
- `GET /deposit-address` - Get deposit address for 2 ADA
- `POST /api/refund` - Manual refund trigger
- `GET /api/user/:address/status` - Check user status

## 🔒 Security Considerations

### Database Security
1. **SSL/TLS**: Always use SSL connections in production
2. **Firewall**: Restrict database access to application servers only
3. **Credentials**: Use strong, unique passwords
4. **Backups**: Set up automated backups

### Application Security
1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Rotate API keys regularly
3. **JWT Secrets**: Use cryptographically secure random strings
4. **Rate Limiting**: Implement rate limiting for API endpoints

## 🚀 Deployment Checklist

- [ ] PostgreSQL database created and accessible
- [ ] Environment variables configured
- [ ] Database schema initialized
- [ ] Smart contract deployed to mainnet (if needed)
- [ ] Backend wallet funded with ADA for refunds
- [ ] Auto-refund monitor tested
- [ ] SSL certificates configured
- [ ] Monitoring and logging set up
- [ ] Backup strategy implemented

## 📊 Monitoring

### Database Monitoring
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check database size
SELECT pg_size_pretty(pg_database_size('k33p_production'));

-- Monitor deposit activity
SELECT 
  COUNT(*) as total_deposits,
  COUNT(*) FILTER (WHERE verified = true) as verified_deposits,
  COUNT(*) FILTER (WHERE refunded = true) as refunded_deposits
FROM user_deposits;
```

### Application Monitoring
- Monitor auto-refund service uptime
- Track refund processing times
- Monitor Blockfrost API usage
- Alert on failed refund attempts

## 🔧 Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check database host and port
   - Verify firewall settings
   - Ensure PostgreSQL is running

2. **Authentication Failed**
   - Verify username and password
   - Check user permissions
   - Ensure database exists

3. **SSL Issues**
   - Set `ssl: { rejectUnauthorized: false }` for development
   - Use proper SSL certificates in production

4. **Auto-Refund Not Working**
   - Check `AUTO_REFUND_ENABLED=true`
   - Verify Blockfrost API key
   - Ensure backend wallet has sufficient ADA
   - Check application logs

### Logs Location
```bash
# Application logs
tail -f logs/combined.log
tail -f logs/error.log

# PostgreSQL logs (location varies by installation)
# Windows: C:\Program Files\PostgreSQL\{version}\data\log
# Linux: /var/log/postgresql/
```

## 📞 Support

For additional support:
1. Check application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test database connection independently
4. Ensure smart contract is properly deployed

---

**Note**: This setup replaces the mock database entirely. Ensure you have backed up any test data before switching to production PostgreSQL.