#!/usr/bin/env node

/**
 * Simple endpoint testing script for K33P Backend
 * Tests all major endpoints on the deployed Render server
 */

const BASE_URL = 'https://k33p-backend-0kyx.onrender.com';

// Test endpoints configuration
const endpoints = [
  { name: 'Health Check', method: 'GET', path: '/api/health' },
  { name: 'Status Check', method: 'GET', path: '/api/status' },
  { name: 'Deposit Address', method: 'GET', path: '/api/deposit-address' },
  { name: 'API Version', method: 'GET', path: '/api/version' },
  { name: 'UTXO Endpoint', method: 'GET', path: '/api/utxo' },
  { name: 'ZK Endpoint', method: 'GET', path: '/api/zk' },
  { name: 'Auth Status', method: 'GET', path: '/api/auth/status' },
  { 
    name: 'Signup Test', 
    method: 'POST', 
    path: '/api/auth/signup',
    body: {
      phoneNumber: '+1234567890',
      userId: 'test_user_' + Date.now(),
      userAddress: 'addr_test1qztest123456789abcdef',
      verificationMethod: 'phone',
      pin: '1234',
      biometricType: 'fingerprint'
    }
  },
  {
    name: 'Verify Deposit Test',
    method: 'POST',
    path: '/api/verify-deposit',
    body: {
      txHash: 'test_tx_hash_' + Date.now(),
      amount: 1000000,
      walletAddress: 'addr_test1qztest123456789abcdef'
    }
  }
];

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Test results
let results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Test a single endpoint
async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const startTime = Date.now();
  
  try {
    const options = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (endpoint.body) {
      options.body = JSON.stringify(endpoint.body);
    }
    
    console.log(`\n${colors.blue}Testing: ${endpoint.name}${colors.reset}`);
    console.log(`${colors.cyan}${endpoint.method} ${url}${colors.reset}`);
    console.log('-'.repeat(60));
    
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;
    
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      responseData = await response.text();
    }
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Response Time: ${responseTime}ms`);
    console.log(`Response:`, typeof responseData === 'string' ? responseData.substring(0, 200) : JSON.stringify(responseData, null, 2).substring(0, 300));
    
    if (response.ok) {
      console.log(`${colors.green}✅ PASSED${colors.reset}`);
      results.passed++;
    } else {
      console.log(`${colors.yellow}⚠️  FAILED (${response.status})${colors.reset}`);
      results.failed++;
      results.errors.push({
        endpoint: endpoint.name,
        status: response.status,
        message: responseData.message || responseData
      });
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`${colors.red}❌ ERROR${colors.reset}`);
    console.log(`Response Time: ${responseTime}ms`);
    console.log(`Error: ${error.message}`);
    
    results.failed++;
    results.errors.push({
      endpoint: endpoint.name,
      error: error.message
    });
  }
  
  results.total++;
}

// Main test function
async function runTests() {
  console.log(`${colors.bold}${colors.magenta}🧪 K33P Backend Endpoint Testing${colors.reset}`);
  console.log(`${colors.cyan}Server: ${BASE_URL}${colors.reset}`);
  console.log('='.repeat(80));
  
  // Test all endpoints
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bold}📊 TEST SUMMARY${colors.reset}`);
  console.log('='.repeat(80));
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%`);
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.red}❌ FAILED ENDPOINTS:${colors.reset}`);
    console.log('-'.repeat(40));
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.endpoint}`);
      if (error.status) {
        console.log(`   Status: ${error.status}`);
        console.log(`   Message: ${error.message}`);
      } else {
        console.log(`   Error: ${error.error}`);
      }
    });
  }
  
  console.log('\n🎯 Testing completed!');
}

// Run the tests
runTests().catch(console.error);