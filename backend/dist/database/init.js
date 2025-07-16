#!/usr/bin/env ts-node
/**
 * Database Initialization Script
 * This script initializes the PostgreSQL database with the required schema
 */
import { testConnection, closePool } from './config.js';
import { DatabaseManager } from './models.js';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config();
async function initializeDatabase() {
    console.log('🚀 Starting database initialization...');
    try {
        // Test database connection
        console.log('📡 Testing database connection...');
        const connected = await testConnection();
        if (!connected) {
            console.error('❌ Database connection failed. Please check your configuration.');
            console.error('Make sure PostgreSQL is running and the connection details in .env are correct.');
            process.exit(1);
        }
        // Initialize database schema
        console.log('📋 Initializing database schema...');
        await DatabaseManager.initializeDatabase();
        console.log('✅ Database initialization completed successfully!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Run "npm run db:migrate" to migrate existing JSON data');
        console.log('2. Start your application with "npm run dev"');
    }
    catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
    finally {
        await closePool();
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeDatabase();
}
export { initializeDatabase };
//# sourceMappingURL=init.js.map