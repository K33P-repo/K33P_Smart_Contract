import pool from './dist/database/config.js';
import fs from 'fs';
import path from 'path';
import { StorageAbstractionService } from './dist/services/storage-abstraction.js';

async function cleanupAllDatabases() {
  console.log('🧹 Starting comprehensive database cleanup...');
  console.log('==================================================');
  
  let client;
  
  try {
    // 1. Clear PostgreSQL Database
    console.log('\n🗄️  Step 1: Clearing PostgreSQL database...');
    client = await pool.connect();
    
    // Get all table names
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    console.log(`Found ${tablesResult.rows.length} tables to clear:`);
    tablesResult.rows.forEach(row => console.log(`  - ${row.tablename}`));
    
    // Clear all tables
    for (const row of tablesResult.rows) {
      const tableName = row.tablename;
      try {
        await client.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
        console.log(`✅ Cleared table: ${tableName}`);
      } catch (error) {
        console.log(`⚠️  Could not clear table ${tableName}: ${error.message}`);
      }
    }
    
    // Verify PostgreSQL is empty
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`📊 PostgreSQL users remaining: ${userCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error clearing PostgreSQL:', error.message);
  } finally {
    if (client) client.release();
  }
  
  // 2. Clear Local Database Files
  console.log('\n📁 Step 2: Clearing local database files...');
  
  const filesToDelete = [
    './transactions.json',
    './user-deposits.json',
    './plutus.json',
    '../transactions.json',
    '../user-deposits.json',
    '../plutus.json'
  ];
  
  for (const filePath of filesToDelete) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted: ${filePath}`);
      } else {
        console.log(`ℹ️  File not found: ${filePath}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not delete ${filePath}: ${error.message}`);
    }
  }
  
  // Clear log files
  const logDir = './logs';
  if (fs.existsSync(logDir)) {
    try {
      const logFiles = fs.readdirSync(logDir);
      for (const logFile of logFiles) {
        const logPath = path.join(logDir, logFile);
        fs.writeFileSync(logPath, ''); // Clear content instead of deleting
        console.log(`✅ Cleared log: ${logPath}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not clear logs: ${error.message}`);
    }
  }
  
  // 3. Clear Iagon Storage
  console.log('\n☁️  Step 3: Clearing Iagon storage...');
  
  try {
    // Import Iagon utilities directly
    const { deleteData } = await import('./dist/utils/iagon.js');
    
    // Since we already cleared PostgreSQL, we'll attempt to clear common Iagon keys
    // Note: Iagon doesn't provide a list all keys function, so we'll clear what we can
    console.log('Attempting to clear known Iagon data patterns...');
    
    const commonPatterns = [
      'user_',
      'deposit_',
      'auth_',
      'zk_proof_',
      'commitment_'
    ];
    
    let deletedCount = 0;
    
    // Try to delete data with common patterns
    // Note: This is limited since Iagon doesn't provide key listing
    for (let i = 0; i < 100; i++) {
      for (const pattern of commonPatterns) {
        try {
          await deleteData(`${pattern}${i}`);
          deletedCount++;
          console.log(`✅ Deleted Iagon key: ${pattern}${i}`);
        } catch (error) {
          // Silently continue - key might not exist
        }
      }
    }
    
    console.log(`📊 Attempted to delete Iagon data (${deletedCount} successful deletions)`);
    console.log('ℹ️  Note: Iagon doesn\'t provide key listing, so some data may remain');
    
  } catch (error) {
    console.error('❌ Error clearing Iagon storage:', error.message);
  }
  
  // 4. Final Verification
  console.log('\n🔍 Step 4: Final verification...');
  
  try {
    client = await pool.connect();
    const finalUserCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`📊 PostgreSQL users: ${finalUserCount.rows[0].count}`);
    client.release();
    
    console.log(`📊 Iagon storage: Cannot verify (no key listing capability)`);
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  }
  
  console.log('\n🎉 Database cleanup completed!');
  console.log('==================================================');
}

cleanupAllDatabases().then(() => process.exit(0)).catch(console.error);