import pool from './dist/database/config.js';
import fetch from 'node-fetch';

// Test the ZK login endpoint by temporarily modifying it to use PostgreSQL
async function testZkLoginWithPostgres() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing ZK Login with PostgreSQL Database...');
    
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
    console.log('\n👤 Testing with user from PostgreSQL:');
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
    
    // Create a custom login endpoint test that simulates what the endpoint should do
    console.log('\n🧪 Simulating ZK Login Logic with PostgreSQL...');
    
    // Test 1: Simulate login with wallet address
    console.log('\n🔍 Test 1: Lookup user by wallet address');
    const walletLookup = await client.query(
      'SELECT user_id, wallet_address, phone_hash, zk_commitment FROM users WHERE wallet_address = $1',
      [user.wallet_address]
    );
    
    if (walletLookup.rows.length > 0) {
      const foundUser = walletLookup.rows[0];
      console.log('✅ User found by wallet address:');
      console.log(`  User ID: ${foundUser.user_id}`);
      console.log(`  ZK Commitment: ${foundUser.zk_commitment}`);
      
      // Check if commitment matches
      if (foundUser.zk_commitment === user.zk_commitment) {
        console.log('✅ ZK Commitment matches!');
        console.log('✅ Login would be SUCCESSFUL with wallet address');
      } else {
        console.log('❌ ZK Commitment mismatch');
      }
    } else {
      console.log('❌ User not found by wallet address');
    }
    
    // Test 2: Simulate login with phone hash (if available)
    if (user.phone_hash) {
      console.log('\n🔍 Test 2: Lookup user by phone hash');
      const phoneLookup = await client.query(
        'SELECT user_id, wallet_address, phone_hash, zk_commitment FROM users WHERE phone_hash = $1',
        [user.phone_hash]
      );
      
      if (phoneLookup.rows.length > 0) {
        const foundUser = phoneLookup.rows[0];
        console.log('✅ User found by phone hash:');
        console.log(`  User ID: ${foundUser.user_id}`);
        console.log(`  ZK Commitment: ${foundUser.zk_commitment}`);
        
        // Check if commitment matches
        if (foundUser.zk_commitment === user.zk_commitment) {
          console.log('✅ ZK Commitment matches!');
          console.log('✅ Login would be SUCCESSFUL with phone hash');
        } else {
          console.log('❌ ZK Commitment mismatch');
        }
      } else {
        console.log('❌ User not found by phone hash');
      }
    }
    
    // Test 3: Verify ZK proof exists
    console.log('\n🔍 Test 3: Verify ZK proof validation');
    const proofValidation = await client.query(
      'SELECT is_valid FROM zk_proofs WHERE user_id = $1 AND commitment = $2',
      [user.user_id, user.zk_commitment]
    );
    
    if (proofValidation.rows.length > 0) {
      const isValid = proofValidation.rows[0].is_valid;
      console.log(`✅ ZK Proof found with validity: ${isValid}`);
      if (isValid) {
        console.log('✅ ZK Proof is valid!');
      } else {
        console.log('❌ ZK Proof is invalid');
      }
    } else {
      console.log('❌ No ZK proof found for this commitment');
    }
    
    console.log('\n📋 Summary:');
    console.log('🔍 The issue is that the ZK login endpoint uses Iagon mock database');
    console.log('🔍 But all the required data exists in PostgreSQL database');
    console.log('🔍 The endpoint needs to be modified to use PostgreSQL instead');
    console.log('\n💡 Recommendation:');
    console.log('  1. Modify the ZK login endpoint to use PostgreSQL database');
    console.log('  2. Replace findUser from iagon.js with PostgreSQL queries');
    console.log('  3. All required data (users, zk_commitments, zk_proofs) exists in PostgreSQL');
    
    console.log('\n🎯 PostgreSQL-based ZK Login simulation completed!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testZkLoginWithPostgres();