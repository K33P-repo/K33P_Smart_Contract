import pool from './dist/database/config.js';

async function checkUserCommitment() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking User Commitment Data');
    console.log('=' .repeat(50));
    
    // Get the specific user we've been testing
    const userQuery = `
      SELECT 
        u.user_id,
        u.wallet_address,
        u.phone_number,
        u.zk_commitment as user_commitment,
        zp.commitment as proof_commitment,
        zp.proof,
        zp.public_inputs
      FROM users u
      JOIN zk_proofs zp ON u.user_id = zp.user_id
      WHERE u.phone_number = '0666866559900'
      LIMIT 1
    `;
    
    const result = await client.query(userQuery);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = result.rows[0];
    
    console.log('📋 User Data:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Wallet Address: ${user.wallet_address}`);
    console.log(`   Phone Number: ${user.phone_number}`);
    console.log();
    
    console.log('🔐 Commitment Comparison:');
    console.log(`   User Table Commitment:  ${user.user_commitment}`);
    console.log(`   Proof Table Commitment: ${user.proof_commitment}`);
    console.log(`   Match: ${user.user_commitment === user.proof_commitment ? '✅ YES' : '❌ NO'}`);
    console.log();
    
    // Parse and display the proof data
    const proofData = typeof user.proof === 'string' ? JSON.parse(user.proof) : user.proof;
    const publicInputs = typeof user.public_inputs === 'string' ? JSON.parse(user.public_inputs) : user.public_inputs;
    
    console.log('📊 Proof Data Analysis:');
    console.log('   Stored Proof:');
    console.log(JSON.stringify(proofData, null, 4));
    console.log();
    console.log('   Public Inputs:');
    console.log(JSON.stringify(publicInputs, null, 4));
    console.log();
    
    // Check if there's a commitment in the public inputs
    if (publicInputs && publicInputs.commitment) {
      console.log('🔍 Public Inputs Commitment Analysis:');
      console.log(`   Public Inputs Commitment: ${publicInputs.commitment}`);
      console.log(`   Matches User Commitment: ${publicInputs.commitment === user.user_commitment ? '✅ YES' : '❌ NO'}`);
      console.log(`   Matches Proof Commitment: ${publicInputs.commitment === user.proof_commitment ? '✅ YES' : '❌ NO'}`);
    }
    
    console.log();
    console.log('💡 Recommendation:');
    if (user.user_commitment === user.proof_commitment) {
      console.log('   ✅ Commitments match - use either one for login');
      console.log(`   🔐 Correct commitment to use: ${user.user_commitment}`);
    } else {
      console.log('   ⚠️  Commitments don\'t match - this might be the issue');
      console.log('   🔐 Try using the user table commitment for login');
      console.log(`   📝 User commitment: ${user.user_commitment}`);
      console.log(`   📝 Proof commitment: ${user.proof_commitment}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUserCommitment();