import pool from './dist/database/config.js';

async function getUserTestData() {
  const client = await pool.connect();
  try {
    console.log('🔍 Getting complete user test data...');
    
    // Get a user with all required data
    const result = await client.query(`
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
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No complete user data found');
      return;
    }
    
    const user = result.rows[0];
    console.log('📋 Complete User Test Data:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Wallet Address: ${user.wallet_address}`);
    console.log(`   Phone Number: ${user.phone_number}`);
    console.log(`   Phone Hash: ${user.phone_hash}`);
    console.log(`   ZK Commitment: ${user.zk_commitment}`);
    console.log(`   Proof Commitment: ${user.proof_commitment}`);
    console.log(`   Has Proof: ${user.proof ? 'Yes' : 'No'}`);
    console.log(`   Has Public Inputs: ${user.public_inputs ? 'Yes' : 'No'}`);
    
    // Parse and display proof structure
    if (user.proof) {
      try {
        const proofData = typeof user.proof === 'string' ? JSON.parse(user.proof) : user.proof;
        console.log('\n🔐 ZK Proof Structure:');
        console.log(`   Proof Type: ${typeof proofData}`);
        console.log(`   Proof Keys: ${Object.keys(proofData).join(', ')}`);
      } catch (e) {
        console.log('\n🔐 ZK Proof (raw):', user.proof.toString().substring(0, 100) + '...');
      }
    }
    
    // Parse and display public inputs
    if (user.public_inputs) {
      try {
        const publicInputs = typeof user.public_inputs === 'string' ? JSON.parse(user.public_inputs) : user.public_inputs;
        console.log('\n📊 Public Inputs:');
        console.log(`   Type: ${typeof publicInputs}`);
        if (Array.isArray(publicInputs)) {
          console.log(`   Length: ${publicInputs.length}`);
          console.log(`   First few: ${publicInputs.slice(0, 3).join(', ')}`);
        } else {
          console.log(`   Keys: ${Object.keys(publicInputs).join(', ')}`);
        }
      } catch (e) {
        console.log('\n📊 Public Inputs (raw):', user.public_inputs.toString().substring(0, 100) + '...');
      }
    }
    
    return user;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

getUserTestData();