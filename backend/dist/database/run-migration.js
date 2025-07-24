#!/usr/bin/env ts-node
/**
 * Database Migration Runner
 * This script applies the wallet_address optional migration
 */
import { testConnection, closePool } from './config.js';
import pool from './config.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Load environment variables
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function runMigration() {
    console.log('🔄 Starting database migration...');
    try {
        // Test database connection
        console.log('📡 Testing database connection...');
        const connected = await testConnection();
        if (!connected) {
            console.error('❌ Database connection failed. Please check your configuration.');
            process.exit(1);
        }
        // Read migration file
        const migrationPath = path.join(__dirname, 'migrations', '001_make_wallet_address_optional.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        console.log('📋 Applying migration: Make wallet_address optional...');
        const client = await pool.connect();
        try {
            // Check if the column is already nullable
            const columnCheck = await client.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'wallet_address'
      `);
            if (columnCheck.rows.length > 0 && columnCheck.rows[0].is_nullable === 'YES') {
                console.log('✅ Migration already applied: wallet_address is already nullable');
            }
            else {
                // Apply the migration
                await client.query(migrationSQL);
                console.log('✅ Migration applied successfully: wallet_address is now optional');
            }
        }
        finally {
            client.release();
        }
        console.log('🎉 Migration completed successfully!');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await closePool();
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration();
}
export { runMigration };
//# sourceMappingURL=run-migration.js.map