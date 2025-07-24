import pool from './dist/database/config.js';

async function checkZkUsers() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking users with ZK proofs...');
    
    // Get users with ZK proofs
    const result = await client.query(`
      SELECT u.user_id, u.wallet_address, u.zk_commitment, zp.proof, zp.public_inputs 
      FROM users u 
      INNER JOIN zk_proofs zp ON u.user_id = zp.user_id 
      LIMIT 5
    `);
    
    console.log(`\n📋 Found ${result.rows.length} users with ZK proofs:`);
    
    result.rows.forEach((row, i) => {
      console.log(`\nUser ${i+1}:`);
      console.log(`  User ID: ${row.user_id}`);
      console.log(`  Wallet Address: ${row.wallet_address}`);
      console.log(`  ZK Commitment: ${row.zk_commitment}`);
      console.log(`  Has Proof: ${!!row.proof}`);
      console.log(`  Proof Data: ${JSON.stringify(row.proof)}`);
      console.log(`  Public Inputs: ${JSON.stringify(row.public_inputs)}`);
    });
    
    if (result.rows.length === 0) {
      console.log('\n❌ No users found with ZK proofs!');
      console.log('\n🔍 Checking individual tables...');
      
      const userCount = await client.query('SELECT COUNT(*) as count FROM users WHERE zk_commitment IS NOT NULL');
      const proofCount = await client.query('SELECT COUNT(*) as count FROM zk_proofs');
      
      console.log(`Users with ZK commitments: ${userCount.rows[0].count}`);
      console.log(`ZK proofs in database: ${proofCount.rows[0].count}`);
      
      // Show sample ZK proofs
      const sampleProofs = await client.query('SELECT user_id, commitment FROM zk_proofs LIMIT 3');
      console.log('\nSample ZK proofs:');
      sampleProofs.rows.forEach(proof => {
        console.log(`  User: ${proof.user_id}, Commitment: ${proof.commitment}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkZkUsers();