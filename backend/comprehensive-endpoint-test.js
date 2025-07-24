// Comprehensive endpoint testing for K33P Backend on Render
import https from 'https';
import http from 'http';

const BASE_URL = 'https://k33p-backend-0kyx.onrender.com';

// Test data
const testData = {
  phoneNumber: '+1234567890',
  userId: 'test_user_' + Date.now(),
  userAddress: 'addr_test1qztest123456789abcdef',
  pin: '1234',
  biometricData: 'test_biometric_data',
  verificationMethod: 'phone',
  biometricType: 'fingerprint'
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'K33P-Test-Client/1.0',
        ...options.headers
      }
    };

    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test endpoints
const endpoints = [
  // Basic endpoints
  { name: 'Health Check', method: 'GET', path: '/api/health', expectedStatus: 200 },
  { name: 'Status Check', method: 'GET', path: '/api/status', expectedStatus: 200 },
  { name: 'Version Check', method: 'GET', path: '/api/version', expectedStatus: 200 },
  { name: 'Deposit Address', method: 'GET', path: '/api/deposit-address', expectedStatus: 200 },
  
  // Auth endpoints

  { name: 'Auth Signup', method: 'POST', path: '/api/auth/signup', body: testData, expectedStatus: [200, 400] },
  
  // UTXO endpoints (these require authentication, so we expect 401)
  { name: 'UTXO User Balance', method: 'GET', path: '/api/utxo/balance', expectedStatus: 401 },
  { name: 'UTXO User UTXOs', method: 'GET', path: '/api/utxo/user', expectedStatus: 401 },
  { name: 'UTXO Deposit', method: 'POST', path: '/api/utxo/deposit', body: { amount: 2, walletAddress: testData.userAddress }, expectedStatus: 401 },
  
  // ZK endpoints
  { name: 'ZK Commitment', method: 'POST', path: '/api/zk/commitment', body: { phone: testData.phoneNumber, biometric: testData.biometricData, passkey: 'test_passkey' }, expectedStatus: 200 },
  { name: 'ZK Proof', method: 'POST', path: '/api/zk/proof', body: { phone: testData.phoneNumber, biometric: testData.biometricData, passkey: 'test_passkey', commitment: 'test_commitment' }, expectedStatus: [200, 400] },
  { name: 'ZK Verify', method: 'POST', path: '/api/zk/verify', body: { proof: { publicInputs: { commitment: 'test' }, isValid: true }, commitment: 'test_commitment' }, expectedStatus: 200 },
  
  // User management endpoints (these require authentication, so we expect 401)
  { name: 'User Profile GET', method: 'GET', path: '/api/user/profile', expectedStatus: 401 },
  { name: 'User Profile POST', method: 'POST', path: '/api/user/profile', body: { walletAddress: testData.userAddress }, expectedStatus: [200, 404] },
  
  // Additional endpoints that might exist
  { name: 'Verify Deposit', method: 'POST', path: '/api/verify-deposit', body: { userAddress: testData.userAddress }, expectedStatus: [200, 400, 404] },
  { name: 'Retry Verification', method: 'POST', path: '/api/retry-verification', body: { userAddress: testData.userAddress }, expectedStatus: [200, 400, 404] },
  { name: 'User Status', method: 'GET', path: `/api/user/${testData.userAddress}/status`, expectedStatus: [200, 404] },
  { name: 'Refund', method: 'POST', path: '/api/refund', body: { userAddress: testData.userAddress }, expectedStatus: [200, 400, 404] }
];

async function testEndpoint(endpoint) {
  try {
    console.log(`\n🧪 Testing: ${endpoint.name}`);
    console.log(`   ${endpoint.method} ${endpoint.path}`);
    
    const options = {
      method: endpoint.method,
      body: endpoint.body
    };
    
    const result = await makeRequest(BASE_URL + endpoint.path, options);
    
    const expectedStatuses = Array.isArray(endpoint.expectedStatus) ? endpoint.expectedStatus : [endpoint.expectedStatus];
    const isExpectedStatus = expectedStatuses.includes(result.status);
    
    if (isExpectedStatus) {
      console.log(`   ✅ PASS - Status: ${result.status}`);
      if (result.data && typeof result.data === 'object' && result.data.message) {
        console.log(`   📝 Message: ${result.data.message}`);
      }
    } else {
      console.log(`   ❌ FAIL - Expected: ${expectedStatuses.join(' or ')}, Got: ${result.status}`);
      if (result.data && typeof result.data === 'object' && result.data.error) {
        console.log(`   🚨 Error: ${result.data.error}`);
      } else if (typeof result.data === 'string') {
        console.log(`   🚨 Response: ${result.data.substring(0, 200)}...`);
      }
    }
    
    return { endpoint: endpoint.name, status: result.status, expected: expectedStatuses, passed: isExpectedStatus };
  } catch (error) {
    console.log(`   💥 ERROR - ${error.message}`);
    return { endpoint: endpoint.name, status: 'ERROR', expected: endpoint.expectedStatus, passed: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive endpoint testing for K33P Backend');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Test started at: ${new Date().toISOString()}`);
  console.log('=' .repeat(80));
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // Add a small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '=' .repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n🚨 Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   • ${r.endpoint}: Expected ${Array.isArray(r.expected) ? r.expected.join(' or ') : r.expected}, Got ${r.status}`);
    });
  }
  
  console.log('\n🎯 Recommendations:');
  
  // Check for 404s that might indicate missing routes
  const notFoundEndpoints = results.filter(r => r.status === 404);
  if (notFoundEndpoints.length > 0) {
    console.log('   • The following endpoints returned 404 - verify they are properly registered:');
    notFoundEndpoints.forEach(r => console.log(`     - ${r.endpoint}`));
  }
  
  // Check for 401s (expected for protected routes)
  const unauthorizedEndpoints = results.filter(r => r.status === 401);
  if (unauthorizedEndpoints.length > 0) {
    console.log('   • The following endpoints require authentication (this is expected):');
    unauthorizedEndpoints.forEach(r => console.log(`     - ${r.endpoint}`));
  }
  
  // Check for 500s (server errors)
  const serverErrorEndpoints = results.filter(r => r.status >= 500);
  if (serverErrorEndpoints.length > 0) {
    console.log('   • The following endpoints have server errors - check logs:');
    serverErrorEndpoints.forEach(r => console.log(`     - ${r.endpoint}`));
  }
  
  console.log('\n✨ Test completed successfully!');
}

// Run the tests
runAllTests().catch(console.error);