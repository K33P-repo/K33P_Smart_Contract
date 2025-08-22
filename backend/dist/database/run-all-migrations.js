#!/usr/bin/env ts-node
/**
 * Database Migration Runner
 * This script applies all pending SQL migrations
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
async function createMigrationsTable() {
    const client = await pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Migrations table created/verified');
    }
    finally {
        client.release();
    }
}
async function getAppliedMigrations() {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT filename FROM migrations ORDER BY filename');
        return result.rows.map(row => row.filename);
    }
    finally {
        client.release();
    }
}
async function applyMigration(filename, sql) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Apply the migration
        await client.query(sql);
        // Record that this migration was applied
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`✅ Applied migration: ${filename}`);
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function runAllMigrations() {
    console.log('🔄 Starting database migrations...');
    try {
        // Test database connection
        console.log('📡 Testing database connection...');
        const connected = await testConnection();
        if (!connected) {
            console.error('❌ Database connection failed. Please check your configuration.');
            process.exit(1);
        }
        // Create migrations table if it doesn't exist
        await createMigrationsTable();
        // Get list of applied migrations
        const appliedMigrations = await getAppliedMigrations();
        console.log(`📋 Found ${appliedMigrations.length} previously applied migrations`);
        // Read all migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        console.log(`📁 Found ${migrationFiles.length} migration files`);
        // Apply pending migrations
        let appliedCount = 0;
        for (const filename of migrationFiles) {
            if (!appliedMigrations.includes(filename)) {
                console.log(`🔄 Applying migration: ${filename}`);
                const migrationPath = path.join(migrationsDir, filename);
                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                try {
                    await applyMigration(filename, migrationSQL);
                    appliedCount++;
                }
                catch (error) {
                    console.error(`❌ Failed to apply migration ${filename}:`, error);
                    throw error;
                }
            }
            else {
                console.log(`⏭️  Skipping already applied migration: ${filename}`);
            }
        }
        if (appliedCount === 0) {
            console.log('✅ No pending migrations to apply');
        }
        else {
            console.log(`✅ Successfully applied ${appliedCount} migrations`);
        }
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await closePool();
    }
}
// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllMigrations();
}
export { runAllMigrations };
//# sourceMappingURL=run-all-migrations.js.map