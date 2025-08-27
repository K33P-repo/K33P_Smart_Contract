# K33P Backend API - Postman Deployment Guide

## Files Created

1. **k33p-postman-collection.json** - Complete Postman collection with all API endpoints
2. **k33p-environments.json** - Environment configurations for localhost and production
3. **POSTMAN_DEPLOYMENT_GUIDE.md** - This deployment guide

## Method 1: Import into Postman App (Recommended)

### Step 1: Import Collection
1. Open Postman desktop app or web version
2. Click "Import" button (top left)
3. Select "Upload Files" or drag and drop `k33p-postman-collection.json`
4. Click "Import" to add the collection to your workspace

### Step 2: Import Environments
1. Click the gear icon (⚙️) in the top right corner
2. Select "Manage Environments"
3. Click "Import" button
4. Select `k33p-environments.json`
5. Activate the environment:
   - **K33P Backend - Production** for deployed backend (https://k33p-backend-i9kj.onrender.com)

### Step 3: Test the Collection
1. Select the production environment from the dropdown (top right)
2. Start with "Health Check" endpoint to verify connectivity
3. Use "Phone Signup" or "Login" to get authentication tokens
4. Test other endpoints as needed

## Method 2: Run via Postman CLI

### Prerequisites
- Postman CLI installed
- Postman account and API key (for some features)

### Basic Collection Run
```bash
# Run entire collection against production
postman collection run k33p-postman-collection.json

# Run with environment variables (production is default)
postman collection run k33p-postman-collection.json --env-var "base_url=https://k33p-backend-i9kj.onrender.com"

# Run with verbose output
postman collection run k33p-postman-collection.json --verbose

# Run specific folder (e.g., only Authentication endpoints)
postman collection run k33p-postman-collection.json --folder "Authentication"
```

### Advanced CLI Options
```bash
# Run with delay between requests
postman collection run k33p-postman-collection.json --delay-request 1000

# Run with timeout
postman collection run k33p-postman-collection.json --timeout-request 5000

# Export results to file
postman collection run k33p-postman-collection.json --reporters json --reporter-json-export results.json

# Run with custom working directory
postman collection run k33p-postman-collection.json --working-dir ./
```

## Environment Variables

The collection uses these variables that are automatically managed:

- `base_url` - API base URL (production: https://k33p-backend-i9kj.onrender.com)
- `jwt_token` - Authentication token (auto-set after login)
- `admin_token` - Admin authentication token
- `user_id` - Current user ID (auto-set after login)
- `request_id` - OTP request ID (auto-set after sending OTP)

## API Endpoints Included

### Authentication
- Phone Signup
- PIN Signup
- Login (with auto token extraction)
- Get User Profile
- Logout

### OTP Management
- Send OTP (with auto request_id extraction)
- Verify OTP
- Cancel OTP

### User Management
- Create User Profile
- Get User Profile
- Update User Profile

### UTXO Management
- Get User UTXOs
- Get Balance
- Create Deposit

### Zero-Knowledge Proof
- Generate ZK Commitment
- Generate ZK Proof
- Verify ZK Proof

### Payment & Subscription
- Get Subscription Status
- Initialize Payment
- Activate Subscription
- Cancel Subscription

### Health & Status
- Health Check
- Server Status
- API Version
- Auto-Refund Health

## Testing Workflow

1. **Start with Health Check** - Verify the API is accessible
2. **Authentication** - Use Phone Signup or Login to get JWT token
3. **OTP Flow** - Test Send → Verify → Cancel OTP sequence
4. **User Management** - Create/Update user profiles
5. **Business Logic** - Test UTXO, ZK Proof, Payment endpoints
6. **Monitoring** - Use status endpoints for system health

## Environment Configuration

### In Postman App
- Use the environment dropdown in the top right
- Select "K33P Backend - Production" environment

### In CLI
- The collection is pre-configured for production. You can override if needed:
  ```bash
  # Production (default)
  postman collection run k33p-postman-collection.json
  
  # Override base_url if needed
  postman collection run k33p-postman-collection.json --env-var "base_url=https://k33p-backend-i9kj.onrender.com"
  ```

## Notes

- The collection includes automatic token extraction for seamless testing
- All endpoints are pre-configured with sample request bodies
- Environment variables are automatically managed where possible
- The collection is configured for production testing on Render
- Some endpoints require valid Twilio credentials to function properly

## Troubleshooting

- **500 Errors**: Usually indicate missing environment variables (Twilio, database, etc.)
- **401 Errors**: Check that JWT token is properly set after login
- **Connection Errors**: Verify the production server is accessible at https://k33p-backend-i9kj.onrender.com
- **Timeout Errors**: Increase timeout values in CLI or check server status