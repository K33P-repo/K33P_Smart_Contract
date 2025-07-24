import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function applyMigration() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'k33p_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });

  try {
    console.log('🔄 Connecting to database...');
    
    // Check current column constraint
    const checkResult = await pool.query(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'wallet_address'
    `);
    
    console.log('Current wallet_address nullable status:', checkResult.rows[0]?.is_nullable);
    
    if (checkResult.rows[0]?.is_nullable === 'YES') {
      console.log('✅ wallet_address is already nullable');
    } else {
      console.log('🔄 Making wallet_address nullable...');
      await pool.query('ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL');
      console.log('✅ Successfully made wallet_address nullable');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

applyMigration();