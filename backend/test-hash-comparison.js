import { Pool } from 'pg';
import dotenv from 'dotenv';
import { poseidonHash } from './dist/utils/zk.js';
import { hashPhone } from './dist/utils/hash.js';
import crypto from 'crypto';

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

async function testHashComparison() {
  let client;
  try {
    console.log('🔗 Connecting to database...');
    client = await pool.connect();
    
    // Test phone number from our curl request
    const testPhone = '5631543289236';
    console.log('\n📱 Testing different hash methods for phone:', testPhone);
    
    // Method 1: poseidonHash (currently used in login)
    const poseidonResult = poseidonHash([testPhone]);
    console.log('1. poseidonHash([phone]):', poseidonResult);
    
    // Method 2: hashPhone (used in other routes)
    const hashPhoneResult = hashPhone(testPhone);
    console.log('2. hashPhone(phone):', hashPhoneResult);
    
    // Method 3: Simple SHA-256 (used in user-routes.ts)
    const simpleHash = crypto.createHash('sha256').update(testPhone).digest('hex');
    console.log('3. Simple SHA-256:', simpleHash);
    
    // Check which hash exists in database
    console.log('\n🔍 Checking database for matches:');
    
    const methods = [
      { name: 'poseidonHash', hash: poseidonResult },
      { name: 'hashPhone', hash: hashPhoneResult },
      { name: 'Simple SHA-256', hash: simpleHash }
    ];
    
    for (const method of methods) {
      const result = await client.query(
        'SELECT user_id, phone_number FROM users WHERE phone_hash = $1',
        [method.hash]
      );
      
      if (result.rows.length > 0) {
        console.log(`✅ ${method.name} MATCH found:`, result.rows[0]);
      } else {
        console.log(`❌ ${method.name}: No match`);
      }
    }
    
    // Show the actual stored hash for this phone
    const storedResult = await client.query(
      'SELECT phone_hash FROM users WHERE phone_number = $1',
      [testPhone]
    );
    
    if (storedResult.rows.length > 0) {
      const storedHash = storedResult.rows[0].phone_hash;
      console.log('\n📋 Stored hash in database:', storedHash);
      
      // Check which method produces this hash
      console.log('\n🔎 Reverse engineering the hash method:');
      if (storedHash === poseidonResult) {
        console.log('✅ Stored hash matches poseidonHash');
      } else if (storedHash === hashPhoneResult) {
        console.log('✅ Stored hash matches hashPhone');
      } else if (storedHash === simpleHash) {
        console.log('✅ Stored hash matches simple SHA-256');
      } else {
        console.log('❌ Stored hash doesn\'t match any of our methods');
        
        // Try to figure out what method was used
        console.log('\n🧪 Testing other possible methods:');
        
        // Maybe it's SHA-256 with salt
        const saltedHash = crypto.createHash('sha256').update(testPhone + process.env.PHONE_HASH_SALT).digest('hex');
        console.log('With PHONE_HASH_SALT:', saltedHash);
        if (storedHash === saltedHash) {
          console.log('✅ MATCH: SHA-256 with PHONE_HASH_SALT');
        }
        
        // Maybe it's just the raw phone without prefix
        const rawHash = crypto.createHash('sha256').update(testPhone).digest('hex');
        console.log('Raw SHA-256:', rawHash);
        if (storedHash === rawHash) {
          console.log('✅ MATCH: Raw SHA-256');
        }
      }
    } else {
      console.log('\n❌ Phone number not found in database');
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

testHashComparison();