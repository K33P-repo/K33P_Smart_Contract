import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'k33p_database',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create a new pool instance
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Auto-create database tables from schema
export const createTables = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    
    console.log('🔧 Creating database tables...');
    
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        name VARCHAR(255),
        wallet_address TEXT NOT NULL,
        phone_hash VARCHAR(128),
        zk_commitment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create user_deposits table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_deposits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_address TEXT NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        phone_hash VARCHAR(128) NOT NULL,
        zk_proof TEXT,
        zk_commitment TEXT,
        tx_hash VARCHAR(128),
        amount BIGINT NOT NULL DEFAULT 0,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        refunded BOOLEAN DEFAULT FALSE,
        signup_completed BOOLEAN DEFAULT FALSE,
        verified BOOLEAN DEFAULT FALSE,
        verification_attempts INTEGER DEFAULT 0,
        last_verification_attempt TIMESTAMP WITH TIME ZONE,
        pin_hash VARCHAR(128),
        biometric_hash VARCHAR(128),
        biometric_type VARCHAR(20) CHECK (biometric_type IN ('fingerprint', 'faceid', 'voice', 'iris')),
        verification_method VARCHAR(20) CHECK (verification_method IN ('phone', 'pin', 'biometric')),
        refund_tx_hash VARCHAR(128),
        refund_timestamp TIMESTAMP WITH TIME ZONE,
        sender_wallet_address TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    
    // Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tx_hash VARCHAR(128) UNIQUE NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount BIGINT NOT NULL,
        confirmations INTEGER DEFAULT 0,
        block_time TIMESTAMP WITH TIME ZONE,
        transaction_type VARCHAR(20) CHECK (transaction_type IN ('deposit', 'refund', 'signup')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
        user_deposit_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_deposit_id) REFERENCES user_deposits(id) ON DELETE SET NULL
      )
    `);
    
    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_deposits_user_address ON user_deposits(user_address)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_deposits_user_id ON user_deposits(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_deposits_tx_hash ON user_deposits(tx_hash)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash)');
    
    console.log('✅ Database tables created successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error creating database tables:', error);
    return false;
  }
};

// Test database connection and required tables
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    
    // Test basic connection
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);
    
    // Check if required tables exist
    const requiredTables = ['users', 'user_deposits', 'transactions'];
    let missingTables = [];
    
    for (const table of requiredTables) {
      const tableCheck = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      
      if (!tableCheck.rows[0].exists) {
        console.warn(`❌ Required table '${table}' does not exist`);
        missingTables.push(table);
      }
    }
    
    if (missingTables.length > 0) {
      console.log('🔧 Attempting to create missing tables...');
      client.release();
      
      // Try to create tables
      const tablesCreated = await createTables();
      if (tablesCreated) {
        console.log('✅ All required tables now exist');
        return true;
      } else {
        console.error('❌ Failed to create required tables');
        return false;
      }
    }
    
    console.log('✅ All required tables exist');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection or table check failed:', error);
    return false;
  }
};

// Close all connections in the pool
export const closePool = async (): Promise<void> => {
  await pool.end();
  console.log('Database pool closed');
};

export default pool;