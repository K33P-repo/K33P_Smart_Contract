import pool from './dist/database/config.js';
import fetch from 'node-fetch';

// Deployed API URL
const DEPLOYED_API_URL = 'https://k33p-backend-0kyx.onrender.com/api';

async function testDeployedZkLoginSuccess() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing Deployed ZK Login Endpoint (Success Attempt)');
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
        u.zk_commitment as user_commitment,
        zp.proof,
        zp.public_inputs,
        zp.commitment as proof_commitment
      FROM users u
      JOIN zk_proofs zp ON u.user_id = zp.user_id
      WHERE u.phone_number = '0666866559900'
      LIMIT 1
    `;
    
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No user data found in database');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('📋 Using Test User Data:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Wallet Address: ${user.wallet_address}`);
    console.log(`   Phone Number: ${user.phone_number}`);
    console.log(`   User Commitment: ${user.user_commitment}`);
    console.log(`   Proof Commitment: ${user.proof_commitment}`);
    console.log();
    
    // Parse the stored proof data
    const storedProofData = typeof user.proof === 'string' ? JSON.parse(user.proof) : user.proof;
    
    console.log('🔐 Stored Proof Data:');
    console.log(JSON.stringify(storedProofData, null, 2));
    console.log();
    
    // Key insight: The user's commitment in the users table might be different from the proof commitment
    // Let's try using the user's stored commitment (which should match what the backend expects)
    const userCommitment = user.user_commitment;
    
    // Remove any suffix from the user commitment to get the base commitment
    const baseCommitment = userCommitment.split('-')[0]; // Remove the suffix part
    
    console.log('🔍 Commitment Analysis:');
    console.log(`   Full User Commitment: ${userCommitment}`);
    console.log(`   Base Commitment: ${baseCommitment}`);
    console.log(`   Proof Commitment: ${user.proof_commitment}`);
    console.log();
    
    // Create proof format that matches the user's commitment
    const correctProofFormat = {
      publicInputs: {
        commitment: userCommitment // Use the exact user commitment
      },
      isValid: true,
      proof: storedProofData.proof || `zk-proof-${user.user_id}`,
      proofData: storedProofData
    };
    
    console.log('🔧 Proof Format for Login:');
    console.log(JSON.stringify(correctProofFormat, null, 2));
    console.log();
    
    // Test 1: ZK Login with Wallet Address using user's commitment
    console.log('🔐 Test 1: ZK Login with Wallet Address');
    console.log('-'.repeat(60));
    
    const walletLoginPayload = {
      walletAddress: user.wallet_address,
      proof: correctProofFormat,
      commitment: userCommitment // Use the user's stored commitment
    };
    
    console.log('📤 Wallet Login Payload:');
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
      
      console.log(`📥 Wallet Login Status: ${walletResponse.status}`);
      console.log('📥 Wallet Login Response:');
      console.log(JSON.stringify(walletResult, null, 2));
      
      if (walletResponse.ok && walletResult.success) {
        console.log('✅ Wallet Address Login: SUCCESS');
        if (walletResult.data?.token) {
          console.log(`🎫 JWT Token received: ${walletResult.data.token.substring(0, 50)}...`);
        }
      } else {
        console.log('❌ Wallet Address Login: FAILED');
        console.log(`   Error: ${walletResult.error?.message || 'Unknown error'}`);
        
        // If it failed, let's try with base commitment
        console.log();
        console.log('🔄 Retrying with base commitment...');
        
        const baseProofFormat = {
          publicInputs: {
            commitment: baseCommitment // Use base commitment without suffix
          },
          isValid: true,
          proof: storedProofData.proof || `zk-proof-${user.user_id}`,
          proofData: storedProofData
        };
        
        const retryPayload = {
          walletAddress: user.wallet_address,
          proof: baseProofFormat,
          commitment: baseCommitment
        };
        
        const retryResponse = await fetch(`${DEPLOYED_API_URL}/zk/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(retryPayload)
        });
        
        const retryResult = await retryResponse.json();
        
        console.log(`📥 Retry Status: ${retryResponse.status}`);
        console.log('📥 Retry Response:');
        console.log(JSON.stringify(retryResult, null, 2));
        
        if (retryResponse.ok && retryResult.success) {
          console.log('✅ Wallet Address Login (Retry): SUCCESS');
          if (retryResult.data?.token) {
            console.log(`🎫 JWT Token received: ${retryResult.data.token.substring(0, 50)}...`);
          }
        } else {
          console.log('❌ Wallet Address Login (Retry): FAILED');
        }
      }
    } catch (error) {
      console.log('❌ Wallet Login Error:', error.message);
    }
    
    console.log();
    console.log('🔐 Test 2: ZK Login with Phone Number');
    console.log('-'.repeat(60));
    
    const phoneLoginPayload = {
      phone: user.phone_number,
      proof: correctProofFormat,
      commitment: userCommitment
    };
    
    console.log('📤 Phone Login Payload:');
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
      
      console.log(`📥 Phone Login Status: ${phoneResponse.status}`);
      console.log('📥 Phone Login Response:');
      console.log(JSON.stringify(phoneResult, null, 2));
      
      if (phoneResponse.ok && phoneResult.success) {
        console.log('✅ Phone Number Login: SUCCESS');
        if (phoneResult.data?.token) {
          console.log(`🎫 JWT Token received: ${phoneResult.data.token.substring(0, 50)}...`);
        }
      } else {
        console.log('❌ Phone Number Login: FAILED');
        console.log(`   Error: ${phoneResult.error?.message || 'Unknown error'}`);
        
        // Try with base commitment
        console.log();
        console.log('🔄 Retrying phone login with base commitment...');
        
        const baseProofFormat = {
          publicInputs: {
            commitment: baseCommitment
          },
          isValid: true,
          proof: storedProofData.proof || `zk-proof-${user.user_id}`,
          proofData: storedProofData
        };
        
        const phoneRetryPayload = {
          phone: user.phone_number,
          proof: baseProofFormat,
          commitment: baseCommitment
        };
        
        const phoneRetryResponse = await fetch(`${DEPLOYED_API_URL}/zk/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(phoneRetryPayload)
        });
        
        const phoneRetryResult = await phoneRetryResponse.json();
        
        console.log(`📥 Phone Retry Status: ${phoneRetryResponse.status}`);
        console.log('📥 Phone Retry Response:');
        console.log(JSON.stringify(phoneRetryResult, null, 2));
        
        if (phoneRetryResponse.ok && phoneRetryResult.success) {
          console.log('✅ Phone Number Login (Retry): SUCCESS');
          if (phoneRetryResult.data?.token) {
            console.log(`🎫 JWT Token received: ${phoneRetryResult.data.token.substring(0, 50)}...`);
          }
        } else {
          console.log('❌ Phone Number Login (Retry): FAILED');
        }
      }
    } catch (error) {
      console.log('❌ Phone Login Error:', error.message);
    }
    
    console.log();
    console.log('🏁 Test Complete');
    console.log('=' .repeat(60));
    
    // Summary
    console.log();
    console.log('📋 Test Summary:');
    console.log(`   📊 User: ${user.user_id}`);
    console.log(`   📱 Phone: ${user.phone_number}`);
    console.log(`   💳 Wallet: ${user.wallet_address}`);
    console.log(`   🔐 User Commitment: ${userCommitment}`);
    console.log(`   🔐 Base Commitment: ${baseCommitment}`);
    console.log(`   🌐 API: ${DEPLOYED_API_URL}`);
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testDeployedZkLoginSuccess();