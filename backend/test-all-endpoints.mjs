import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
const TEST_PHONE = '+1234567890';
const TEST_PIN = '123456';
const TEST_USER_ID = `test_user_${Date.now()}`;
const TEST_ADDRESS = 'addr_test1qpcgv0xqz5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pu';

// Test data
const testData = {
  phone: TEST_PHONE,
  biometric: 'static_biometric_data_base64_encoded',
  passkey: TEST_PIN,
  userId: TEST_USER_ID,
  userAddress: TEST_ADDRESS,
  walletAddress: TEST_ADDRESS
};

console.log('🧪 Testing K33P Backend API Endpoints\n');

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`\n🔍 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
    
    return { success: response.ok, data, status: response.status };
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('📋 Starting comprehensive API tests...\n');
  
  // 1. Health check
  await testEndpoint('Health Check', `${BASE_URL}/health`);
  
  // 2. ZK Commitment
  const commitmentResult = await testEndpoint('ZK Commitment', `${BASE_URL}/zk/commitment`, {
    method: 'POST',
    body: JSON.stringify({
      phone: testData.phone,
      biometric: testData.biometric,
      passkey: testData.passkey
    })
  });
  
  let commitment = null;
  if (commitmentResult.success && commitmentResult.data.commitment) {
    commitment = commitmentResult.data.commitment.replace(/-[^-]*$/, '');
    console.log(`   ✅ Extracted commitment: ${commitment.substring(0, 20)}...`);
  }
  
  // 3. ZK Proof (if commitment succeeded)
  if (commitment) {
    await testEndpoint('ZK Proof', `${BASE_URL}/zk/proof`, {
      method: 'POST',
      body: JSON.stringify({
        phone: testData.phone,
        biometric: testData.biometric,
        passkey: testData.passkey,
        commitment: commitment
      })
    });
  }
  
  // 4. User Signup
  await testEndpoint('User Signup', `${BASE_URL}/auth/signup`, {
    method: 'POST',
    body: JSON.stringify({
      userId: testData.userId,
      userAddress: testData.userAddress,
      phoneNumber: testData.phone,
      commitment: commitment || 'test_commitment'
    })
  });
  
  // 5. ZK Login (commented in your code, but let's test if available)
  await testEndpoint('ZK Login', `${BASE_URL}/zk/login`, {
    method: 'POST',
    body: JSON.stringify({
      phone: testData.phone,
      proof: {
        proof: 'test_proof',
        publicInputs: {
          commitment: commitment || 'test_commitment'
        },
        isValid: true
      },
      commitment: commitment || 'test_commitment'
    })
  });
  
  // 6. Refund endpoint
  await testEndpoint('Refund', `${BASE_URL}/refund`, {
    method: 'POST',
    body: JSON.stringify({
      userAddress: testData.userAddress,
      walletAddress: testData.walletAddress
    })
  });
  
  // 7. Cardano deposit address
  await testEndpoint('Deposit Address', `${BASE_URL}/cardano/deposit-address`, {
    method: 'POST',
    body: JSON.stringify({
      userId: testData.userId
    })
  });
  
  // 8. Get users (if available)
  await testEndpoint('Get Users', `${BASE_URL}/users`);
  
  // 9. Auth status
  await testEndpoint('Auth Status', `${BASE_URL}/auth/status`);
  
  console.log('\n✅ All tests completed!');
}

runAllTests();
