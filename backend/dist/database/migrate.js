#!/usr/bin/env ts-node
/**
 * Database Migration Script
 * This script migrates existing JSON data to PostgreSQL database
 */
import { testConnection, closePool } from './config.js';
import { DatabaseManager } from './models.js';
import { dbService } from './service.js';
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
        // Check if schema exists
        console.log('🔍 Checking database schema...');
        const stats = await dbService.getStatistics();
        console.log(`📊 Current database state: ${stats.totalUsers} users, ${stats.totalDeposits} deposits`);
        // Migrate data from JSON files
        console.log('📦 Migrating data from JSON files...');
        await DatabaseManager.migrateFromJSON();
        // Show final statistics
        const finalStats = await dbService.getStatistics();
        console.log('');
        console.log('✅ Migration completed successfully!');
        console.log('📊 Final database state:');
        console.log(`   - Users: ${finalStats.totalUsers}`);
        console.log(`   - Total deposits: ${finalStats.totalDeposits}`);
        console.log(`   - Verified deposits: ${finalStats.verifiedDeposits}`);
        console.log(`   - Refunded deposits: ${finalStats.refundedDeposits}`);
        console.log(`   - Completed signups: ${finalStats.completedSignups}`);
        console.log(`   - Total deposit amount: ${(Number(finalStats.totalDepositAmount) / 1_000_000).toFixed(2)} ADA`);
        console.log('');
        // Backup original JSON files
        await backupJsonFiles();
        console.log('🎉 Migration process completed!');
        console.log('Your application is now using PostgreSQL for data storage.');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
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
    }
    // Backup mock-db.json
    const mockDbPath = path.join(__dirname, '../utils/mock-db.json');
    if (fs.existsSync(mockDbPath)) {
        const backupPath = path.join(backupDir, `mock-db-${timestamp}.json`);
        fs.copyFileSync(mockDbPath, backupPath);
        console.log(`   ✅ Backed up mock-db.json to ${backupPath}`);
    }
    console.log('💾 Backup completed!');
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateData();
}
export { migrateData };
//# sourceMappingURL=migrate.js.map