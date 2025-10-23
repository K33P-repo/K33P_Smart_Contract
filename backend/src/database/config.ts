// database/config.js
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database configuration - Support both DATABASE_URL and individual variables
const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    console.log('🔧 Using DATABASE_URL for connection');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
      maxUses: 7500,
    };
  }
  
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

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

class SQLParser {
    static splitSQLStatements(sql: string): string[] {
      const statements: string[] = [];
      let currentStatement = '';
      let inDollarQuote = false;
      let dollarTag = '';
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let inComment = false;
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];
      
      if (!inSingleQuote && !inDoubleQuote && !inDollarQuote) {
        if (char === '-' && nextChar === '-') {
          inComment = true;
          currentStatement += char;
          i++; 
          continue;
        }
        if (char === '\n' && inComment) {
          inComment = false;
        }
        if (inComment) {
          currentStatement += char;
          continue;
        }
      }
      
      // Handle dollar quoting
      if (char === '$' && !inSingleQuote && !inDoubleQuote) {
        const match = sql.substring(i).match(/^\$([A-Za-z_]*)\$/);
        if (match) {
          if (!inDollarQuote) {
            // Start of dollar quote
            inDollarQuote = true;
            dollarTag = match[1];
            currentStatement += match[0];
            i += match[0].length - 1;
          } else if (match[1] === dollarTag) {
            // End of dollar quote
            inDollarQuote = false;
            dollarTag = '';
            currentStatement += match[0];
            i += match[0].length - 1;
          } else {
            currentStatement += char;
          }
          continue;
        }
      }
      
      // Handle single quotes
      if (char === "'" && !inDoubleQuote && !inDollarQuote) {
        inSingleQuote = !inSingleQuote;
      }
      
      // Handle double quotes
      if (char === '"' && !inSingleQuote && !inDollarQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
      
      // Handle semicolons (statement separators)
      if (char === ';' && !inSingleQuote && !inDoubleQuote && !inDollarQuote && !inComment) {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
        continue;
      }
      
      currentStatement += char;
    }
    
    // Add the last statement if any
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements.filter(stmt => stmt.length > 0);
  }

  /**
   * Check if error should be ignored (idempotent operations)
   */
  static shouldIgnoreError(error: any): boolean {
    const ignorableMessages = [
      'already exists',
      'does not exist',
      'duplicate key',
      'cannot drop',
      'is already a member'
    ];
    
    return ignorableMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }
}

// Auto-create database tables from schema
export const createTables = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    
    console.log('🔧 Creating database tables from schema.sql...');
    
    // Read the schema.sql file
    const schemaPath = join(__dirname, 'schema.sql');
    const schemaSQL = await readFile(schemaPath, 'utf8');
    
    // Use intelligent SQL parser
    const statements = SQLParser.splitSQLStatements(schemaSQL);
    
    let successfulStatements = 0;
    let totalStatements = statements.length;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        console.log(`📝 Executing statement ${i + 1}/${totalStatements}`);
        await client.query(statement);
        successfulStatements++;
      } catch (error) {
        // Type assertion to treat error as Error
        const err = error as Error;
        
        // Ignore "already exists" errors for idempotent operations
        if (SQLParser.shouldIgnoreError(err)) {
          console.log(`⏭️  Skipped (already exists): ${statement.substring(0, 100)}...`);
          successfulStatements++; // Count as successful for idempotent operations
        } else {
          console.warn(`⚠️  Statement execution warning:`, err.message);
          console.warn(`   Statement: ${statement.substring(0, 200)}...`);
        }
      }
    }
    
    console.log(`✅ Schema applied: ${successfulStatements}/${totalStatements} statements executed successfully`);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error creating database tables from schema.sql:', error);
    return false;
  }
};

export const updateSchema = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    
    console.log('🔧 Checking for schema updates...');
    
    const newTables = [
      'system_logs', 'emergency_contacts', 'backup_phrases', 
      'phone_change_requests', 'recovery_requests', 'account_activity'
    ];
    
    let missingTables = [];
    
    for (const table of newTables) {
      const tableCheck = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      
      if (!tableCheck.rows[0].exists) {
        missingTables.push(table);
      }
    }
    
    if (missingTables.length > 0) {
      console.log(`🔄 Found ${missingTables.length} missing tables, running full schema update...`);
      client.release();
      return await createTables();
    }
    
    // Check for missing columns in users table
    const missingColumns = [
      'ADD COLUMN IF NOT EXISTS auth_methods JSONB NOT NULL DEFAULT \'[]\'::jsonb',
      'ADD COLUMN IF NOT EXISTS folders JSONB NOT NULL DEFAULT \'[]\'::jsonb',
      'ADD COLUMN IF NOT EXISTS verification_method VARCHAR(50) DEFAULT \'phone\'',
      'ADD COLUMN IF NOT EXISTS biometric_type VARCHAR(50)',
      'ADD COLUMN IF NOT EXISTS sender_wallet_address TEXT',
      'ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false'
    ];
    
    for (const column of missingColumns) {
      try {
        await client.query(`ALTER TABLE users ${column}`);
        console.log(`✅ Added/verified column: ${column.split(' ')[5]}`);
      } catch (error) {
        console.log(`⏭️  Column already exists: ${column.split(' ')[5]}`);
      }
    }
    
    // Remove insecure plain text PIN field if it exists
    try {
      await client.query('ALTER TABLE users DROP COLUMN IF EXISTS pin');
      console.log('✅ Removed insecure plain text PIN column');
    } catch (error) {
      console.log('ℹ️  PIN column already removed or never existed');
    }
    
    client.release();
    console.log('✅ Schema update completed');
    return true;
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    return false;
  }
};

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);
    
    // Check if core tables exist
    const requiredTables = ['users', 'user_deposits', 'transactions'];
    let missingTables = [];
    
    for (const table of requiredTables) {
      const tableCheck = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      
      if (!tableCheck.rows[0].exists) {
        missingTables.push(table);
      }
    }
    
    if (missingTables.length > 0) {
      console.log('🔧 Creating missing tables...');
      client.release();
      return await createTables();
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
    
    // Update schema with any missing columns
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