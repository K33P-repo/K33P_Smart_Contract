import pool from './dist/database/config.js';

async function checkUsers() {
  const client = await pool.connect();
  try {
    console.log('Checking users in database...');
    
    // Get all users
    const result = await client.query(
      'SELECT user_id, wallet_address, phone_hash, zk_commitment FROM users LIMIT 10'
    );
    
    console.log('Found', result.rows.length, 'users:');
    result.rows.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log('  User ID:', user.user_id);
      console.log('  Wallet Address:', user.wallet_address);
      console.log('  Phone Hash:', user.phone_hash);
      console.log('  ZK Commitment:', user.zk_commitment);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkUsers();