// Test script for ZK login endpoint on deployed Render API with real PostgreSQL data
import fetch from 'node-fetch';
import pool from './dist/database/config.js';
import { poseidonHash } from './dist/utils/zk.js';

const RENDER_BASE_URL = 'https://k33p-backend-0kyx.onrender.com';

async function testRenderZkLoginWithRealData() {
  console.log('🧪 Testing Deployed Render ZK Login with Real PostgreSQL Data');
  console.log('🌐 Target URL:', RENDER_BASE_URL);
  console.log('=' .repeat(70));
  
  const client = await pool.connect();
  
  try {
    // Step 1: Check API health
    console.log('🏥 Step 1: Checking API health...');
    const healthResponse = await fetch(`${RENDER_BASE_URL}/health`);
    console.log(`   Health Status: ${healthResponse.status} ${healthResponse.statusText}`);
    
    if (!healthResponse.ok) {
      console.log('❌ API is not healthy, aborting tests');
      return;
    }
    
    const healthData = await healthResponse.json();
    console.log('   ✅ API is healthy:', healthData.message);
    console.log();
    
    // Step 2: Get real users from our local PostgreSQL database
    console.log('📋 Step 2: Fetching real users from local PostgreSQL...');
    const userQuery = `
      SELECT 
        u.user_id,
        u.wallet_address,
        u.phone_hash,
        u.zk_commitment,
        zp.proof_data,
        zp.public_inputs,
        zp.commitment as proof_commitment
      FROM users u
      LEFT JOIN zk_proofs zp ON u.user_id = zp.user_id
      WHERE u.wallet_address IS NOT NULL
      ORDER BY u.created_at DESC
      LIMIT 5
    `;
    
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No users found in local database');
      return;
    }
    
    console.log(`   ✅ Found ${userResult.rows.length} users in local database`);
    
    // Step 3: Test each user
    for (let i = 0; i < userResult.rows.length; i++) {
      const user = userResult.rows[i];
      console.log(`\n🔐 Testing User ${i + 1}:`);
      console.log(`   User ID: ${user.user_id}`);
      console.log(`   Wallet Address: ${user.wallet_address}`);
      console.log(`   Phone Hash: ${user.phone_hash || 'N/A'}`);
      console.log(`   ZK Commitment: ${user.zk_commitment || 'N/A'}`);
      console.log(`   Has Proof: ${user.proof_data ? 'Yes' : 'No'}`);
      
      await testUserLogin(user);
    }
    
    // Step 4: Test with a completely new user signup
    console.log('\n🆕 Step 4: Testing with fresh user signup...');
    await testFreshUserSignupAndLogin();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

async function testUserLogin(user) {
  try {
    // Parse proof data if available
    let proofData = null;
    let commitment = user.zk_commitment;
    
    if (user.proof_data) {
      try {
        proofData = typeof user.proof_data === 'string' ? JSON.parse(user.proof_data) : user.proof_data;
        
        // If no commitment in user record, try to extract from proof
        if (!commitment && proofData.publicInputs && proofData.publicInputs.commitment) {
          commitment = proofData.publicInputs.commitment;
          console.log(`   📝 Using commitment from proof: ${commitment}`);
        }
      } catch (error) {
        console.log('   ⚠️ Could not parse proof data');
      }
    }
    
    if (!commitment) {
      console.log('   ❌ No ZK commitment available for this user, skipping...');
      return;
    }
    
    // Test 1: Login with wallet address
    console.log('\n   🧪 Test 1: ZK Login with wallet address...');
    
    const loginPayload = {
      walletAddress: user.wallet_address,
      proof: proofData || {
        publicInputs: { commitment },
        isValid: true,
        proofData: 'test_proof'
      },
      commitment: commitment
    };
    
    console.log('   📤 Sending login request...');
    console.log('   📋 Payload:', JSON.stringify(loginPayload, null, 4));
    
    const response = await fetch(`${RENDER_BASE_URL}/api/zk/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginPayload)
    });
    
    console.log(`   📥 Response Status: ${response.status} ${response.statusText}`);
    
    const responseData = await response.json();
    console.log('   📥 Response Data:', JSON.stringify(responseData, null, 4));
    
    if (response.ok && responseData.success) {
      console.log('   ✅ ZK Login successful!');
      if (responseData.data && responseData.data.token) {
        console.log(`   🔑 Token received: ${responseData.data.token.substring(0, 50)}...`);
        
        // Test authenticated request
        await testAuthenticatedRequest(responseData.data.token);
      }
    } else {
      console.log('   ❌ ZK Login failed');
      if (responseData.error) {
        console.log(`   📋 Error Code: ${responseData.error.code}`);
        console.log(`   📋 Error Message: ${responseData.error.message}`);
        if (responseData.error.details) {
          console.log(`   📋 Error Details: ${responseData.error.details}`);
        }
        
        // Analyze the error
        if (responseData.error.code === 'NOT_FOUND') {
          console.log('   🔍 Analysis: User not found in deployed database');
          console.log('   💡 This suggests the deployed database is different from local');
        } else if (responseData.error.code === 'UNAUTHORIZED') {
          console.log('   🔍 Analysis: User found but commitment/proof mismatch');
        } else if (responseData.error.code === 'ZK_VERIFICATION_FAILED') {
          console.log('   🔍 Analysis: ZK proof verification failed');
        }
      }
    }
    
  } catch (error) {
    console.log('   ❌ Login test failed:', error.message);
  }
}

async function testAuthenticatedRequest(token) {
  try {
    console.log('\n   🔐 Testing authenticated request...');
    
    const response = await fetch(`${RENDER_BASE_URL}/api/user/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   📥 Auth Test Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log('   ✅ Authenticated request successful!');
      console.log('   📋 Profile data:', JSON.stringify(responseData, null, 4));
    } else {
      const errorData = await response.json();
      console.log('   ❌ Authenticated request failed');
      console.log('   📋 Error:', JSON.stringify(errorData, null, 4));
    }
    
  } catch (error) {
    console.log('   ❌ Authenticated request test failed:', error.message);
  }
}

async function testFreshUserSignupAndLogin() {
  try {
    console.log('\n🆕 Testing fresh user signup and login flow...');
    
    // Generate test data
    const timestamp = Date.now();
    const testPhone = `+1555${timestamp.toString().slice(-8)}`;
    const testWallet = `addr_test1${timestamp.toString().slice(-10)}abcdef123456789`;
    const testEmail = `test${timestamp}@example.com`;
    
    console.log('📋 Test user data:');
    console.log(`   Phone: ${testPhone}`);
    console.log(`   Wallet: ${testWallet}`);
    console.log(`   Email: ${testEmail}`);
    
    // Step 1: Signup
    console.log('\n📝 Step 1: User signup...');
    const signupPayload = {
      userAddress: testWallet,
      walletAddress: testWallet,
      phoneNumber: testPhone,
      email: testEmail
    };
    
    const signupResponse = await fetch(`${RENDER_BASE_URL}/api/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signupPayload)
    });
    
    console.log(`📥 Signup Status: ${signupResponse.status} ${signupResponse.statusText}`);
    const signupData = await signupResponse.json();
    console.log('📥 Signup Response:', JSON.stringify(signupData, null, 2));
    
    if (!signupResponse.ok) {
      console.log('❌ Signup failed, cannot test login');
      return;
    }
    
    console.log('✅ Signup successful!');
    
    // Step 2: Generate ZK commitment
    console.log('\n🔐 Step 2: Generating ZK commitment...');
    const zkPayload = {
      phone: testPhone,
      biometric: `biometric_${timestamp}`,
      passkey: `passkey_${timestamp}`
    };
    
    const commitmentResponse = await fetch(`${RENDER_BASE_URL}/api/zk/commitment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(zkPayload)
    });
    
    console.log(`📥 Commitment Status: ${commitmentResponse.status} ${commitmentResponse.statusText}`);
    const commitmentData = await commitmentResponse.json();
    console.log('📥 Commitment Response:', JSON.stringify(commitmentData, null, 2));
    
    if (!commitmentResponse.ok) {
      console.log('❌ ZK commitment generation failed');
      return;
    }
    
    const commitment = commitmentData.data.commitment;
    console.log('✅ ZK commitment generated:', commitment);
    
    // Step 3: Generate ZK proof
    console.log('\n🔐 Step 3: Generating ZK proof...');
    const proofPayload = {
      ...zkPayload,
      commitment: commitment
    };
    
    const proofResponse = await fetch(`${RENDER_BASE_URL}/api/zk/proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(proofPayload)
    });
    
    console.log(`📥 Proof Status: ${proofResponse.status} ${proofResponse.statusText}`);
    const proofData = await proofResponse.json();
    console.log('📥 Proof Response:', JSON.stringify(proofData, null, 2));
    
    if (!proofResponse.ok) {
      console.log('❌ ZK proof generation failed');
      return;
    }
    
    console.log('✅ ZK proof generated successfully!');
    
    // Step 4: Test ZK login
    console.log('\n🔐 Step 4: Testing ZK login with fresh user...');
    const loginPayload = {
      walletAddress: testWallet,
      proof: proofData.data.proof,
      commitment: commitment
    };
    
    const loginResponse = await fetch(`${RENDER_BASE_URL}/api/zk/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginPayload)
    });
    
    console.log(`📥 Login Status: ${loginResponse.status} ${loginResponse.statusText}`);
    const loginData = await loginResponse.json();
    console.log('📥 Login Response:', JSON.stringify(loginData, null, 2));
    
    if (loginResponse.ok && loginData.success) {
      console.log('✅ Fresh user ZK login successful!');
      if (loginData.data && loginData.data.token) {
        console.log(`🔑 Token: ${loginData.data.token.substring(0, 50)}...`);
      }
    } else {
      console.log('❌ Fresh user ZK login failed');
      if (loginData.error) {
        console.log(`📋 Error: ${loginData.error.message}`);
        console.log(`📋 Code: ${loginData.error.code}`);
      }
    }
    
  } catch (error) {
    console.log('❌ Fresh user test failed:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Comprehensive Render ZK Login Test');
  console.log('🎯 This test will:');
  console.log('   1. Check API health');
  console.log('   2. Test with existing users from local PostgreSQL');
  console.log('   3. Test complete signup + login flow with new user');
  console.log('   4. Identify any issues and provide solutions');
  console.log();
  
  await testRenderZkLoginWithRealData();
  
  console.log('\n' + '='.repeat(70));
  console.log('🎯 Test Summary');
  console.log('✅ Comprehensive ZK Login test completed');
  console.log('📋 Check the results above for detailed analysis');
  console.log('💡 If users are not found, the deployed database may be empty');
  console.log('💡 The fresh user test should work if the API is functioning correctly');
}

// Run the test
main().catch(console.error);