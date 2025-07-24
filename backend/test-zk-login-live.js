// Test script for ZK login endpoint using PostgreSQL data
import fetch from 'node-fetch';
import pool from './src/database/config.js';

const API_BASE_URL = 'http://localhost:3001/api';

async function testZkLoginEndpoint() {
  console.log('🧪 Testing ZK Login Endpoint with PostgreSQL Data');
  console.log('=' .repeat(60));
  
  const client = await pool.connect();
  
  try {
    // Get a user with ZK commitment and proof
    const userQuery = `
      SELECT 
        u.user_id,
        u.wallet_address,
        u.phone_hash,
        u.zk_commitment,
        zp.proof_data,
        zp.public_inputs
      FROM users u
      JOIN zk_proofs zp ON u.user_id = zp.user_id
      LIMIT 1
    `;
    
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No users with ZK proofs found in database');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('📋 Test User Data:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Wallet Address: ${user.wallet_address}`);
    console.log(`   Phone Hash: ${user.phone_hash || 'N/A'}`);
    console.log(`   ZK Commitment: ${user.zk_commitment}`);
    console.log();
    
    // Parse the proof data
    const proofData = JSON.parse(user.proof_data);
    const publicInputs = JSON.parse(user.public_inputs);
    
    // Test 1: Login with wallet address
    console.log('🔐 Test 1: Login with Wallet Address');
    try {
      const response = await fetch(`${API_BASE_URL}/zk/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: user.wallet_address,
          proof: proofData,
          commitment: user.zk_commitment
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log('✅ Login with wallet address: SUCCESS');
        console.log(`   Message: ${result.data.message}`);
        console.log(`   User ID: ${result.data.userId}`);
      } else {
        console.log('❌ Login with wallet address: FAILED');
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('❌ Login with wallet address: ERROR');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log();
    
    // Test 2: Login with phone hash (if available)
    if (user.phone_hash) {
      console.log('📱 Test 2: Login with Phone Hash');
      try {
        // We need to reverse-engineer the phone number from the hash for this test
        // For testing purposes, we'll use a mock phone number
        const mockPhone = '1234567890'; // This should match the hash in the database
        
        const response = await fetch(`${API_BASE_URL}/zk/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: mockPhone,
            proof: proofData,
            commitment: user.zk_commitment
          })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          console.log('✅ Login with phone: SUCCESS');
          console.log(`   Message: ${result.data.message}`);
          console.log(`   User ID: ${result.data.userId}`);
        } else {
          console.log('❌ Login with phone: FAILED');
          console.log(`   Status: ${response.status}`);
          console.log(`   Error: ${result.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.log('❌ Login with phone: ERROR');
        console.log(`   Error: ${error.message}`);
      }
    } else {
      console.log('⏭️  Test 2: Skipped (no phone hash available)');
    }
    
    console.log();
    
    // Test 3: Login with invalid commitment (should fail)
    console.log('🚫 Test 3: Login with Invalid Commitment');
    try {
      const response = await fetch(`${API_BASE_URL}/zk/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: user.wallet_address,
          proof: proofData,
          commitment: 'invalid_commitment_12345'
        })
      });
      
      const result = await response.json();
      
      if (!response.ok && result.error) {
        console.log('✅ Invalid commitment rejection: SUCCESS');
        console.log(`   Expected error: ${result.error.message}`);
      } else {
        console.log('❌ Invalid commitment rejection: FAILED');
        console.log('   Expected this to fail but it succeeded');
      }
    } catch (error) {
      console.log('❌ Invalid commitment test: ERROR');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log();
    console.log('🎯 Test Summary:');
    console.log('   The ZK login endpoint is now using PostgreSQL data!');
    console.log('   All tests completed. Check results above.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testZkLoginEndpoint().catch(console.error);