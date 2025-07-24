#!/bin/bash

# K33P Backend API Endpoints Test Script
# Tests all API endpoints including authentication, UTXO, and ZK endpoints
# Author: K33P Development Team
# Usage: ./test-api-endpoints.sh

set -e  # Exit on any error

# Colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYED_URL="https://k33p-backend-0kyx.onrender.com"
LOCAL_URL="http://localhost:3000"
TIMEOUT=30
MAX_RETRIES=3

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ SUCCESS:${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}❌ ERROR:${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  WARNING:${NC} $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  INFO:${NC} $message"
            ;;
    esac
}

# Function to test POST endpoint with JSON payload
test_post_endpoint() {
    local url=$1
    local endpoint=$2
    local description=$3
    local payload=$4
    local full_url="${url}${endpoint}"
    
    echo
    echo "==========================================="
    print_status "INFO" "Testing: $description"
    print_status "INFO" "URL: $full_url"
    print_status "INFO" "Method: POST"
    echo "==========================================="
    
    # Test with detailed output
    echo "📡 Making POST request..."
    
    # Capture response with timing and headers
    local response_file=$(mktemp)
    local headers_file=$(mktemp)
    local timing_file=$(mktemp)
    
    # Execute curl with comprehensive options
    if curl -s -w "@-" -o "$response_file" -D "$headers_file" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        --connect-timeout $TIMEOUT \
        --max-time $((TIMEOUT * 2)) \
        --retry $MAX_RETRIES \
        --retry-delay 1 \
        --retry-max-time $((TIMEOUT * MAX_RETRIES)) \
        -d "$payload" \
        "$full_url" <<< '
HTTP Status: %{http_code}
Total Time: %{time_total}s
Connect Time: %{time_connect}s
Response Size: %{size_download} bytes
Content Type: %{content_type}
' > "$timing_file" 2>/dev/null; then
        
        # Parse response
        local http_code=$(grep "HTTP Status:" "$timing_file" | cut -d' ' -f3)
        local total_time=$(grep "Total Time:" "$timing_file" | cut -d' ' -f3)
        local response_body=$(cat "$response_file")
        
        echo "📊 Response Details:"
        echo "   Status Code: $http_code"
        echo "   Response Time: $total_time"
        echo "   Response Body: $response_body"
        
        # Validate response based on status code
        case $http_code in
            200|201)
                print_status "SUCCESS" "Request completed successfully"
                ;;
            400)
                print_status "WARNING" "Bad Request - Check payload format"
                ;;
            401)
                print_status "WARNING" "Unauthorized - Authentication required"
                ;;
            404)
                print_status "ERROR" "Endpoint not found"
                ;;
            405)
                print_status "INFO" "Method not allowed (expected for some endpoints)"
                ;;
            500)
                print_status "ERROR" "Internal server error"
                ;;
            *)
                print_status "WARNING" "Unexpected status code: $http_code"
                ;;
        esac
        
        # Additional JSON validation
        if command -v jq >/dev/null 2>&1; then
            echo "🔍 JSON Structure Analysis:"
            if echo "$response_body" | jq . >/dev/null 2>&1; then
                echo "   Valid JSON response"
                echo "$response_body" | jq .
            else
                echo "   Response is not valid JSON (may be HTML error page)"
            fi
        fi
        
        # Show headers
        echo "📋 Response Headers:"
        cat "$headers_file" | head -10
        
    else
        print_status "ERROR" "Failed to connect to endpoint (timeout or connection error)"
    fi
    
    # Cleanup temp files
    rm -f "$response_file" "$headers_file" "$timing_file"
}

