// Test script for the new verify-deposit endpoint
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Test data
const testUser = {
  phoneNumber: '+1234567890',
  userId: 'test-deposit-user',
  userAddress: 'addr_test1234567890'
};

const testWallet = 'addr_test1qznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735734';

async function testVerifyDepositFlow() {
  console.log('=== Testing Verify Deposit Flow ===\n');
  
  try {
    // Step 1: Sign up a test user
    console.log('Step 1: Creating test user...');
    const signupResponse = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });
    
    if (!signupResponse.ok) {
      const errorData = await signupResponse.json();
      console.log('Signup failed (expected if user exists):', errorData.error);
      
      // Try to login instead
      console.log('Attempting to login with existing user...');
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: testUser.phoneNumber,
          proof: 'mock-proof',
          commitment: 'mock-commitment'
        })
      });
      
      if (!loginResponse.ok) {
        console.log('Login also failed. Please check user creation.');
        return;
      }
      
      const loginData = await loginResponse.json();
      console.log('Login successful!');
      
      // Step 2: Test verify-deposit endpoint
      console.log('\nStep 2: Testing verify-deposit endpoint...');
      const verifyResponse = await fetch(`${BASE_URL}/api/auth/verify-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginData.token}`
        },
        body: JSON.stringify({
          senderWalletAddress: testWallet
        })
      });
      
      const verifyData = await verifyResponse.json();
      console.log('Verify deposit response:', JSON.stringify(verifyData, null, 2));
      
      if (verifyResponse.ok) {
        console.log('✅ Verify deposit endpoint is working!');
      } else {
        console.log('❌ Verify deposit failed (expected if no actual deposit found):', verifyData.error);
      }
      
      return;
    }
    
    const signupData = await signupResponse.json();
    console.log('Signup successful!');
    
    // Step 2: Test verify-deposit endpoint
    console.log('\nStep 2: Testing verify-deposit endpoint...');
    const verifyResponse = await fetch(`${BASE_URL}/api/auth/verify-deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${signupData.token}`
      },
      body: JSON.stringify({
        senderWalletAddress: testWallet
      })
    });
    
    const verifyData = await verifyResponse.json();
    console.log('Verify deposit response:', JSON.stringify(verifyData, null, 2));
    
    if (verifyResponse.ok) {
      console.log('✅ Verify deposit endpoint is working!');
    } else {
      console.log('❌ Verify deposit failed (expected if no actual deposit found):', verifyData.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test endpoint availability
async function testEndpointAvailability() {
  console.log('=== Testing Endpoint Availability ===\n');
  
  try {
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
    if (healthResponse.ok) {
      console.log('✅ Server is running and healthy!');
      console.log('\n📍 New endpoint available: POST /api/auth/verify-deposit');
      console.log('📍 This endpoint handles the 2 ADA deposit verification and refund flow');
      console.log('📍 Required: Authorization header with JWT token');
      console.log('📍 Required body: { "senderWalletAddress": "addr_test..." }');
    }
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

// Run tests
async function runTests() {
  await testEndpointAvailability();
  console.log('\n' + '='.repeat(50) + '\n');
  await testVerifyDepositFlow();
}

runTests();