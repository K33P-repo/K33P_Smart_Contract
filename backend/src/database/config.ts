// database/config.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Build the TLS config. In production we verify the server certificate by
// default (`rejectUnauthorized: true`); supply a CA via DB_SSL_CA (PEM) for
// providers with a private/self-signed CA. Verification can be explicitly
// relaxed with DB_SSL_REJECT_UNAUTHORIZED=false, but that is discouraged.
const getSslConfig = (): false | { rejectUnauthorized: boolean; ca?: string } => {
  const sslDisabled = process.env.DB_SSL === 'false';
  if (sslDisabled || (!isProduction && !process.env.DB_SSL)) {
    return false; // local dev default: no TLS
  }
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const ca = process.env.DB_SSL_CA;
  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
};

// Database configuration - Support both DATABASE_URL and individual variables
const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    console.log('🔧 Using DATABASE_URL for connection');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: getSslConfig(),
      max: 3,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 50000,
      maxUses: 100,
    };
  }

  console.log('🔧 Using individual DB variables for connection');

  const password = process.env.DB_Password;
  if (!password) {
    if (isProduction) {
      throw new Error('DB_Password is required in production (no insecure default is used).');
    }
    console.warn('⚠️  DB_Password not set — using the insecure dev default. Do NOT use in production.');
  }

  return {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'k33p_database',
    password: password || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: getSslConfig(),
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