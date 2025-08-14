import { Pool } from 'pg';
import dotenv from 'dotenv';
import { poseidonHash } from './dist/utils/zk.js';

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

const pool = new Pool(dbConfig);

async function testPhoneHash() {
  let client;
  try {
    console.log('🔗 Connecting to database...');
    client = await pool.connect();
    
    // Get a user with phone data
    const result = await client.query(`
      SELECT user_id, phone_number, phone_hash 
      FROM users 
      WHERE phone_number IS NOT NULL 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users with phone numbers found');
      return;
    }
    
    const user = result.rows[0];
    console.log('\n📱 Testing phone hash for user:', user.user_id);
    console.log('Phone number:', user.phone_number);
    console.log('Stored hash:', user.phone_hash);
    
    // Calculate hash using the same method as login
    const calculatedHash = poseidonHash([user.phone_number]);
    console.log('Calculated hash:', calculatedHash);
    
    console.log('\n🔍 Hash comparison:');
    console.log('Match:', user.phone_hash === calculatedHash ? '✅ YES' : '❌ NO');
    
    // Test with the phone number from our curl request
    const testPhone = '5631543289236';
    const testHash = poseidonHash([testPhone]);
    console.log('\n🧪 Test phone hash:');
    console.log('Phone:', testPhone);
    console.log('Hash:', testHash);
    
    // Check if this hash exists in database
    const hashCheck = await client.query(
      'SELECT user_id, phone_number FROM users WHERE phone_hash = $1',
      [testHash]
    );
    
    console.log('\n🔎 Database lookup result:');
    if (hashCheck.rows.length > 0) {
      console.log('✅ Found user with matching hash:', hashCheck.rows[0]);
    } else {
      console.log('❌ No user found with this hash');
      
      // Check all phone hashes in database
      const allHashes = await client.query(
        'SELECT phone_number, phone_hash FROM users WHERE phone_hash IS NOT NULL'
      );
      
      console.log('\n📋 All phone hashes in database:');
      allHashes.rows.forEach((row, index) => {
        console.log(`${index + 1}. Phone: ${row.phone_number} -> Hash: ${row.phone_hash}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('\n🔚 Database connection closed');
  }
}

testPhoneHash();