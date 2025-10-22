#!/usr/bin/env ts-node
/**
 * Database Migration Script
 * This script migrates existing JSON data to PostgreSQL database
 */

import { testConnection, closePool } from '../database/config.js';
import { DatabaseManager } from '../database/models.js';
import { dbService } from '../database/service.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateData() {
  console.log('🔄 Starting data migration from JSON to PostgreSQL...');
  
  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Database connection failed. Please run "npm run db:init" first.');
      process.exit(1);
    }
    
    // Check if schema exists and run migrations
    console.log('🔍 Checking database schema and running migrations...');
    
    // Run all migrations including the new auth_methods and folders
    await DatabaseManager.runAllMigrations();
    
    // Show final statistics
    const health = await DatabaseManager.checkDatabaseHealth();
    console.log('');
    console.log('✅ All migrations completed successfully!');
    console.log('📊 Final database state:');
    console.log(`   - Total Users: ${health.users}`);
    console.log(`   - Users with Auth Methods: ${health.usersWithAuthMethods}`);
    console.log(`   - Users with Folders: ${health.usersWithFolders}`);
    console.log(`   - Total Deposits: ${health.deposits}`);
    console.log(`   - Total Transactions: ${health.transactions}`);
    console.log(`   - Database Health: ${health.healthy ? '✅ HEALTHY' : '❌ NEEDS ATTENTION'}`);
    console.log('');
    
    // Additional statistics from dbService if available
    try {
      const stats = await dbService.getStatistics();
      console.log('📈 Additional Statistics:');
      console.log(`   - Verified deposits: ${stats.verifiedDeposits}`);
      console.log(`   - Refunded deposits: ${stats.refundedDeposits}`);
      console.log(`   - Completed signups: ${stats.completedSignups}`);
      console.log(`   - Total deposit amount: ${(Number(stats.totalDepositAmount) / 1_000_000).toFixed(2)} ADA`);
      console.log('');
    } catch (error) {
      console.log('ℹ️  Additional statistics not available');
    }
    
    // Backup original JSON files
    await backupJsonFiles();
    
    console.log('🎉 Migration process completed!');
    console.log('Your application is now using PostgreSQL for data storage with enhanced authentication methods.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

async function runSpecificMigration(migrationType: 'all' | 'auth' | 'json' | 'health' = 'all') {
  console.log(`🔄 Running ${migrationType} migration...`);
  
  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Database connection failed.');
      process.exit(1);
    }

    switch (migrationType) {
      case 'all':
        await DatabaseManager.runAllMigrations();
        break;
      case 'auth':
        await DatabaseManager.runAuthMethodsMigration();
        break;
      case 'json':
        await DatabaseManager.migrateFromJSON();
        break;
      case 'health':
        await DatabaseManager.checkDatabaseHealth();
        break;
    }

    console.log(`✅ ${migrationType} migration completed successfully!`);
    
  } catch (error) {
    console.error(`❌ ${migrationType} migration failed:`, error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

async function backupJsonFiles() {
  console.log('💾 Creating backup of original JSON files...');
  
  const backupDir = path.join(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Backup user-deposits.json
  const depositsPath = path.join(__dirname, '../../user-deposits.json');
  if (fs.existsSync(depositsPath)) {
    const backupPath = path.join(backupDir, `user-deposits-${timestamp}.json`);
    fs.copyFileSync(depositsPath, backupPath);
    console.log(`   ✅ Backed up user-deposits.json to ${backupPath}`);
  } else {
    console.log('   ℹ️  user-deposits.json not found, skipping backup');
  }
  
  // Backup mock-db.json
  const mockDbPath = path.join(__dirname, '../utils/mock-db.json');
  if (fs.existsSync(mockDbPath)) {
    const backupPath = path.join(backupDir, `mock-db-${timestamp}.json`);
    fs.copyFileSync(mockDbPath, backupPath);
    console.log(`   ✅ Backed up mock-db.json to ${backupPath}`);
  } else {
    console.log('   ℹ️  mock-db.json not found, skipping backup');
  }
  
  console.log('💾 Backup completed!');
}

async function showUsage() {
  console.log(`
📋 Migration Script Usage:

npm run db:migrate           # Run all migrations (default)
npm run db:migrate:auth      # Run only auth methods migration
npm run db:migrate:json      # Run only JSON data migration  
npm run db:migrate:health    # Check database health only

Available commands:
  all     - Run all migrations (schema + auth + JSON)
  auth    - Run only auth methods migration
  json    - Run only JSON data migration
  health  - Check database health only
`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  switch (command) {
    case 'all':
      migrateData();
      break;
    case 'auth':
      runSpecificMigration('auth');
      break;
    case 'json':
      runSpecificMigration('json');
      break;
    case 'health':
      runSpecificMigration('health');
      break;
    case 'help':
    case '--help':
    case '-h':
      showUsage();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      showUsage();
      process.exit(1);
  }
}

export { migrateData, runSpecificMigration, showUsage };