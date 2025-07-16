#!/usr/bin/env ts-node
/**
 * Database Reset Script
 * This script drops and recreates the database schema (USE WITH CAUTION!)
 */
import { testConnection, closePool } from './config.js';
import pool from './config.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
// Load environment variables
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function askQuestion(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}
async function resetDatabase() {
    console.log('⚠️  DATABASE RESET WARNING ⚠️');
    console.log('This will permanently delete ALL data in the database!');
    console.log('');
    try {
        // Confirm with user
        const confirmation = await askQuestion('Are you sure you want to reset the database? Type "RESET" to confirm: ');
        if (confirmation !== 'RESET') {
            console.log('❌ Reset cancelled.');
            return;
        }
        // Test database connection
        console.log('📡 Testing database connection...');
        const connected = await testConnection();
        if (!connected) {
            console.error('❌ Database connection failed. Please check your configuration.');
            process.exit(1);
        }
        console.log('🗑️  Dropping existing tables...');
        await dropAllTables();
        console.log('📋 Recreating database schema...');
        await recreateSchema();
        console.log('✅ Database reset completed successfully!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Run "npm run db:migrate" to restore data from JSON backups (if available)');
        console.log('2. Start your application with "npm run dev"');
    }
    catch (error) {
        console.error('❌ Database reset failed:', error);
        process.exit(1);
    }
    finally {
        await closePool();
    }
}
async function dropAllTables() {
    const client = await pool.connect();
    try {
        // Drop tables in correct order (respecting foreign key constraints)
        const dropQueries = [
            'DROP TABLE IF EXISTS system_logs CASCADE;',
            'DROP TABLE IF EXISTS auth_data CASCADE;',
            'DROP TABLE IF EXISTS zk_proofs CASCADE;',
            'DROP TABLE IF EXISTS transactions CASCADE;',
            'DROP TABLE IF EXISTS user_deposits CASCADE;',
            'DROP TABLE IF EXISTS users CASCADE;',
            'DROP VIEW IF EXISTS user_deposit_summary CASCADE;',
            'DROP VIEW IF EXISTS active_users CASCADE;',
            'DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;'
        ];
        for (const query of dropQueries) {
            await client.query(query);
        }
        console.log('   ✅ All tables and views dropped');
    }
    finally {
        client.release();
    }
}
async function recreateSchema() {
    const client = await pool.connect();
    try {
        // Read and execute schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schema);
        console.log('   ✅ Database schema recreated');
    }
    finally {
        client.release();
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    resetDatabase();
}
export { resetDatabase };
//# sourceMappingURL=reset.js.map