import { Pool } from 'pg';
import dotenv from 'dotenv';
import { hashPhone } from './dist/utils/hash.js';

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

// Replicate the findUserInPostgres function
async function findUserInPostgres(query) {
  const client = await pool.connect();
  try {
    let user = null;
    
    if (query.walletAddress) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE wallet_address = $1',
        [query.walletAddress]
      );
      user = result.rows[0] || null;
    } else if (query.phoneHash) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE phone_hash = $1',
        [query.phoneHash]
      );
      user = result.rows[0] || null;
    } else if (query.userId) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE user_id = $1',
        [query.userId]
      );
      user = result.rows[0] || null;
    }
    
    return user;
  } finally {
    client.release();
  }
}

async function testUserLookup() {
  try {
    console.log('🔗 Connecting to database...');
    
    const testPhone = '5631543289236';
    console.log('\n📱 Testing user lookup for phone:', testPhone);
    
    // Calculate phone hash using the correct method
    const phoneHash = hashPhone(testPhone);
    console.log('Calculated phone hash:', phoneHash);
    
    // Test the findUserInPostgres function
    console.log('\n🔍 Testing findUserInPostgres function...');
    const user = await findUserInPostgres({ phoneHash });
    
    if (user) {
      console.log('✅ User found:');
      console.log('  User ID:', user.userId);
      console.log('  Wallet Address:', user.walletAddress);
      console.log('  Phone Hash:', user.phoneHash);
      console.log('  ZK Commitment:', user.zkCommitment ? user.zkCommitment.substring(0, 50) + '...' : 'Not set');
    } else {
      console.log('❌ User not found');
    }
    
    // Also test direct query
    console.log('\n🔍 Testing direct database query...');
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT user_id, wallet_address, phone_hash, zk_commitment FROM users WHERE phone_hash = $1',
        [phoneHash]
      );
      
      if (result.rows.length > 0) {
        console.log('✅ Direct query found user:');
        console.log('  Raw result:', result.rows[0]);
      } else {
        console.log('❌ Direct query found no user');
      }
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
    console.log('\n🔚 Database connection closed');
  }
}

testUserLookup();