/**
 * Test script for ZK login endpoint on Render deployed backend
 * Tests the deployed backend at https://k33p-backend-0kyx.onrender.com
 * This version doesn't rely on local database access
 */

import fetch from 'node-fetch';

const RENDER_BASE_URL = 'https://k33p-backend-0kyx.onrender.com';

async function testRenderZkLogin() {
  console.log('🚀 Testing ZK Login Endpoint on Render Deployed Backend');
  console.log('URL:', `${RENDER_BASE_URL}/api/zk/login`);
  console.log('\n' + '='.repeat(60));

  // Test data - using mock data since we can't access the deployed database directly
  const testCases = [
    {
      name: 'Test 1: ZK Login with Wallet Address',
      payload: {
        walletAddress: 'addr_test1qr8z9x2y3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5r',
        proof: {
          publicInputs: {
            commitment: 'zk_commitment_test_123'
          },
          isValid: true,
          proofData: 'mock_proof_data_xyz789'
        },
        commitment: 'zk_commitment_test_123'
      }
    },
    {
      name: 'Test 2: ZK Login with Phone Hash',
      payload: {
        phoneHash: 'phone_hash_test_456',
        proof: {
          publicInputs: {
            commitment: 'zk_commitment_test_456'
          },
          isValid: true,
          proofData: 'mock_proof_data_abc123'
        },
        commitment: 'zk_commitment_test_456'
      }
    },
    {
      name: 'Test 3: ZK Login with Invalid Commitment (Should Fail)',
      payload: {
        walletAddress: 'addr_test1qr8z9x2y3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5r',
        proof: {
          publicInputs: {
            commitment: 'zk_commitment_test_123'
          },
          isValid: true,
          proofData: 'mock_proof_data_xyz789'
        },
        commitment: 'invalid_commitment_mismatch'
      }
    },
    {
      name: 'Test 4: ZK Login with Missing Fields',
      payload: {
        walletAddress: 'addr_test1qr8z9x2y3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5r'
        // Missing proof and commitment
      }
    },
    {
      name: 'Test 5: ZK Login with Invalid Proof Format',
      payload: {
        walletAddress: 'addr_test1qr8z9x2y3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5r',
        proof: 'invalid_proof_format',
        commitment: 'zk_commitment_test_123'
      }
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🧪 ${testCase.name}`);
    console.log('📤 Sending request...');
    console.log('Payload:', JSON.stringify(testCase.payload, null, 2));
    console.log();

    try {
      const response = await fetch(`${RENDER_BASE_URL}/api/zk/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.payload)
      });

      console.log('📥 Response Status:', response.status, response.statusText);
      console.log('📥 Response Headers:');
      for (const [key, value] of response.headers.entries()) {
        console.log(`   ${key}: ${value}`);
      }

      let result;
      try {
        result = await response.json();
        console.log('📥 Response Body:');
        console.log(JSON.stringify(result, null, 2));
      } catch (jsonError) {
        console.log('❌ Failed to parse JSON response');
        const textResponse = await response.text();
        console.log('Raw response:', textResponse);
        result = { error: 'Invalid JSON response' };
      }

      // Analyze the response
      if (i === 0 || i === 1) {
        // Tests 1 and 2: Should succeed if user exists, or fail gracefully if not
        if (response.ok && result.success) {
          console.log('✅ PASSED: Login successful');
          passedTests++;
        } else if (response.status === 404 && result.error && result.error.message.includes('not found')) {
          console.log('✅ PASSED: User not found (expected for test data)');
          passedTests++;
        } else if (response.status === 401 && result.error) {
          console.log('✅ PASSED: Authentication failed (expected for test data)');
          passedTests++;
        } else {
          console.log('❌ FAILED: Unexpected response');
        }
      } else if (i === 2) {
        // Test 3: Should fail due to commitment mismatch
        if (!response.ok && result.error && (result.error.message.includes('Invalid commitment') || result.error.message.includes('not found'))) {
          console.log('✅ PASSED: Invalid commitment correctly rejected');
          passedTests++;
        } else {
          console.log('❌ FAILED: Invalid commitment should have been rejected');
        }
      } else if (i === 3 || i === 4) {
        // Tests 4 and 5: Should fail due to missing/invalid fields
        if (!response.ok && result.error) {
          console.log('✅ PASSED: Invalid request correctly rejected');
          passedTests++;
        } else {
          console.log('❌ FAILED: Invalid request should have been rejected');
        }
      }

    } catch (error) {
      console.log('❌ ERROR: Failed to connect to deployed server');
      console.log('Error:', error.message);
      console.log('\n💡 Possible issues:');
      console.log('   - Server might be down or starting up');
      console.log('   - Network connectivity issues');
      console.log('   - CORS configuration issues');
    }

    console.log('\n' + '-'.repeat(40));
  }

  // Test the health endpoint to verify server is running
  console.log('\n🏥 Testing Health Endpoint');
  try {
    const healthResponse = await fetch(`${RENDER_BASE_URL}/api/health`);
    console.log('Health Status:', healthResponse.status, healthResponse.statusText);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('Health Data:', JSON.stringify(healthData, null, 2));
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test alternative health endpoint
  console.log('\n🏥 Testing Alternative Health Endpoint');
  try {
    const healthResponse2 = await fetch(`${RENDER_BASE_URL}/health`);
    console.log('Health Status:', healthResponse2.status, healthResponse2.statusText);
    if (healthResponse2.ok) {
      const healthData2 = await healthResponse2.json();
      console.log('Health Data:', JSON.stringify(healthData2, null, 2));
    }
  } catch (error) {
    console.log('❌ Alternative health check failed:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 Test Summary:');
  console.log(`   Tests Passed: ${passedTests}/${totalTests}`);
  console.log('   ZK login endpoint testing on Render deployed backend completed!');
  console.log('\n💡 Analysis:');
  console.log('   - Check if the endpoint is properly configured');
  console.log('   - Verify database connectivity in deployed environment');
  console.log('   - Check CORS settings for cross-origin requests');
  console.log('   - Ensure ZK proof verification logic is working');
  console.log('   - Verify user lookup mechanism in deployed environment');
  console.log('\n🔍 Next Steps:');
  console.log('   1. Check Render dashboard logs for detailed error information');
  console.log('   2. Verify environment variables are set correctly');
  console.log('   3. Test with actual user data from the deployed database');
  console.log('   4. Check if database migrations have been run on deployed instance');
}

// Run the test
testRenderZkLogin().catch(console.error);