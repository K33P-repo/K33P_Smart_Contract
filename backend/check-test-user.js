import pool from './dist/database/config.js';

async function checkTestUser() {
  const client = await pool.connect();
  
  try {
    // Get the most recent user
    const userResult = await client.query(
      'SELECT user_id, phone_hash, phone_number, created_at FROM users ORDER BY created_at DESC LIMIT 1'
    );
    
    if (userResult.rows.length === 0) {
      console.log('No users found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Most recent user:');
    console.log('- User ID:', user.user_id);
    console.log('- Phone Hash:', user.phone_hash);
    console.log('- Phone Number:', user.phone_number);
    console.log('- Created:', user.created_at);
    
    // Check user_deposits for this user
    const depositResult = await client.query(
      'SELECT user_id, pin_hash, verification_method, biometric_type FROM user_deposits WHERE user_id = $1',
      [user.user_id]
    );
    
    console.log('\nUser deposits data:');
    if (depositResult.rows.length > 0) {
      const deposit = depositResult.rows[0];
      console.log('- User ID:', deposit.user_id);
      console.log('- PIN Hash:', deposit.pin_hash);
      console.log('- PIN Hash Length:', deposit.pin_hash ? deposit.pin_hash.length : 0);
      console.log('- Verification Method:', deposit.verification_method);
      console.log('- Biometric Type:', deposit.biometric_type);
    } else {
      console.log('No user_deposits entry found for this user');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTestUser();