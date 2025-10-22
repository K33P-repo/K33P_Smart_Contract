// test-connection.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    family: 4, // Force IPv4
    connectionTimeoutMillis: 10000
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to Supabase successfully!');
    
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL Version:', result.rows[0].version);
    
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('Error details:', error);
    return false;
  }
}

testSupabaseConnection();