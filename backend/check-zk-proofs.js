import pool from './dist/database/config.js';

async function checkZkProofs() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking ZK Proofs in database...');
    
    const result = await client.query(`
      SELECT 
        user_id, 
        proof, 
        public_inputs, 
        commitment,
        is_valid,
        created_at
      FROM zk_proofs 
      LIMIT 5
    `);
    
    console.log(`📊 Found ${result.rows.length} ZK proofs:`);
    
    result.rows.forEach((row, i) => {
      console.log(`\n${i+1}. User ID: ${row.user_id}`);
      console.log(`   Commitment: ${row.commitment ? row.commitment.substring(0, 50) + '...' : 'N/A'}`);
      console.log(`   Has Proof: ${row.proof ? 'Yes' : 'No'}`);
      console.log(`   Has Public Inputs: ${row.public_inputs ? 'Yes' : 'No'}`);
      console.log(`   Is Valid: ${row.is_valid}`);
      console.log(`   Created: ${row.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkZkProofs();