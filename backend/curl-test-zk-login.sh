#!/bin/bash

# Test the deployed ZK login endpoint using curl
# Based on successful test data from previous tests

echo "🧪 Testing Deployed ZK Login Endpoint with curl"
echo "================================================"
echo "🌐 API URL: https://k33p-backend-0kyx.onrender.com/api"
echo ""

# Test data from successful login
API_URL="https://k33p-backend-0kyx.onrender.com/api"
WALLET_ADDRESS="addr_test1wznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735733999"
PHONE_NUMBER="0666866559900"
COMMITMENT="0957ca616a6c3f33876bf9707a2c06a2b3cf8c1cf3209c6a09"
USER_ID="user_meban3xo_e302qv"

echo "🔐 Test 1: ZK Login with Wallet Address"
echo "----------------------------------------"

# Create the JSON payload for wallet login
WALLET_PAYLOAD=$(cat <<EOF
{
  "walletAddress": "$WALLET_ADDRESS",
  "proof": {
    "publicInputs": {
      "commitment": "$COMMITMENT"
    },
    "isValid": true,
    "proof": "zk-proof-a9b09488404105414ebe83f4c9732d53-0957ca616a",
    "proofData": {
      "proof": "zk-proof-a9b09488404105414ebe83f4c9732d53-0957ca616a",
      "publicInputs": {
        "commitment": "$COMMITMENT-5a353cd4"
      },
      "isValid": true
    }
  },
  "commitment": "$COMMITMENT"
}
EOF
)

echo "📤 Wallet Login Payload:"
echo "$WALLET_PAYLOAD" | jq .
echo ""

echo "📡 Sending wallet login request..."
curl -X POST "$API_URL/zk/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$WALLET_PAYLOAD" \
  -w "\n📊 Response Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "🔐 Test 2: ZK Login with Phone Number"
echo "-------------------------------------"

# Create the JSON payload for phone login
PHONE_PAYLOAD=$(cat <<EOF
{
  "phone": "$PHONE_NUMBER",
  "proof": {
    "publicInputs": {
      "commitment": "$COMMITMENT"
    },
    "isValid": true,
    "proof": "zk-proof-a9b09488404105414ebe83f4c9732d53-0957ca616a",
    "proofData": {
      "proof": "zk-proof-a9b09488404105414ebe83f4c9732d53-0957ca616a",
      "publicInputs": {
        "commitment": "$COMMITMENT-5a353cd4"
      },
      "isValid": true
    }
  },
  "commitment": "$COMMITMENT"
}
EOF
)

echo "📤 Phone Login Payload:"
echo "$PHONE_PAYLOAD" | jq .
echo ""

echo "📡 Sending phone login request..."
curl -X POST "$API_URL/zk/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$PHONE_PAYLOAD" \
  -w "\n📊 Response Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "🏁 curl Test Complete"
echo "===================="
echo "📋 Test Summary:"
echo "   📊 User ID: $USER_ID"
echo "   📱 Phone: $PHONE_NUMBER"
echo "   💳 Wallet: $WALLET_ADDRESS"
echo "   🔐 Commitment: $COMMITMENT"
echo "   🌐 API: $API_URL"
echo ""
echo "💡 Note: Both tests should return 200 status with JWT tokens"
echo "🔧 Requirements: jq (for JSON formatting) - install with: sudo apt-get install jq"