# Function to test GET endpoint
test_get_endpoint() {
    local url=$1
    local endpoint=$2
    local description=$3
    local full_url="${url}${endpoint}"
    
    echo
    echo "==========================================="
    print_status "INFO" "Testing: $description"
    print_status "INFO" "URL: $full_url"
    print_status "INFO" "Method: GET"
    echo "==========================================="
    
    # Test with detailed output
    echo "📡 Making GET request..."
    
    # Capture response with timing and headers
    local response_file=$(mktemp)
    local headers_file=$(mktemp)
    local timing_file=$(mktemp)
    
    # Execute curl with comprehensive options
    if curl -s -w "@-" -o "$response_file" -D "$headers_file" \
        --connect-timeout $TIMEOUT \
        --max-time $((TIMEOUT * 2)) \
        --retry $MAX_RETRIES \
        --retry-delay 1 \
        --retry-max-time $((TIMEOUT * MAX_RETRIES)) \
        "$full_url" <<< '
HTTP Status: %{http_code}
Total Time: %{time_total}s
Connect Time: %{time_connect}s
Response Size: %{size_download} bytes
Content Type: %{content_type}
' > "$timing_file" 2>/dev/null; then
        
        # Parse response
        local http_code=$(grep "HTTP Status:" "$timing_file" | cut -d' ' -f3)
        local total_time=$(grep "Total Time:" "$timing_file" | cut -d' ' -f3)
        local response_body=$(cat "$response_file")
        
        echo "📊 Response Details:"
        echo "   Status Code: $http_code"
        echo "   Response Time: $total_time"
        echo "   Response Body: $response_body"
        
        # Validate response based on status code
        case $http_code in
            200)
                print_status "SUCCESS" "Request completed successfully"
                ;;
            404)
                print_status "ERROR" "Endpoint not found"
                ;;
            405)
                print_status "INFO" "Method not allowed (expected for POST-only endpoints)"
                ;;
            500)
                print_status "ERROR" "Internal server error"
                ;;
            *)
                print_status "WARNING" "Unexpected status code: $http_code"
                ;;
        esac
        
        # Show headers
        echo "📋 Response Headers:"
        cat "$headers_file" | head -10
        
    else
        print_status "ERROR" "Failed to connect to endpoint (timeout or connection error)"
    fi
    
    # Cleanup temp files
    rm -f "$response_file" "$headers_file" "$timing_file"
}

# Sample payloads for testing
SIGNUP_PAYLOAD='{
  "walletAddress": "addr_test1qz8fg4e2982jdpzjh7zl9q8r5x6w3n4v7c2m1k9s8d7f6g5h4j3l2p0o9i8u7y6t5r4e3w2q1a0s9d8f7g6h5j4k3l2m1",
  "phoneNumber": "+1234567890",
  "zkProof": {
    "proof": "sample_zk_proof_data_for_testing",
    "publicSignals": ["signal1", "signal2"]
  },
  "commitment": "sample_commitment_hash"
}'

LOGIN_PAYLOAD='{
  "phone": "+1234567890",
  "proof": "sample_zk_proof_for_login",
  "commitment": "sample_commitment_hash_for_login"
}'

VERIFY_TOKEN_PAYLOAD='{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample_token_payload.signature"
}'

UTXO_DEPOSIT_PAYLOAD='{
  "amount": 1000000,
  "walletAddress": "addr_test1qz8fg4e2982jdpzjh7zl9q8r5x6w3n4v7c2m1k9s8d7f6g5h4j3l2p0o9i8u7y6t5r4e3w2q1a0s9d8f7g6h5j4k3l2m1"
}'

UTXO_REFUND_PAYLOAD='{
  "utxo": {
    "txHash": "sample_tx_hash_123456789abcdef",
    "outputIndex": 0,
    "amount": 1000000
  },
  "ownerAddress": "addr_test1qz8fg4e2982jdpzjh7zl9q8r5x6w3n4v7c2m1k9s8d7f6g5h4j3l2p0o9i8u7y6t5r4e3w2q1a0s9d8f7g6h5j4k3l2m1",
  "zkProof": {
    "proof": "sample_zk_proof_for_refund",
    "publicSignals": ["signal1", "signal2"]
  }
}'

UTXO_HISTORY_PAYLOAD='{
  "walletAddress": "addr_test1qz8fg4e2982jdpzjh7zl9q8r5x6w3n4v7c2m1k9s8d7f6g5h4j3l2p0o9i8u7y6t5r4e3w2q1a0s9d8f7g6h5j4k3l2m1",
  "page": 1,
  "limit": 10
}'

