import pool from './dist/database/config.js';

async function checkPinStorage() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking PIN storage in database...');
    
    // Check users with PINs stored
    const usersWithPins = await client.query(`
      SELECT 
        user_id, 
        phone_number, 
        LENGTH(pin) as pin_length,
        LENGTH(pin_hash) as pin_hash_length,
        created_at
      FROM users 
      WHERE pin IS NOT NULL
      ORDER BY created_at DESC
    `);
    
    console.log('\n✅ Users with PINs stored:');
    console.table(usersWithPins.rows);
    
    // Check recent users without PINs
    const result = await client.query(`
      SELECT 
        user_id, 
        phone_number, 
        CASE WHEN pin IS NOT NULL THEN 'YES' ELSE 'NO' END as has_pin,
        CASE WHEN pin_hash IS NOT NULL THEN 'YES' ELSE 'NO' END as has_pin_hash,
        created_at
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📊 Recent users and their PIN status:');
    console.table(result.rows);
    
    // Count users with PINs
    const pinCount = await client.query('SELECT COUNT(*) as count FROM users WHERE pin IS NOT NULL');
    console.log(`\n📈 Total users with PINs stored: ${pinCount.rows[0].count}`);
    
    // Check if there are any users at all
    const totalUsers = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`📈 Total users in database: ${totalUsers.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking PIN storage:', error.message);
  } finally {
    client.release();
  }
}

checkPinStorage().then(() => process.exit(0)).catch(console.error);