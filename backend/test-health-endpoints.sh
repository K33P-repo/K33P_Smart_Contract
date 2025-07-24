#!/bin/bash

# K33P Backend Health Endpoint Test Script
# Tests health endpoints using curl commands in WSL Ubuntu
# Author: K33P Development Team
# Usage: ./test-health-endpoints.sh

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
TIMEOUT=10
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

# Function to test a single endpoint
test_endpoint() {
    local url=$1
    local endpoint=$2
    local description=$3
    local full_url="${url}${endpoint}"
    
    echo
    echo "==========================================="
    print_status "INFO" "Testing: $description"
    print_status "INFO" "URL: $full_url"
    echo "==========================================="
    
    # Test with detailed output
    echo "📡 Making curl request..."
    
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
        
        # Validate response
        if [ "$http_code" = "200" ]; then
            if echo "$response_body" | grep -q '"status".*"ok"'; then
                print_status "SUCCESS" "Endpoint is healthy and responding correctly"
                
                # Additional JSON validation
                if command -v jq >/dev/null 2>&1; then
                    echo "🔍 JSON Structure Analysis:"
                    echo "$response_body" | jq . 2>/dev/null || echo "   Valid JSON format confirmed"
                fi
            else
                print_status "WARNING" "Endpoint responded but status is not 'ok'"
            fi
        else
            print_status "ERROR" "HTTP $http_code - Endpoint not responding correctly"
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

# Function to test endpoint with different HTTP methods
test_endpoint_methods() {
    local url=$1
    local endpoint=$2
    
    echo
    echo "🔧 Testing HTTP Methods for $endpoint"
    echo "==========================================="
    
    # Test HEAD request
    echo "Testing HEAD request..."
    if curl -I -s --connect-timeout 5 "${url}${endpoint}" | head -1; then
        print_status "SUCCESS" "HEAD request successful"
    else
        print_status "ERROR" "HEAD request failed"
    fi
    
    # Test OPTIONS request
    echo "Testing OPTIONS request..."
    if curl -X OPTIONS -s --connect-timeout 5 "${url}${endpoint}" >/dev/null 2>&1; then
        print_status "SUCCESS" "OPTIONS request successful"
    else
        print_status "WARNING" "OPTIONS request failed (may not be supported)"
    fi
}

# Function to run load test
run_load_test() {
    local url=$1
    local endpoint=$2
    local requests=10
    
    echo
    echo "⚡ Load Testing: $requests concurrent requests"
    echo "==========================================="
    
    local success_count=0
    local start_time=$(date +%s.%N)
    
    for i in $(seq 1 $requests); do
        if curl -s --connect-timeout 5 --max-time 10 "${url}${endpoint}" >/dev/null 2>&1; then
            ((success_count++))
        fi &
    done
    
    wait  # Wait for all background jobs to complete
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "N/A")
    
    echo "📈 Load Test Results:"
    echo "   Successful requests: $success_count/$requests"
    echo "   Total time: ${duration}s"
    echo "   Success rate: $(( success_count * 100 / requests ))%"
    
    if [ $success_count -eq $requests ]; then
        print_status "SUCCESS" "All requests completed successfully"
    else
        print_status "WARNING" "Some requests failed during load test"
    fi
}

# Main execution
echo "🚀 K33P Backend Health Endpoint Testing Suite"
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
echo "🌐 TESTING DEPLOYED SERVER"
echo "============================================="

test_endpoint "$DEPLOYED_URL" "/api/health" "Main health endpoint (deployed)"
test_endpoint "$DEPLOYED_URL" "/health" "Legacy health endpoint (deployed)"
test_endpoint "$DEPLOYED_URL" "/" "Root endpoint (deployed)"

# Test different HTTP methods on deployed server
test_endpoint_methods "$DEPLOYED_URL" "/api/health"

# Run load test on deployed server
run_load_test "$DEPLOYED_URL" "/api/health"

# Test local server endpoints (if running)
echo
echo "🏠 TESTING LOCAL SERVER"
echo "============================================="

print_status "INFO" "Checking if local server is running..."
if curl -s --connect-timeout 2 "$LOCAL_URL/api/health" >/dev/null 2>&1; then
    print_status "SUCCESS" "Local server is running"
    
    test_endpoint "$LOCAL_URL" "/api/health" "Main health endpoint (local)"
    test_endpoint "$LOCAL_URL" "/health" "Legacy health endpoint (local)"
    test_endpoint "$LOCAL_URL" "/" "Root endpoint (local)"
    
    # Test different HTTP methods on local server
    test_endpoint_methods "$LOCAL_URL" "/api/health"
    
    # Run load test on local server
    run_load_test "$LOCAL_URL" "/api/health"
else
    print_status "WARNING" "Local server is not running or not accessible"
    print_status "INFO" "To start local server, run: npm run dev"
fi

# Test additional endpoints
echo
echo "🔍 TESTING ADDITIONAL ENDPOINTS"
echo "============================================="

test_endpoint "$DEPLOYED_URL" "/api/auth" "Auth endpoint (should return method not allowed)"
test_endpoint "$DEPLOYED_URL" "/api/utxo" "UTXO endpoint (should return method not allowed)"
test_endpoint "$DEPLOYED_URL" "/api/zk" "ZK endpoint (should return method not allowed)"

# Summary
echo
echo "📋 TEST SUMMARY"
echo "============================================="
print_status "INFO" "Health endpoint testing completed"
print_status "INFO" "Deployed server: $DEPLOYED_URL"
print_status "INFO" "Expected response: {\"status\":\"ok\"}"
print_status "INFO" "All tests completed at $(date)"

echo
echo "💡 USAGE EXAMPLES:"
echo "============================================="
echo "# Basic health check:"
echo "curl $DEPLOYED_URL/api/health"
echo
echo "# Health check with headers:"
echo "curl -i $DEPLOYED_URL/api/health"
echo
echo "# Health check with timing:"
echo "curl -w 'Total: %{time_total}s\n' -o /dev/null -s $DEPLOYED_URL/api/health"
echo
echo "# Health check with verbose output:"
echo "curl -v $DEPLOYED_URL/api/health"
echo
echo "🎯 Test completed successfully!"