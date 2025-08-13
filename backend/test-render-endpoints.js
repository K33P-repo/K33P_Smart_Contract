// Test script to discover available endpoints on deployed Render API
import fetch from 'node-fetch';

const RENDER_BASE_URL = 'https://k33p-backend-0kyx.onrender.com';

async function testEndpoints() {
  console.log('🔍 Testing Available Endpoints on Render API');
  console.log('🌐 Target URL:', RENDER_BASE_URL);
  console.log('=' .repeat(60));
  
  const endpoints = [
    '/',
    '/health',
    '/api/health',
    '/status',
    '/api/status',
    '/api',
    '/api/signup',
    '/api/zk/login',
    '/api/zk/commitment',
    '/api/zk/proof',
    '/api/user/profile'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Testing: ${endpoint}`);
      
      const response = await fetch(`${RENDER_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        try {
          const data = await response.json();
          console.log('   ✅ Response:', JSON.stringify(data, null, 2));
        } catch (error) {
          const text = await response.text();
          console.log('   ✅ Response (text):', text.substring(0, 200));
        }
      } else {
        try {
          const errorData = await response.json();
          console.log('   ❌ Error:', JSON.stringify(errorData, null, 2));
        } catch (error) {
          const errorText = await response.text();
          console.log('   ❌ Error (text):', errorText.substring(0, 200));
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
  
  // Test POST endpoints with minimal data
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Testing POST Endpoints');
  
  const postTests = [
    {
      endpoint: '/api/signup',
      payload: {
        userAddress: 'test_addr',
        walletAddress: 'test_wallet',
        phoneNumber: '+1234567890',
        email: 'test@example.com'
      }
    },
    {
      endpoint: '/api/zk/commitment',
      payload: {
        phone: '+1234567890',
        biometric: 'test_bio',
        passkey: 'test_passkey'
      }
    },
    {
      endpoint: '/api/zk/login',
      payload: {
        walletAddress: 'test_wallet',
        proof: { test: 'data' },
        commitment: 'test_commitment'
      }
    }
  ];
  
  for (const test of postTests) {
    try {
      console.log(`\n🧪 Testing POST: ${test.endpoint}`);
      
      const response = await fetch(`${RENDER_BASE_URL}${test.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.payload)
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      try {
        const data = await response.json();
        console.log('   Response:', JSON.stringify(data, null, 2));
      } catch (error) {
        const text = await response.text();
        console.log('   Response (text):', text.substring(0, 200));
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 Endpoint Discovery Complete');
}

// Run the test
testEndpoints().catch(console.error);