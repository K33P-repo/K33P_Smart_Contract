import fetch from 'node-fetch';

const RENDER_API_BASE = 'https://k33p-backend-0kyx.onrender.com';

// Test complete ZK flow on deployed API
async function testDeployedZkFlow() {
  console.log('🚀 Testing Complete ZK Flow on Deployed API');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Test API health
    console.log('\n🏥 Step 1: Testing API Health...');
    const healthResponse = await fetch(`${RENDER_API_BASE}/api/health`);
    console.log(`Health Status: ${healthResponse.status}`);
    
    if (healthResponse.status === 200) {
      const healthData = await healthResponse.json();
      console.log('✅ API is healthy:', healthData);
    } else {
      console.log('⚠️ Health endpoint returned:', healthResponse.status);
    }
    
    // Step 2: Generate ZK commitment
    console.log('\n🔐 Step 2: Generating ZK Commitment...');
    const commitmentPayload = {
      phone: '+1234567890',
      biometric: 'mock-biometric-data-12345',
      passkey: 'mock-passkey-data-67890'
    };
    
    const commitmentResponse = await fetch(`${RENDER_API_BASE}/api/zk/commitment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commitmentPayload)
    });
    
    console.log(`Commitment Status: ${commitmentResponse.status}`);
    
    if (commitmentResponse.status !== 200) {
      const errorText = await commitmentResponse.text();
      console.log('❌ Commitment generation failed:', errorText);
      return;
    }
    
    const commitmentData = await commitmentResponse.json();
    console.log('✅ ZK Commitment generated successfully!');
    console.log(`   Commitment: ${commitmentData.data.commitment}`);
    console.log(`   Phone Hash: ${commitmentData.data.hashes.phoneHash}`);
    
    const { commitment } = commitmentData.data;
    const { phoneHash, biometricHash, passkeyHash } = commitmentData.data.hashes;
    
    // Step 3: Generate ZK proof
    console.log('\n🔐 Step 3: Generating ZK Proof...');
    const proofPayload = {
      phone: '+1234567890',
      biometric: 'mock-biometric-data-12345',
      passkey: 'mock-passkey-data-67890',
      commitment: commitment
    };
    
    const proofResponse = await fetch(`${RENDER_API_BASE}/api/zk/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proofPayload)
    });
    
    console.log(`Proof Status: ${proofResponse.status}`);
    
    if (proofResponse.status !== 200) {
      const errorText = await proofResponse.text();
      console.log('❌ Proof generation failed:', errorText);
      return;
    }
    
    const proofData = await proofResponse.json();
    console.log('✅ ZK Proof generated successfully!');
    console.log(`   Proof: ${proofData.data.proof}`);
    console.log(`   Is Valid: ${proofData.data.isValid}`);
    
    const { proof } = proofData.data;
    
    // Step 4: Try to create a user via signup (if available)
    console.log('\n👤 Step 4: Attempting User Signup...');
    const signupPayload = {
      phoneNumber: '+1234567890',
      walletAddress: '0x1234567890123456789012345678901234567890',
      zkCommitment: commitment,
      phoneHash: phoneHash,
      biometricHash: biometricHash,
      passkeyHash: passkeyHash
    };
    
    // Try different signup endpoints
    const signupEndpoints = [
      '/api/auth/signup',
      '/api/auth/signup/phone',
      '/api/signup'
    ];
    
    let signupSuccess = false;
    for (const endpoint of signupEndpoints) {
      console.log(`   Trying signup endpoint: ${endpoint}`);
      const signupResponse = await fetch(`${RENDER_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupPayload)
      });
      
      console.log(`   Status: ${signupResponse.status}`);
      
      if (signupResponse.status === 200 || signupResponse.status === 201) {
        const signupData = await signupResponse.json();
        console.log('✅ User signup successful!');
        console.log(`   Response:`, signupData);
        signupSuccess = true;
        break;
      } else {
        const errorText = await signupResponse.text();
        console.log(`   ❌ Failed: ${errorText}`);
      }
    }
    
    if (!signupSuccess) {
      console.log('⚠️ User signup failed on all endpoints, proceeding with ZK login test anyway...');
    }
    
    // Step 5: Test ZK Login with wallet address
    console.log('\n🔐 Step 5: Testing ZK Login with Wallet Address...');
    const loginPayload1 = {
      walletAddress: '0x1234567890123456789012345678901234567890',
      proof: proofData.data,
      commitment: commitment
    };
    
    const loginResponse1 = await fetch(`${RENDER_API_BASE}/api/zk/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload1)
    });
    
    console.log(`Login Status (wallet): ${loginResponse1.status}`);
    const loginData1 = await loginResponse1.json();
    console.log('Login Response (wallet):', loginData1);
    
    if (loginResponse1.status === 200) {
      console.log('✅ ZK Login with wallet address successful!');
      if (loginData1.token) {
        console.log(`   JWT Token received: ${loginData1.token.substring(0, 50)}...`);
      }
    } else {
      console.log('❌ ZK Login with wallet address failed');
    }
    
    // Step 6: Test ZK Login with phone
    console.log('\n🔐 Step 6: Testing ZK Login with Phone...');
    const loginPayload2 = {
      phone: '+1234567890',
      proof: proofData.data,
      commitment: commitment
    };
    
    const loginResponse2 = await fetch(`${RENDER_API_BASE}/api/zk/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload2)
    });
    
    console.log(`Login Status (phone): ${loginResponse2.status}`);
    const loginData2 = await loginResponse2.json();
    console.log('Login Response (phone):', loginData2);
    
    if (loginResponse2.status === 200) {
      console.log('✅ ZK Login with phone hash successful!');
      if (loginData2.token) {
        console.log(`   JWT Token received: ${loginData2.token.substring(0, 50)}...`);
      }
    } else {
      console.log('❌ ZK Login with phone hash failed');
    }
    
    // Step 7: Test ZK verification endpoint
    console.log('\n🔐 Step 7: Testing ZK Verification...');
    const verifyPayload = {
      proof: proof,
      commitment: commitment,
      phone: '+1234567890',
      biometric: 'mock-biometric-data-12345',
      passkey: 'mock-passkey-data-67890'
    };
    
    const verifyResponse = await fetch(`${RENDER_API_BASE}/api/zk/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyPayload)
    });
    
    console.log(`Verify Status: ${verifyResponse.status}`);
    
    if (verifyResponse.status === 200) {
      const verifyData = await verifyResponse.json();
      console.log('✅ ZK Verification successful!');
      console.log('   Verification result:', verifyData);
    } else {
      const errorText = await verifyResponse.text();
      console.log('❌ ZK Verification failed:', errorText);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎯 Test Summary');
    console.log('\n📊 Results:');
    console.log(`   ✅ ZK Commitment: Generated successfully`);
    console.log(`   ✅ ZK Proof: Generated successfully`);
    console.log(`   ${signupSuccess ? '✅' : '❌'} User Signup: ${signupSuccess ? 'Successful' : 'Failed'}`);
    console.log(`   ${loginResponse1.status === 200 ? '✅' : '❌'} ZK Login (wallet): ${loginResponse1.status === 200 ? 'Successful' : 'Failed'}`);
    console.log(`   ${loginResponse2.status === 200 ? '✅' : '❌'} ZK Login (phone): ${loginResponse2.status === 200 ? 'Successful' : 'Failed'}`);
    
    console.log('\n🔍 Analysis:');
    if (loginResponse1.status === 200 || loginResponse2.status === 200) {
      console.log('   ✅ ZK Login endpoint is working correctly!');
      console.log('   ✅ The deployed API can handle ZK authentication');
    } else {
      console.log('   ❌ ZK Login endpoint has issues');
      console.log('   🔍 Possible causes:');
      console.log('     - User not found in deployed database');
      console.log('     - Database connection issues');
      console.log('     - ZK proof verification logic problems');
      console.log('     - Commitment matching issues');
    }
    
    console.log('\n💡 Next Steps:');
    if (loginResponse1.status !== 200 && loginResponse2.status !== 200) {
      console.log('   1. Check deployed database connectivity');
      console.log('   2. Verify user creation process on deployed API');
      console.log('   3. Debug ZK login endpoint logic');
      console.log('   4. Ensure commitment matching works correctly');
    } else {
      console.log('   ✅ ZK Login is working! Ready for production use.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDeployedZkFlow();