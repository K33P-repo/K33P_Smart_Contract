import pool from './dist/database/config.js';

async function clearAllUsers() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Clearing all user data from database...');
    
    // Delete all data in correct order (respecting foreign key constraints)
    const deleteQueries = [
      'DELETE FROM system_logs;',
      'DELETE FROM auth_data;',
      'DELETE FROM zk_proofs;', 
      'DELETE FROM transactions;',
      'DELETE FROM user_deposits;',
      'DELETE FROM users;'
    ];
    
    let totalDeleted = 0;
    
    for (const query of deleteQueries) {
      const result = await client.query(query);
      const tableName = query.match(/FROM (\w+)/)[1];
      console.log(`   ✅ Deleted ${result.rowCount} records from ${tableName}`);
      totalDeleted += result.rowCount;
    }
    
    console.log(`\n✅ Successfully cleared all user data!`);
    console.log(`📊 Total records deleted: ${totalDeleted}`);
    console.log('\n🎉 Database is now clean - old users can signup again!');
    
  } catch (error) {
    console.error('❌ Error clearing user data:', error);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

clearAllUsers();