ZK_COMMITMENT_PAYLOAD='{
  "phone": "+1234567890",
  "biometric": "sample_biometric_hash_data",
  "passkey": "sample_passkey_data"
}'

ZK_PROOF_PAYLOAD='{
  "phone": "+1234567890",
  "biometric": "sample_biometric_hash_data",
  "passkey": "sample_passkey_data"
}'

ZK_VERIFY_PAYLOAD='{
  "proof": "sample_zk_proof_for_verification",
  "commitment": "sample_commitment_for_verification"
}'

ZK_LOGIN_PAYLOAD='{
  "walletAddress": "addr_test1qz8fg4e2982jdpzjh7zl9q8r5x6w3n4v7c2m1k9s8d7f6g5h4j3l2p0o9i8u7y6t5r4e3w2q1a0s9d8f7g6h5j4k3l2m1",
  "proof": "sample_zk_proof_for_zk_login",
  "commitment": "sample_commitment_for_zk_login"
}'

USER_PROFILE_PAYLOAD='{
  "walletAddress": "addr_test1qz8fg4e2982jdpzjh7zl9q8r5x6w3n4v7c2m1k9s8d7f6g5h4j3l2p0o9i8u7y6t5r4e3w2q1a0s9d8f7g6h5j4k3l2m1"
}'

# Main execution
echo "🚀 K33P Backend API Endpoints Testing Suite"
echo "============================================="
echo "Timestamp: $(date)"
echo "Testing deployed server: $DEPLOYED_URL"
echo "Testing local server: $LOCAL_URL"
echo

# Check if curl is available
if ! command -v curl >/dev/null 2>&1; then
    print_status "ERROR" "curl is not installed. Please install curl first."
    exit 1
fi

print_status "SUCCESS" "curl is available"

# Check if jq is available (optional)
if command -v jq >/dev/null 2>&1; then
    print_status "SUCCESS" "jq is available for JSON parsing"
else
    print_status "WARNING" "jq not found - JSON parsing will be limited"
fi

# Test deployed server endpoints
echo
echo "🌐 TESTING DEPLOYED SERVER API ENDPOINTS"
echo "============================================="

# Test Authentication endpoints
echo
echo "🔐 AUTHENTICATION ENDPOINTS"
echo "============================================="

test_post_endpoint "$DEPLOYED_URL" "/api/auth/signup" "User Signup (POST)" "$SIGNUP_PAYLOAD"
test_get_endpoint "$DEPLOYED_URL" "/api/auth/signup" "User Signup (GET - should fail)"
test_post_endpoint "$DEPLOYED_URL" "/api/auth/login" "User Login (POST)" "$LOGIN_PAYLOAD"
test_get_endpoint "$DEPLOYED_URL" "/api/auth/login" "User Login (GET - should fail)"
test_post_endpoint "$DEPLOYED_URL" "/api/auth/verify" "Token Verification (POST)" "$VERIFY_TOKEN_PAYLOAD"

# Test UTXO endpoints
echo
echo "💰 UTXO ENDPOINTS"
echo "============================================="

test_post_endpoint "$DEPLOYED_URL" "/api/utxo/deposit" "UTXO Deposit (POST)" "$UTXO_DEPOSIT_PAYLOAD"
test_get_endpoint "$DEPLOYED_URL" "/api/utxo/deposit" "UTXO Deposit (GET - should fail)"
test_post_endpoint "$DEPLOYED_URL" "/api/utxo/refund" "UTXO Refund (POST)" "$UTXO_REFUND_PAYLOAD"
test_get_endpoint "$DEPLOYED_URL" "/api/utxo/balance" "UTXO Balance (GET)"
test_post_endpoint "$DEPLOYED_URL" "/api/utxo/history" "UTXO History (POST)" "$UTXO_HISTORY_PAYLOAD"

# Test ZK endpoints
echo
echo "🔒 ZERO-KNOWLEDGE ENDPOINTS"
echo "============================================="

