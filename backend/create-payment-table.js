import pool from './dist/database/config.js';
import dotenv from 'dotenv';

dotenv.config();

async function createPaymentTable() {
  console.log('Creating payment_transactions table...');
  
  const client = await pool.connect();
  try {
    // Check if table already exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'payment_transactions'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ payment_transactions table already exists');
      return;
    }
    
    // Create the table
    await client.query(`
      CREATE TABLE payment_transactions (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        user_id VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'initialized',
        gateway_response TEXT,
        paid_at TIMESTAMP,
        channel VARCHAR(50),
        fees DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    await client.query('CREATE INDEX idx_payment_transactions_reference ON payment_transactions(reference)');
    await client.query('CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id)');
    await client.query('CREATE INDEX idx_payment_transactions_status ON payment_transactions(status)');
    await client.query('CREATE INDEX idx_payment_transactions_email ON payment_transactions(email)');
    await client.query('CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at)');
    
    // Add constraints
    await client.query(`
      ALTER TABLE payment_transactions 
      ADD CONSTRAINT chk_payment_amount_positive 
      CHECK (amount > 0)
    `);
    
    await client.query(`
      ALTER TABLE payment_transactions 
      ADD CONSTRAINT chk_payment_status_valid 
      CHECK (status IN ('initialized', 'pending', 'success', 'failed', 'cancelled', 'abandoned'))
    `);
    
    await client.query(`
      ALTER TABLE payment_transactions 
      ADD CONSTRAINT chk_payment_currency_valid 
      CHECK (currency IN ('USD', 'NGN', 'GHS', 'ZAR', 'KES'))
    `);
    
    console.log('✅ payment_transactions table created successfully');
    
  } catch (error) {
    console.error('❌ Error creating payment_transactions table:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createPaymentTable();