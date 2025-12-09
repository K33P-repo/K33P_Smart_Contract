import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔧 Starting migration debug...');
console.log('📁 Current directory:', process.cwd());
console.log('🌐 NODE_ENV:', process.env.NODE_ENV);
console.log('🔗 DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('🔗 DATABASE_URL (masked):', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function debugMigration() {
  const client = await pool.connect();
  try {
    console.log('\n✅ Connected to database');
    
    // Test connection with a simple query
    const result = await client.query('SELECT version()');
    console.log('✅ Database version:', result.rows[0].version.split(' ')[0]);
    
    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    
    console.log('\n📋 Users table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // List all columns in users table
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📊 Users table columns:');
      columns.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'}) default: ${row.column_default || 'none'}`);
      });
      
      // Check for image_number column
      const hasImageNumber = columns.rows.some(row => row.column_name === 'image_number');
      console.log(`\n📸 image_number column exists: ${hasImageNumber ? '✅ YES' : '❌ NO'}`);
      
      if (!hasImageNumber) {
        console.log('\n🔄 Attempting to add image_number column...');
        try {
          await client.query(`
            ALTER TABLE users 
            ADD COLUMN image_number INTEGER DEFAULT 1
          `);
          console.log('✅ Added image_number column');
          
          // Add check constraint
          await client.query(`
            ALTER TABLE users 
            ADD CONSTRAINT image_number_check CHECK (image_number IN (1, 2, 3))
          `);
          console.log('✅ Added check constraint (1, 2, or 3)');
          
          // Update existing rows
          await client.query(`
            UPDATE users SET image_number = 1 WHERE image_number IS NULL
          `);
          console.log('✅ Set default value for existing users');
          
        } catch (alterError: any) {
          console.error('❌ Failed to add column:', alterError.message);
          console.error('SQL State:', alterError.code);
        }
      }
    } else {
      console.log('\n⚠️ Users table does not exist. Need to run full schema creation.');
    }
    
  } catch (error: any) {
    console.error('\n💥 ERROR DETAILS:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    console.error('Hint:', error.hint);
    console.error('Position:', error.position);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
    console.log('\n🔌 Connection closed');
  }
}

debugMigration();