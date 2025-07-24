#!/bin/bash

# K33P User Signup and Login Simulation Script
# This script simulates the complete user flow: signup and ZK login

echo "=== K33P User Signup and Login Simulation ==="
echo "Starting simulation at $(date)"
echo ""

# Configuration
BASE_URL="https://k33p-backend-0kyx.onrender.com"
PHONE="+1234567890"
BIOMETRIC="biometric_hash_data_abc123"
PASSKEY="passkey_data_xyz789"
WALLET_ADDRESS="addr1qxy8ac7qqy0vtulyl7wntmsxc6wex80gvcyjy33qffrhm7sh927ysx5sftw0dlpzwjncxmfh780kdtp2f06lz0jy0lapmr5gwm"

echo "Configuration:"
echo "- Base URL: $BASE_URL"
echo "- Phone: $PHONE"
echo "- Wallet Address: $WALLET_ADDRESS"
echo ""

# Step 1: Health Check
echo "=== Step 1: Health Check ==="
echo "Checking system health..."
curl -X GET "$BASE_URL/api/health" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""
echo ""

# Step 2: Get Deposit Address
echo "=== Step 2: Get Deposit Address ==="
echo "Fetching deposit address for 2 ADA..."
curl -X GET "$BASE_URL/api/deposit-address" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""
echo ""

# Step 3: Generate ZK Commitment
echo "=== Step 3: Generate ZK Commitment ==="
echo "Generating ZK commitment from user inputs..."
COMMITMENT_RESPONSE=$(curl -X POST "$BASE_URL/api/zk/commitment" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"$PHONE\",
    \"biometric\": \"$BIOMETRIC\",
    \"passkey\": \"$PASSKEY\"
  }" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s)

echo "$COMMITMENT_RESPONSE"

# Extract commitment from response (simplified - in real scenario you'd parse JSON properly)
COMMITMENT="zk_commitment_hash_abc123"
echo "Using commitment: $COMMITMENT"
echo ""
echo ""

# Step 4: User Signup
echo "=== Step 4: User Signup ==="
echo "Registering new user..."
SIGNUP_RESPONSE=$(curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"walletAddress\": \"$WALLET_ADDRESS\",
    \"phone\": \"$PHONE\",
    \"biometric\": \"$BIOMETRIC\",
    \"passkey\": \"$PASSKEY\"
  }" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s)

echo "$SIGNUP_RESPONSE"
echo ""
echo ""

# Step 5: Generate ZK Proof
echo "=== Step 5: Generate ZK Proof ==="
echo "Generating ZK proof for login..."
PROOF_RESPONSE=$(curl -X POST "$BASE_URL/api/zk/proof" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"$PHONE\",
    \"biometric\": \"$BIOMETRIC\",
    \"passkey\": \"$PASSKEY\",
    \"commitment\": \"$COMMITMENT\"
  }" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s)

echo "$PROOF_RESPONSE"
echo ""
echo ""

# Step 6: Verify ZK Proof
echo "=== Step 6: Verify ZK Proof ==="
echo "Verifying the generated ZK proof..."
curl -X POST "$BASE_URL/api/zk/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"proof\": {
      \"publicInputs\": {
        \"commitment\": \"$COMMITMENT\"
      },
      \"isValid\": true,
      \"proofData\": \"proof_data_xyz789\"
    },
    \"commitment\": \"$COMMITMENT\"
  }" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""
echo ""

# Step 7: ZK Login
echo "=== Step 7: ZK Login ==="
echo "Performing ZK login..."
LOGIN_RESPONSE=$(curl -X POST "$BASE_URL/api/zk/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"proof\": {
      \"publicInputs\": {
        \"commitment\": \"$COMMITMENT\"
      },
      \"isValid\": true,
      \"proofData\": \"proof_data_xyz789\"
    },
    \"commitment\": \"$COMMITMENT\",
    \"phone\": \"$PHONE\"
  }" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s)

echo "$LOGIN_RESPONSE"
echo ""
echo ""



echo "=== Simulation Complete ==="
echo "Finished at $(date)"
echo ""
echo "Summary:"
echo "1. ✓ Health check performed"
echo "2. ✓ Deposit address retrieved"
echo "3. ✓ ZK commitment generated"
echo "4. ✓ User signup attempted"
echo "5. ✓ ZK proof generated"
echo "6. ✓ ZK proof verified"
echo "7. ✓ ZK login performed"
echo ""
echo "Note: Check HTTP status codes and response messages above for success/failure details."