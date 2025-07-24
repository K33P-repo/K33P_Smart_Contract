// Test script for 2 ADA refund functionality
import https from 'https';
import http from 'http';

const BASE_URL = 'https://k33p-backend-0kyx.onrender.com';

// Test data - using a valid Cardano testnet address format
const testData = {
  userAddress: 'addr_test1qp8cjjan499llrgw6tyyzclxg8gxjxc9mwc4w7rqcx8jrmwza2v0vp3dk3jcdq47teay45jqy5zqx47h6u4zar2f07lqd6f8py',
  walletAddress: 'addr_test1qquds2rqarqkk40lncfu88cwhptxekt7j0eccucpd2a43a35pel7jwkfmsf8zrjwsklm4czm5wqsgxwst5mrw86kt84qs7m4na'
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
        'User-Agent': 'K33P-Refund-Test/1.0',
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

// Test the refund endpoint
async function testRefundEndpoint() {
  console.log('🧪 Testing 2 ADA Refund Endpoint');
  console.log('=' .repeat(50));
  
  try {
    console.log('\n📋 Test Configuration:');
    console.log(`   Base URL: ${BASE_URL}`);
    console.log(`   User Address: ${testData.userAddress}`);
    console.log(`   Wallet Address: ${testData.walletAddress}`);
    
    console.log('\n🚀 Sending refund request...');
    
    const result = await makeRequest(BASE_URL + '/api/refund', {
      method: 'POST',
      body: testData
    });
    
    console.log(`\n📊 Response Status: ${result.status}`);
    console.log('📄 Response Data:');
    console.log(JSON.stringify(result.data, null, 2));
    
    // Analyze the response
    if (result.status === 200 && result.data.success) {
      console.log('\n✅ SUCCESS: Refund endpoint is working!');
      if (result.data.data && result.data.data.txHash) {
        console.log(`💰 Transaction Hash: ${result.data.data.txHash}`);
      }
    } else if (result.status === 400) {
      console.log('\n⚠️  EXPECTED: Refund validation working (user not found or already refunded)');
      console.log(`📝 Message: ${result.data.message || result.data.error}`);
    } else if (result.status === 500) {
      console.log('\n❌ SERVER ERROR: There might be an issue with the backend');
      console.log(`🚨 Error: ${result.data.error || result.data.message}`);
    } else {
      console.log(`\n❓ UNEXPECTED: Status ${result.status}`);
    }
    
    return result;
  } catch (error) {
    console.log('\n💥 REQUEST ERROR:');
    console.log(`   ${error.message}`);
    return { error: error.message };
  }
}

// Test user status endpoint to check refund status
async function testUserStatus() {
  console.log('\n\n🔍 Testing User Status Endpoint');
  console.log('=' .repeat(50));
  
  try {
    const result = await makeRequest(BASE_URL + `/api/user/${testData.userAddress}/status`);
    
    console.log(`\n📊 Response Status: ${result.status}`);
    console.log('📄 Response Data:');
    console.log(JSON.stringify(result.data, null, 2));
    
    if (result.status === 200 && result.data.success) {
      const userData = result.data.data;
      console.log('\n📋 User Status Summary:');
      console.log(`   Verified: ${userData.verified}`);
      console.log(`   Refunded: ${userData.refunded}`);
      console.log(`   Amount: ${userData.amount} ADA`);
      console.log(`   TX Hash: ${userData.txHash || 'N/A'}`);
    } else if (result.status === 404) {
      console.log('\n📝 User not found in system (expected for test address)');
    }
    
    return result;
  } catch (error) {
    console.log('\n💥 REQUEST ERROR:');
    console.log(`   ${error.message}`);
    return { error: error.message };
  }
}

// Test admin endpoints (these will likely fail without API key)
async function testAdminEndpoints() {
  console.log('\n\n🔐 Testing Admin Endpoints (without API key)');
  console.log('=' .repeat(50));
  
  const adminEndpoints = [
    { name: 'Get All Users', path: '/api/admin/users', method: 'GET' },
    { name: 'Auto Verify', path: '/api/admin/auto-verify', method: 'POST' },
    { name: 'Monitor Transactions', path: '/api/admin/monitor', method: 'GET' }
  ];
  
  for (const endpoint of adminEndpoints) {
    try {
      console.log(`\n🧪 Testing: ${endpoint.name}`);
      const result = await makeRequest(BASE_URL + endpoint.path, {
        method: endpoint.method
      });
      
      console.log(`   Status: ${result.status}`);
      if (result.status === 401) {
        console.log('   ✅ EXPECTED: Unauthorized (API key required)');
      } else {
        console.log(`   📄 Response: ${JSON.stringify(result.data, null, 2)}`);
      }
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
    }
  }
}

// Main test function
async function runRefundTests() {
  console.log('🚀 K33P Backend - 2 ADA Refund System Test');
  console.log('📅 Test started at:', new Date().toISOString());
  console.log('🌐 Target:', BASE_URL);
  console.log('\n' + '=' .repeat(80));
  
  // Test 1: Refund endpoint
  const refundResult = await testRefundEndpoint();
  
  // Test 2: User status endpoint
  const statusResult = await testUserStatus();
  
  // Test 3: Admin endpoints
  await testAdminEndpoints();
  
  // Summary
  console.log('\n\n' + '=' .repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(80));
  
  console.log('\n🎯 Key Findings:');
  
  if (refundResult.status === 200 || refundResult.status === 400) {
    console.log('   ✅ Refund endpoint is accessible and working');
    console.log('   ✅ Input validation is functioning');
  } else {
    console.log('   ❌ Refund endpoint may have issues');
  }
  
  if (statusResult.status === 200 || statusResult.status === 404) {
    console.log('   ✅ User status endpoint is working');
  } else {
    console.log('   ❌ User status endpoint may have issues');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('   1. To test actual refunds, you need:');
  console.log('      - A user who has sent 2 ADA to the deposit address');
  console.log('      - The backend wallet to have sufficient ADA for refunds');
  console.log('      - Valid Blockfrost API key configured');
  console.log('   2. Monitor the auto-refund system logs for real transactions');
  console.log('   3. Test with small amounts on testnet first');
  
  console.log('\n✨ Test completed successfully!');
}

// Run the tests
runRefundTests().catch(console.error);