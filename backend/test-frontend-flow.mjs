import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
const TEST_PHONE = '+123456789099';
const TEST_PIN = '123456';
const TEST_USER_ID = `test_user_${Date.now()}`;
const TEST_ADDRESS = 'addr_test1qpcgv0xqz5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pucj2p5l5p0v5z5k0a8pu';

let commitment = '';
let proof = '';

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`\n🔍 Testing: ${name}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    
    if (data.success) {
      console.log(`   ✅ ${data.message || 'Success'}`);
      return { success: true, data };
    } else {
      console.log(`   ❌ ${data.error?.message || data.message || 'Failed'}`);
      return { success: false, data };
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testCompleteFlow() {
  console.log('🚀 Testing Complete Frontend Flow\n');
  
  // 1. Health check
  await testEndpoint('Health Check', `${BASE_URL}/health`);
  
  // 2. ZK Commitment
  const commitmentResult = await testEndpoint('ZK Commitment', `${BASE_URL}/zk/commitment`, {
    method: 'POST',
    body: JSON.stringify({
      phone: TEST_PHONE,
      biometric: 'static_biometric_data_base64_encoded',
      passkey: TEST_PIN
    })
  });
  
  if (commitmentResult.success) {
    commitment = commitmentResult.data.commitment.replace(/-[^-]*$/, '');
  }
  
  // 3. ZK Proof
  const proofResult = await testEndpoint('ZK Proof', `${BASE_URL}/zk/proof`, {
    method: 'POST',
    body: JSON.stringify({
      phone: TEST_PHONE,
      biometric: 'static_biometric_data_base64_encoded',
      passkey: TEST_PIN,
      commitment: commitment
    })
  });
  
  if (proofResult.success) {
    proof = proofResult.data.proof;
  }
  
  // 4. User Signup
  await testEndpoint('User Signup', `${BASE_URL}/auth/signup`, {
    method: 'POST',
    body: JSON.stringify({
      userId: TEST_USER_ID,
      userAddress: TEST_ADDRESS,
      phoneNumber: TEST_PHONE,
      commitment: commitment
    })
  });
  
  // 5. ZK Login (if endpoint exists)
  await testEndpoint('ZK Login', `${BASE_URL}/zk/login`, {
    method: 'POST',
    body: JSON.stringify({
      phone: TEST_PHONE,
      proof: {
        proof: proof,
        publicInputs: {
          commitment: commitment
        },
        isValid: true
      },
      commitment: commitment
    })
  });
  
  // 6. Refund endpoint
  await testEndpoint('Refund', `${BASE_URL}/refund`, {
    method: 'POST',
    body: JSON.stringify({
      userAddress: TEST_ADDRESS,
      walletAddress: TEST_ADDRESS
    })
  });
  
  // 7. Cardano deposit address
  await testEndpoint('Deposit Address', `${BASE_URL}/cardano/deposit-address`, {
    method: 'POST',
    body: JSON.stringify({
      userId: TEST_USER_ID
    })
  });
  
  // 8. Get users
  await testEndpoint('Get Users', `${BASE_URL}/users`);
  
  console.log('\n🎉 Frontend flow test completed!');
}

testCompleteFlow();
