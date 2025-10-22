// database/config.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration - Support both DATABASE_URL and individual variables
const getDbConfig = () => {
  // If DATABASE_URL is provided, use it (for Supabase)
  if (process.env.DATABASE_URL) {
    console.log('🔧 Using DATABASE_URL for connection');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10, // Reduced for Supabase limits
      idleTimeoutMillis: 30000, // Match Supabase timeout
      connectionTimeoutMillis: 10000,
      family: 4,
      // Add these for better connection management
      allowExitOnIdle: true,
      maxUses: 7500, // Below Supabase's 10k connection limit
    };
  }
  
  // Fallback to individual variables (for local development)
  console.log('🔧 Using individual DB variables for connection');
  return {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'k33p_database',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  };
};

// Create a new pool instance
const pool = new Pool(getDbConfig());

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Handle connection events
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('acquire', () => {
  console.log('🔗 Client acquired from pool');
});

// Auto-create database tables from schema
export const createTables = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    
    console.log('🔧 Creating ALL database tables...');
    
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Create ALL tables from your schema.sql
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        name VARCHAR(255),
        username VARCHAR(30),
        wallet_address TEXT,
        phone_hash VARCHAR(128),
        phone_number VARCHAR(20),
        pin VARCHAR(10),
        pin_hash VARCHAR(128),
        zk_commitment TEXT,
        verification_method VARCHAR(50) DEFAULT 'phone',
        biometric_type VARCHAR(50),
        sender_wallet_address TEXT,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_deposits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_address TEXT NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        phone_hash VARCHAR(128) NOT NULL,
        phone_number VARCHAR(20),
        zk_proof TEXT,
        zk_commitment TEXT,
        tx_hash VARCHAR(128),
        amount BIGINT NOT NULL DEFAULT 0,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        refunded BOOLEAN DEFAULT FALSE,
        signup_completed BOOLEAN DEFAULT FALSE,
        verified BOOLEAN DEFAULT FALSE,
        verification_attempts INTEGER DEFAULT 0,
        last_verification_attempt TIMESTAMPTZ,
        pin_hash VARCHAR(128),
        biometric_hash VARCHAR(128),
        biometric_type VARCHAR(20) CHECK (biometric_type IN ('fingerprint', 'faceid', 'voice', 'iris')),
        verification_method VARCHAR(20) CHECK (verification_method IN ('phone', 'pin', 'biometric')),
        refund_tx_hash VARCHAR(128),
        refund_timestamp TIMESTAMPTZ,
        sender_wallet_address TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // ADD THE MISSING TABLES:
    await client.query(`
      CREATE TABLE IF NOT EXISTS zk_proofs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(50) NOT NULL,
        commitment TEXT NOT NULL,
        proof TEXT NOT NULL,
        public_inputs JSONB,
        is_valid BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        verified_at TIMESTAMPTZ,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(50) NOT NULL,
        auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('phone', 'pin', 'biometric', 'passkey')),
        auth_hash VARCHAR(128) NOT NULL,
        salt VARCHAR(64),
        metadata JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used TIMESTAMPTZ,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, auth_type)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tx_hash VARCHAR(128) UNIQUE NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount BIGINT NOT NULL,
        confirmations INTEGER DEFAULT 0,
        block_time TIMESTAMPTZ,
        transaction_type VARCHAR(20) CHECK (transaction_type IN ('deposit', 'refund', 'signup')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
        user_deposit_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_deposit_id) REFERENCES user_deposits(id) ON DELETE SET NULL
      )
    `);

    // Create indexes for all tables
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_deposits_user_id ON user_deposits(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_deposits_tx_hash ON user_deposits(tx_hash)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_zk_proofs_user_id ON zk_proofs(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auth_data_user_id ON auth_data(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash)');
    
    console.log('✅ ALL database tables created successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error creating database tables:', error);
    return false;
  }
};

// Add missing columns to existing tables
export const updateSchema = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    
    console.log('🔧 Checking for missing columns...');
    
    // Add missing columns to users table
    const missingColumns = [
      'ADD COLUMN IF NOT EXISTS pin VARCHAR(10)',
      'ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(128)',
      'ADD COLUMN IF NOT EXISTS verification_method VARCHAR(50) DEFAULT \'phone\'',
      'ADD COLUMN IF NOT EXISTS biometric_type VARCHAR(50)',
      'ADD COLUMN IF NOT EXISTS sender_wallet_address TEXT',
      'ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false'
    ];
    
    for (const column of missingColumns) {
      try {
        await client.query(`ALTER TABLE users ${column}`);
        console.log(`✅ Added column: ${column.split(' ')[4]}`);
      } catch (error) {
        console.log(`⏭️  Column already exists: ${column.split(' ')[4]}`);
      }
    }
    
    client.release();
    console.log('✅ Schema update completed');
    return true;
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    return false;
  }
};

// Test database connection and required tables (keep this for existing imports)
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

export const initializeDatabase = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);
    
    client.release();
    
    // Create tables if they don't exist
    await createTables();
    
    // Update schema with missing columns
    await updateSchema();
    
    console.log('🎉 Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
};

export const closePool = async (): Promise<void> => {
  await pool.end();
  console.log('Database pool closed');
};

export default pool;