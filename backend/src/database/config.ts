// database/config.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration - Support both DATABASE_URL and individual variables
const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    console.log('🔧 Using DATABASE_URL for connection');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 50000,
      maxUses: 100,
    };
  }
  
  console.log('🔧 Using individual DB variables for connection');
  return {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'k33p_database',
    password: process.env.DB_Password || 'password',
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

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

// Test database connection (optional, no schema creation)
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

export const closePool = async (): Promise<void> => {
  await pool.end();
  console.log('Database pool closed');
};

export default pool;