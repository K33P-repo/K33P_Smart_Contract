-- Migration: Add payment transactions table
-- This migration creates the payment_transactions table to track Paystack payments

CREATE TABLE IF NOT EXISTS payment_transactions (
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
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_email ON payment_transactions(email);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

-- Add foreign key constraint to users table if user_id exists
-- Note: This assumes the users table has a user_id column
ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_payment_transactions_user_id 
FOREIGN KEY (user_id) REFERENCES users(user_id) 
ON DELETE SET NULL;

-- Add check constraints
ALTER TABLE payment_transactions 
ADD CONSTRAINT chk_payment_amount_positive 
CHECK (amount > 0);

ALTER TABLE payment_transactions 
ADD CONSTRAINT chk_payment_status_valid 
CHECK (status IN ('initialized', 'pending', 'success', 'failed', 'cancelled', 'abandoned'));

ALTER TABLE payment_transactions 
ADD CONSTRAINT chk_payment_currency_valid 
CHECK (currency IN ('USD', 'NGN', 'GHS', 'ZAR', 'KES'));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transactions_updated_at();

-- Add comments for documentation
COMMENT ON TABLE payment_transactions IS 'Stores payment transaction records from Paystack';
COMMENT ON COLUMN payment_transactions.reference IS 'Unique payment reference from Paystack';
COMMENT ON COLUMN payment_transactions.amount IS 'Payment amount in the specified currency';
COMMENT ON COLUMN payment_transactions.currency IS 'Payment currency code (USD, NGN, etc.)';
COMMENT ON COLUMN payment_transactions.status IS 'Payment status (initialized, pending, success, failed, etc.)';
COMMENT ON COLUMN payment_transactions.gateway_response IS 'Response message from payment gateway';
COMMENT ON COLUMN payment_transactions.channel IS 'Payment channel used (card, bank, etc.)';
COMMENT ON COLUMN payment_transactions.fees IS 'Transaction fees charged by payment gateway';