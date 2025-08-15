import pool from './dist/database/config.js';
import fetch from 'node-fetch';

// Deployed API URL
const DEPLOYED_API_URL = 'https://k33p-backend-0kyx.onrender.com/api';

async function testDeployedZkLoginCorrected() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing Deployed ZK Login Endpoint (Corrected)');
    console.log('=' .repeat(60));
    console.log(`🌐 API URL: ${DEPLOYED_API_URL}`);
    console.log();
    
    // Get a user with complete data from PostgreSQL
    const userQuery = `
      SELECT 
        u.user_id,
        u.wallet_address,
        u.phone_hash,
        u.phone_number,
        u.zk_commitment,
        zp.proof,
        zp.public_inputs,
        zp.commitment as proof_commitment
      FROM users u
      JOIN zk_proofs zp ON u.user_id = zp.user_id
      WHERE u.phone_number IS NOT NULL 
        AND u.zk_commitment IS NOT NULL
        AND zp.proof IS NOT NULL
      LIMIT 1
    `;
    
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No complete user data found in database');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('📋 Using Test User Data:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Wallet Address: ${user.wallet_address}`);
    console.log(`   Phone Number: ${user.phone_number}`);
    console.log(`   ZK Commitment: ${user.zk_commitment}`);
    console.log();
    
    // Parse the stored proof data
    const storedProofData = typeof user.proof === 'string' ? JSON.parse(user.proof) : user.proof;
    const baseCommitment = user.zk_commitment.split('-')[0]; // Remove suffix if present
    
    console.log('🔐 Stored Proof Data:');
    console.log(JSON.stringify(storedProofData, null, 2));
    console.log();
    
    // Create the correct proof format expected by verifyZkProof function
    const correctProofFormat = {
      publicInputs: {
        commitment: user.zk_commitment // Use full commitment with suffix
      },
      isValid: true,
      proof: storedProofData.proof || `zk-proof-${user.user_id}`,
      proofData: storedProofData
    };
    
    console.log('🔧 Corrected Proof Format:');
    console.log(JSON.stringify(correctProofFormat, null, 2));
    console.log();
    
    // Test 1: Login with wallet address using corrected format
    console.log('🔐 Test 1: ZK Login with Wallet Address (Corrected Format)');
    console.log('-'.repeat(60));
    
    const walletLoginPayload = {
      walletAddress: user.wallet_address,
      proof: correctProofFormat,
      commitment: baseCommitment // Use base commitment for verification
    };
    
    console.log('📤 Request Payload:');
    console.log(JSON.stringify(walletLoginPayload, null, 2));
    console.log();
    
    try {
      const walletResponse = await fetch(`${DEPLOYED_API_URL}/zk/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(walletLoginPayload)
      });
      
      const walletResult = await walletResponse.json();
      
      console.log(`📥 Response Status: ${walletResponse.status}`);
      console.log('📥 Response Body:');
      console.log(JSON.stringify(walletResult, null, 2));
      
      if (walletResponse.ok && walletResult.success) {
        console.log('✅ Wallet Address Login: SUCCESS');
        if (walletResult.data?.token) {
          console.log(`🎫 JWT Token received: ${walletResult.data.token.substring(0, 50)}...`);
        }
      } else {
        console.log('❌ Wallet Address Login: FAILED');
        console.log(`   Error: ${walletResult.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('❌ Wallet Address Login: ERROR');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log();
    
    // Test 2: Login with phone number using corrected format
    console.log('🔐 Test 2: ZK Login with Phone Number (Corrected Format)');
    console.log('-'.repeat(60));
    
    const phoneLoginPayload = {
      phone: user.phone_number,
      proof: correctProofFormat,
      commitment: baseCommitment // Use base commitment for verification
    };
    
    console.log('📤 Request Payload:');
    console.log(JSON.stringify(phoneLoginPayload, null, 2));
    console.log();
    
    try {
      const phoneResponse = await fetch(`${DEPLOYED_API_URL}/zk/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(phoneLoginPayload)
      });
      
      const phoneResult = await phoneResponse.json();
      
      console.log(`📥 Response Status: ${phoneResponse.status}`);
      console.log('📥 Response Body:');
      console.log(JSON.stringify(phoneResult, null, 2));
      
      if (phoneResponse.ok && phoneResult.success) {
        console.log('✅ Phone Number Login: SUCCESS');
        if (phoneResult.data?.token) {
          console.log(`🎫 JWT Token received: ${phoneResult.data.token.substring(0, 50)}...`);
        }
      } else {
        console.log('❌ Phone Number Login: FAILED');
        console.log(`   Error: ${phoneResult.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('❌ Phone Number Login: ERROR');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log();
    
    // Test 3: Test the ZK verification endpoint directly
    console.log('🔐 Test 3: Direct ZK Proof Verification');
    console.log('-'.repeat(60));
    
    const verifyPayload = {
      proof: correctProofFormat,
      commitment: baseCommitment
    };
    
    console.log('📤 Verify Payload:');
    console.log(JSON.stringify(verifyPayload, null, 2));
    console.log();
    
    try {
      const verifyResponse = await fetch(`${DEPLOYED_API_URL}/zk/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verifyPayload)
      });
      
      const verifyResult = await verifyResponse.json();
      
      console.log(`📥 Verify Status: ${verifyResponse.status}`);
      console.log('📥 Verify Response:');
      console.log(JSON.stringify(verifyResult, null, 2));
      
      if (verifyResponse.ok && verifyResult.success) {
        console.log('✅ ZK Proof Verification: SUCCESS');
        console.log(`   Is Valid: ${verifyResult.data?.isValid}`);
      } else {
        console.log('❌ ZK Proof Verification: FAILED');
        console.log(`   Error: ${verifyResult.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('❌ ZK Proof Verification: ERROR');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log();
    console.log('🏁 Test Complete');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testDeployedZkLoginCorrected();