import pool from './dist/database/config.js';

async function inspectProofData() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Inspecting ZK Proof Data Structure');
    console.log('=' .repeat(60));
    
    // Get the same user data
    const userQuery = `
      SELECT 
        u.user_id,
        u.wallet_address,
        u.phone_number,
        u.zk_commitment,
        zp.proof,
        zp.public_inputs,
        zp.commitment as proof_commitment,
        zp.is_valid
      FROM users u
      JOIN zk_proofs zp ON u.user_id = zp.user_id
      WHERE u.phone_number IS NOT NULL 
        AND u.zk_commitment IS NOT NULL
        AND zp.proof IS NOT NULL
      LIMIT 1
    `;
    
    const userResult = await client.query(userQuery);
    const user = userResult.rows[0];
    
    console.log('📋 User Data:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   ZK Commitment: ${user.zk_commitment}`);
    console.log(`   Proof Commitment: ${user.proof_commitment}`);
    console.log(`   Is Valid: ${user.is_valid}`);
    console.log();
    
    // Parse and inspect the proof
    console.log('🔐 Raw Proof Data:');
    console.log('Type:', typeof user.proof);
    console.log('Raw Value:', user.proof);
    console.log();
    
    let proofData;
    try {
      proofData = typeof user.proof === 'string' ? JSON.parse(user.proof) : user.proof;
      console.log('📊 Parsed Proof Structure:');
      console.log('Type:', typeof proofData);
      console.log('Keys:', Object.keys(proofData));
      console.log('Full Structure:');
      console.log(JSON.stringify(proofData, null, 2));
    } catch (e) {
      console.log('❌ Failed to parse proof as JSON:', e.message);
      proofData = user.proof;
    }
    
    console.log();
    
    // Parse and inspect public inputs
    console.log('📊 Raw Public Inputs:');
    console.log('Type:', typeof user.public_inputs);
    console.log('Raw Value:', user.public_inputs);
    console.log();
    
    let publicInputs;
    try {
      publicInputs = typeof user.public_inputs === 'string' ? JSON.parse(user.public_inputs) : user.public_inputs;
      console.log('📊 Parsed Public Inputs Structure:');
      console.log('Type:', typeof publicInputs);
      console.log('Keys:', Object.keys(publicInputs));
      console.log('Full Structure:');
      console.log(JSON.stringify(publicInputs, null, 2));
    } catch (e) {
      console.log('❌ Failed to parse public inputs as JSON:', e.message);
      publicInputs = user.public_inputs;
    }
    
    console.log();
    
    // Check what the ZK verification function expects
    console.log('🔍 Expected Proof Format Analysis:');
    console.log('The ZK login endpoint expects:');
    console.log('- proof: The actual proof data');
    console.log('- commitment: The ZK commitment');
    console.log();
    
    console.log('🧪 Suggested Test Payloads:');
    
    // Test with the full proof object
    console.log('1. Using full proof object:');
    console.log(JSON.stringify({
      walletAddress: user.wallet_address,
      proof: proofData,
      commitment: user.zk_commitment.split('-')[0]
    }, null, 2));
    
    console.log();
    
    // Test with just the proof field
    if (proofData && proofData.proof) {
      console.log('2. Using proof.proof field:');
      console.log(JSON.stringify({
        walletAddress: user.wallet_address,
        proof: proofData.proof,
        commitment: user.zk_commitment.split('-')[0]
      }, null, 2));
    }
    
    console.log();
    
    // Test with publicInputs as proof
    console.log('3. Using publicInputs as proof:');
    console.log(JSON.stringify({
      walletAddress: user.wallet_address,
      proof: publicInputs,
      commitment: user.zk_commitment.split('-')[0]
    }, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

inspectProofData();