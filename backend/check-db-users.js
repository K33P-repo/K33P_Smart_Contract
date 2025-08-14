import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'k33p_database',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_HOST?.includes('render.com') || process.env.DB_HOST?.includes('railway') ? { rejectUnauthorized: false } : false,
};

console.log('Database config:', {
  user: dbConfig.user,
  host: dbConfig.host,
  database: dbConfig.database,
  port: dbConfig.port,
  ssl: !!dbConfig.ssl
});

const pool = new Pool(dbConfig);

async function checkDatabaseUsers() {
  let client;
  try {
    console.log('\n🔗 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Connected successfully!');
    
    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Users table does not exist');
      return;
    }
    
    console.log('✅ Users table exists');
    
    // Get total count of users
    const countResult = await client.query('SELECT COUNT(*) FROM users');
    console.log(`\n📊 Total users in database: ${countResult.rows[0].count}`);
    
    // Get all users with their data
    const result = await client.query(`
      SELECT 
        user_id, 
        wallet_address, 
        phone_hash, 
        phone_number,
        zk_commitment,
        created_at
      FROM users 
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log(`\n👥 Found ${result.rows.length} users (showing latest 20):`);
    console.log('=' .repeat(80));
    
    result.rows.forEach((user, index) => {
      console.log(`\n🔹 User ${index + 1}:`);
      console.log(`   User ID: ${user.user_id}`);
      console.log(`   Wallet Address: ${user.wallet_address || 'Not set'}`);
      console.log(`   Phone Hash: ${user.phone_hash || 'Not set'}`);
      console.log(`   Phone Number: ${user.phone_number || 'Not set'}`);
      console.log(`   ZK Commitment: ${user.zk_commitment ? user.zk_commitment.substring(0, 50) + '...' : 'Not set'}`);
      console.log(`   Created: ${user.created_at}`);
    });
    
    // Check for users with phone numbers specifically
    const phoneUsers = await client.query(`
      SELECT COUNT(*) FROM users WHERE phone_hash IS NOT NULL OR phone_number IS NOT NULL
    `);
    console.log(`\n📱 Users with phone data: ${phoneUsers.rows[0].count}`);
    
    // Check for users with ZK commitments
    const zkUsers = await client.query(`
      SELECT COUNT(*) FROM users WHERE zk_commitment IS NOT NULL
    `);
    console.log(`🔐 Users with ZK commitments: ${zkUsers.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused. Check if:');
      console.log('   - Database server is running');
      console.log('   - Connection details are correct');
      console.log('   - Network/firewall allows connection');
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('\n🔚 Database connection closed');
  }
}

checkDatabaseUsers();