test_post_endpoint "$DEPLOYED_URL" "/api/zk/verify" "ZK Proof Verification (POST)" "$ZK_VERIFY_PAYLOAD"
test_get_endpoint "$DEPLOYED_URL" "/api/zk/verify" "ZK Proof Verification (GET - should fail)"
test_post_endpoint "$DEPLOYED_URL" "/api/zk/commitment" "ZK Commitment (POST)" "$ZK_COMMITMENT_PAYLOAD"
test_post_endpoint "$DEPLOYED_URL" "/api/zk/proof" "ZK Proof Generation (POST)" "$ZK_PROOF_PAYLOAD"
test_post_endpoint "$DEPLOYED_URL" "/api/zk/login" "ZK Login (POST)" "$ZK_LOGIN_PAYLOAD"

# Test additional endpoints
echo
echo "🔍 ADDITIONAL ENDPOINTS"
echo "============================================="

test_get_endpoint "$DEPLOYED_URL" "/api/status" "API Status"
test_get_endpoint "$DEPLOYED_URL" "/api/version" "API Version"
test_post_endpoint "$DEPLOYED_URL" "/api/user/profile" "User Profile (POST)" "$USER_PROFILE_PAYLOAD"
test_get_endpoint "$DEPLOYED_URL" "/api/user/profile" "User Profile (GET)"

# Test local server if running
echo
echo "🏠 TESTING LOCAL SERVER (if running)"
echo "============================================="

print_status "INFO" "Checking if local server is running..."
if curl -s --connect-timeout 2 "$LOCAL_URL/api/health" >/dev/null 2>&1; then
    print_status "SUCCESS" "Local server is running"
    
    echo
    echo "🔐 LOCAL AUTHENTICATION ENDPOINTS"
    test_post_endpoint "$LOCAL_URL" "/api/auth/signup" "Local User Signup (POST)" "$SIGNUP_PAYLOAD"
    
    echo
    echo "💰 LOCAL UTXO ENDPOINTS"
    test_post_endpoint "$LOCAL_URL" "/api/utxo/deposit" "Local UTXO Deposit (POST)" "$UTXO_DEPOSIT_PAYLOAD"
    
    echo
    echo "🔒 LOCAL ZK ENDPOINTS"
    test_post_endpoint "$LOCAL_URL" "/api/zk/verify" "Local ZK Verification (POST)" "$ZK_VERIFY_PAYLOAD"
else
    print_status "WARNING" "Local server is not running or not accessible"
    print_status "INFO" "To start local server, run: npm run dev"
fi

# Summary
echo
echo "📋 API ENDPOINTS TEST SUMMARY"
echo "============================================="
print_status "INFO" "API endpoints testing completed"
print_status "INFO" "Deployed server: $DEPLOYED_URL"
print_status "INFO" "Test payloads used for POST requests"
print_status "INFO" "All tests completed at $(date)"

echo
echo "💡 USAGE EXAMPLES:"
echo "============================================="
echo "# Test signup endpoint:"
echo "curl -X POST -H 'Content-Type: application/json' -d '$SIGNUP_PAYLOAD' $DEPLOYED_URL/api/auth/signup"
echo
echo "# Test UTXO deposit:"
echo "curl -X POST -H 'Content-Type: application/json' -d '$UTXO_DEPOSIT_PAYLOAD' $DEPLOYED_URL/api/utxo/deposit"
echo
echo "# Test ZK verification:"
echo "curl -X POST -H 'Content-Type: application/json' -d '$ZK_VERIFY_PAYLOAD' $DEPLOYED_URL/api/zk/verify"
echo
echo "# Test ZK commitment:"
echo "curl -X POST -H 'Content-Type: application/json' -d '$ZK_COMMITMENT_PAYLOAD' $DEPLOYED_URL/api/zk/commitment"
echo
echo "# Test ZK proof:"
echo "curl -X POST -H 'Content-Type: application/json' -d '$ZK_PROOF_PAYLOAD' $DEPLOYED_URL/api/zk/proof"
echo
echo "🎯 API endpoint testing completed successfully!"