import pool from './dist/database/config.js';
import fetch from 'node-fetch';

async function testZkLogin() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing ZK Login Endpoint...');
    
    // Get a user with ZK commitment and proof from the database
    const userQuery = await client.query(`
      SELECT u.user_id, u.wallet_address, u.phone_hash, u.zk_commitment 
      FROM users u 
      INNER JOIN zk_proofs zp ON u.user_id = zp.user_id 
      WHERE u.zk_commitment IS NOT NULL 
      LIMIT 1
    `);
    
    if (userQuery.rows.length === 0) {
      console.log('❌ No users with ZK commitments found in database');
      return;
    }
    
    const user = userQuery.rows[0];
    console.log('\n👤 Testing with user:');
    console.log(`  User ID: ${user.user_id}`);
    console.log(`  Wallet Address: ${user.wallet_address}`);
    console.log(`  Phone Hash: ${user.phone_hash || 'N/A'}`);
    console.log(`  ZK Commitment: ${user.zk_commitment}`);
    
    // Get the corresponding ZK proof from database
    const proofQuery = await client.query(
      'SELECT proof, public_inputs FROM zk_proofs WHERE user_id = $1 LIMIT 1',
      [user.user_id]
    );
    
    if (proofQuery.rows.length === 0) {
      console.log('❌ No ZK proof found for this user');
      return;
    }
    
    const zkProofData = proofQuery.rows[0];
    console.log('\n🔐 ZK Proof data found:');
    console.log(`  Proof: ${JSON.stringify(zkProofData.proof)}`);
    console.log(`  Public Inputs: ${JSON.stringify(zkProofData.public_inputs)}`);
    
    // Test 1: Login with wallet address
    console.log('\n🧪 Test 1: Login with wallet address');
    const loginPayload1 = {
      walletAddress: user.wallet_address,
      proof: zkProofData.proof,
      commitment: user.zk_commitment
    };
    
    console.log('📤 Sending login request...');
    console.log('Payload:', JSON.stringify(loginPayload1, null, 2));
    
    try {
      const response1 = await fetch('http://localhost:3001/api/zk/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginPayload1)
      });
      
      const result1 = await response1.json();
      console.log('\n📥 Response:');
      console.log(`Status: ${response1.status}`);
      console.log('Body:', JSON.stringify(result1, null, 2));
      
      if (response1.ok && result1.success) {
        console.log('✅ Test 1 PASSED: Login with wallet address successful');
      } else {
        console.log('❌ Test 1 FAILED: Login with wallet address failed');
      }
    } catch (error) {
      console.log('❌ Test 1 ERROR: Failed to connect to server');
      console.log('Error:', error.message);
      console.log('\n💡 Make sure the backend server is running on port 3001');
      console.log('Run: npm start or npm run dev in the backend directory');
    }
    
    // Test 2: Login with phone (if available)
    if (user.phone_hash) {
      console.log('\n🧪 Test 2: Login with phone hash');
      const loginPayload2 = {
        phone: '1234567890', // Sample phone number
        proof: zkProofData.proof,
        commitment: user.zk_commitment
      };
      
      console.log('📤 Sending login request with phone...');
      console.log('Payload:', JSON.stringify(loginPayload2, null, 2));
      
      try {
        const response2 = await fetch('http://localhost:3001/api/zk/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(loginPayload2)
        });
        
        const result2 = await response2.json();
        console.log('\n📥 Response:');
        console.log(`Status: ${response2.status}`);
        console.log('Body:', JSON.stringify(result2, null, 2));
        
        if (response2.ok && result2.success) {
          console.log('✅ Test 2 PASSED: Login with phone successful');
        } else {
          console.log('❌ Test 2 FAILED: Login with phone failed');
        }
      } catch (error) {
        console.log('❌ Test 2 ERROR: Failed to connect to server');
        console.log('Error:', error.message);
      }
    }
    
    // Test 3: Invalid commitment
    console.log('\n🧪 Test 3: Login with invalid commitment (should fail)');
    const loginPayload3 = {
      walletAddress: user.wallet_address,
      proof: zkProofData.proof,
      commitment: 'invalid_commitment_123'
    };
    
    try {
      const response3 = await fetch('http://localhost:3001/api/zk/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginPayload3)
      });
      
      const result3 = await response3.json();
      console.log('\n📥 Response:');
      console.log(`Status: ${response3.status}`);
      console.log('Body:', JSON.stringify(result3, null, 2));
      
      if (!response3.ok && !result3.success) {
        console.log('✅ Test 3 PASSED: Invalid commitment correctly rejected');
      } else {
        console.log('❌ Test 3 FAILED: Invalid commitment was accepted (security issue!)');
      }
    } catch (error) {
      console.log('❌ Test 3 ERROR: Failed to connect to server');
      console.log('Error:', error.message);
    }
    
    console.log('\n🎯 ZK Login endpoint testing completed!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testZkLogin();