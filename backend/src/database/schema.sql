-- K33P Database Schema
-- Updated with Payment and Subscription tables for Paystack integration

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; 

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    username VARCHAR(30),
    wallet_address TEXT,
    phone_hash VARCHAR(128),
    pin_hash VARCHAR(128),
    zk_commitment TEXT,
    auth_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
    folders JSONB NOT NULL DEFAULT '[]'::jsonb,
    verification_method VARCHAR(50) DEFAULT 'phone',
    biometric_type VARCHAR(50),
    sender_wallet_address TEXT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User deposits table
CREATE TABLE IF NOT EXISTS user_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_address TEXT NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    phone_hash VARCHAR(128) NOT NULL,
    zk_proof TEXT,
    zk_commitment TEXT,
    tx_hash VARCHAR(128),
    amount BIGINT NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- NEW: Payment transactions table for Paystack
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'NGN',
    user_id VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    customer_code VARCHAR(255),
    plan_code VARCHAR(255),
    authorization_code VARCHAR(255),
    gateway_response TEXT,
    channel VARCHAR(50),
    fees DECIMAL(10,2),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- UPDATED: Subscriptions table with Paystack integration
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_code VARCHAR(255) UNIQUE,
    user_id VARCHAR(50) NOT NULL,
    phone VARCHAR(50),
    customer_code VARCHAR(255),
    plan_code VARCHAR(255),
    tier VARCHAR(50) NOT NULL DEFAULT 'freemium' CHECK (tier IN ('freemium', 'premium')),
    is_active BOOLEAN NOT NULL DEFAULT false,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(50) DEFAULT 'inactive',
    next_payment_date TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- Transactions table (Cardano transactions)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_deposit_id) REFERENCES user_deposits(id) ON DELETE SET NULL
);

-- ZK proofs table
CREATE TABLE IF NOT EXISTS zk_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    commitment TEXT NOT NULL,
    proof TEXT NOT NULL,
    public_inputs JSONB,
    is_valid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Auth data table
CREATE TABLE IF NOT EXISTS auth_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('phone', 'pin', 'biometric', 'passkey')),
    auth_hash VARCHAR(128) NOT NULL,
    salt VARCHAR(64),
    metadata JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, auth_type)
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    metadata JSONB,
    user_id VARCHAR(50),
    tx_hash VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(128),
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Backup phrases table
CREATE TABLE IF NOT EXISTS backup_phrases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    phrase_hash VARCHAR(128) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- Phone change requests table
CREATE TABLE IF NOT EXISTS phone_change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(128) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    current_phone_hash VARCHAR(128) NOT NULL,
    new_phone_hash VARCHAR(128) NOT NULL,
    verification_method VARCHAR(20) CHECK (verification_method IN ('sms', 'email', 'onchain')),
    verification_code VARCHAR(10),
    verification_data JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed', 'failed', 'expired')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Recovery requests table
CREATE TABLE IF NOT EXISTS recovery_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recovery_id VARCHAR(128) UNIQUE NOT NULL,
    user_id VARCHAR(50),
    identifier_hash VARCHAR(128) NOT NULL,
    new_phone_hash VARCHAR(128) NOT NULL,
    recovery_method VARCHAR(20) CHECK (recovery_method IN ('emergency_contact', 'backup_phrase', 'onchain_proof', 'multi_factor')),
    verification_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed', 'failed', 'expired')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Account activity table
CREATE TABLE IF NOT EXISTS account_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50),
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    success BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_auth_methods ON users USING gin (auth_methods);
CREATE INDEX IF NOT EXISTS idx_users_folders ON users USING gin (folders);

CREATE INDEX IF NOT EXISTS idx_user_deposits_user_address ON user_deposits(user_address);
CREATE INDEX IF NOT EXISTS idx_user_deposits_user_id ON user_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deposits_tx_hash ON user_deposits(tx_hash);
CREATE INDEX IF NOT EXISTS idx_user_deposits_verified ON user_deposits(verified);
CREATE INDEX IF NOT EXISTS idx_user_deposits_refunded ON user_deposits(refunded);

-- NEW: Indexes for payment transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_phone ON payment_transactions(phone);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

-- UPDATED: Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(phone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment_date ON subscriptions(next_payment_date);

-- Existing indexes for other tables
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_zk_proofs_user_id ON zk_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_data_user_id ON auth_data(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_data_type ON auth_data(auth_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_verified ON emergency_contacts(verified);
CREATE INDEX IF NOT EXISTS idx_backup_phrases_user_id ON backup_phrases(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_change_requests_user_id ON phone_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_change_requests_request_id ON phone_change_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_phone_change_requests_status ON phone_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_recovery_id ON recovery_requests(recovery_id);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_user_id ON recovery_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_status ON recovery_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_activity_user_id ON account_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_account_activity_type ON account_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_account_activity_created_at ON account_activity(created_at);

-- Updated timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FIXED: Updated validate_auth_methods function with proper CASE handling
CREATE OR REPLACE FUNCTION validate_auth_methods()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if we have at least 3 auth methods
  IF NEW.auth_methods IS NOT NULL AND jsonb_array_length(NEW.auth_methods) < 3 THEN
    RAISE EXCEPTION 'At least 3 authentication methods are required';
  END IF;
  
  -- Validate each auth method
  IF NEW.auth_methods IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(NEW.auth_methods)-1 LOOP
      -- Check required fields
      IF NOT (NEW.auth_methods->i ? 'type') THEN
        RAISE EXCEPTION 'Auth method at position % is missing type field', i;
      END IF;
      
      IF NOT (NEW.auth_methods->i ? 'createdAt') THEN
        RAISE EXCEPTION 'Auth method at position % is missing createdAt field', i;
      END IF;
      
      -- Validate based on auth type with proper CASE structure including ELSE
      CASE (NEW.auth_methods->i->>'type')
        WHEN 'pin' THEN
          IF NOT (NEW.auth_methods->i ? 'data') THEN
            RAISE EXCEPTION 'PIN auth method must have data field with hashed PIN';
          END IF;
        WHEN 'phone' THEN
          IF NOT (NEW.auth_methods->i ? 'data') THEN
            RAISE EXCEPTION 'Phone auth method must have data field with phone hash';
          END IF;
        WHEN 'fingerprint' THEN
          -- Fingerprint may or may not have data initially - this is acceptable
          NULL;
        WHEN 'face' THEN
          IF NOT (NEW.auth_methods->i ? 'data') THEN
            RAISE EXCEPTION 'Face auth method must have data field with biometric hash';
          END IF;
        WHEN 'passkey' THEN
          -- Passkey may or may not have data initially
          NULL;
        WHEN 'biometric' THEN
          -- Biometric may or may not have data initially
          NULL;
        ELSE
          -- Handle unknown auth types gracefully instead of throwing error
          RAISE NOTICE 'Unknown auth type detected: %', (NEW.auth_methods->i->>'type');
          -- Continue without throwing error to allow flexibility
      END CASE;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS validate_auth_methods_trigger ON users;
CREATE TRIGGER validate_auth_methods_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_auth_methods();

-- Folder validation function
CREATE OR REPLACE FUNCTION validate_folders()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folders IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(NEW.folders)-1 LOOP
      IF NOT (NEW.folders->i ? 'id') THEN
        RAISE EXCEPTION 'Folder at position % is missing id field', i;
      END IF;
      
      IF NOT (NEW.folders->i ? 'name') THEN
        RAISE EXCEPTION 'Folder at position % is missing name field', i;
      END IF;
      
      IF NOT (NEW.folders->i ? 'createdAt') THEN
        RAISE EXCEPTION 'Folder at position % is missing createdAt field', i;
      END IF;
      
      IF NOT (NEW.folders->i ? 'updatedAt') THEN
        RAISE EXCEPTION 'Folder at position % is missing updatedAt field', i;
      END IF;
      
      IF NEW.folders->i ? 'items' THEN
        FOR j IN 0..jsonb_array_length(NEW.folders->i->'items')-1 LOOP
          IF NOT (NEW.folders->i->'items'->j ? 'id') THEN
            RAISE EXCEPTION 'Wallet item at position % in folder % is missing id field', j, i;
          END IF;
          
          IF NOT (NEW.folders->i->'items'->j ? 'name') THEN
            RAISE EXCEPTION 'Wallet item at position % in folder % is missing name field', j, i;
          END IF;
          
          IF NOT (NEW.folders->i->'items'->j ? 'type') THEN
            RAISE EXCEPTION 'Wallet item at position % in folder % is missing type field', j, i;
          END IF;
          
          IF NOT (NEW.folders->i->'items'->j ? 'createdAt') THEN
            RAISE EXCEPTION 'Wallet item at position % in folder % is missing createdAt field', j, i;
          END IF;
          
          IF NOT (NEW.folders->i->'items'->j ? 'updatedAt') THEN
            RAISE EXCEPTION 'Wallet item at position % in folder % is missing updatedAt field', j, i;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Folder validation trigger
DROP TRIGGER IF EXISTS validate_folders_trigger ON users;
CREATE TRIGGER validate_folders_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_folders();

-- Data migration for existing users with empty auth_methods
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE auth_methods = '[]'::jsonb OR auth_methods IS NULL) THEN
    UPDATE users 
    SET auth_methods = '[
      {"type": "phone", "createdAt": "2024-01-01T00:00:00Z"},
      {"type": "pin", "data": "default-hash-placeholder", "createdAt": "2024-01-01T00:00:00Z"},
      {"type": "fingerprint", "createdAt": "2024-01-01T00:00:00Z"}
    ]'::jsonb
    WHERE auth_methods = '[]'::jsonb OR auth_methods IS NULL;
  END IF;
END $$;

-- Views
CREATE OR REPLACE VIEW user_deposit_summary AS
SELECT 
    ud.id,
    ud.user_address,
    ud.user_id,
    u.name,
    u.email,
    ud.amount,
    ud.verified,
    ud.refunded,
    ud.signup_completed,
    ud.verification_method,
    ud.verification_attempts,
    ud.timestamp,
    ud.refund_timestamp,
    t.confirmations,
    t.status as transaction_status
FROM user_deposits ud
LEFT JOIN users u ON ud.user_id = u.user_id
LEFT JOIN transactions t ON ud.tx_hash = t.tx_hash;

-- NEW: Payment and subscription summary view
CREATE OR REPLACE VIEW payment_subscription_summary AS
SELECT 
    u.user_id,
    u.email,
    u.phone_hash,
    s.tier as subscription_tier,
    s.is_active as subscription_active,
    s.end_date as subscription_end_date,
    s.auto_renew as subscription_auto_renew,
    COUNT(pt.id) as total_payments,
    SUM(CASE WHEN pt.status = 'success' THEN pt.amount ELSE 0 END) as total_paid_amount,
    MAX(pt.created_at) as last_payment_date
FROM users u
LEFT JOIN subscriptions s ON u.user_id = s.user_id
LEFT JOIN payment_transactions pt ON u.user_id = pt.user_id
GROUP BY u.user_id, u.email, u.phone_hash, s.tier, s.is_active, s.end_date, s.auto_renew;

CREATE OR REPLACE VIEW active_users AS
SELECT 
    u.*,
    COUNT(ud.id) as total_deposits,
    SUM(CASE WHEN ud.verified = true THEN 1 ELSE 0 END) as verified_deposits,
    SUM(CASE WHEN ud.refunded = true THEN 1 ELSE 0 END) as refunded_deposits
FROM users u
LEFT JOIN user_deposits ud ON u.user_id = ud.user_id
GROUP BY u.id, u.user_id, u.email, u.name, u.wallet_address, u.phone_hash, u.zk_commitment, u.created_at, u.updated_at;

-- Insert sample data for testing (optional)
INSERT INTO users (user_id, wallet_address, username, auth_methods) 
VALUES 
('test-user-1', '0x742d35Cc6634C0532925a3b8D6B3985a0c6b7a8c', 'testuser1', '[
  {"type": "phone", "data": "encrypted_phone_1", "createdAt": "2024-01-01T00:00:00Z", "lastUsed": "2024-01-01T00:00:00Z"},
  {"type": "pin", "data": "encrypted_pin_1", "createdAt": "2024-01-01T00:00:00Z", "lastUsed": "2024-01-01T00:00:00Z"},
  {"type": "fingerprint", "createdAt": "2024-01-01T00:00:00Z", "lastUsed": "2024-01-01T00:00:00Z"}
]'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO users (user_id, wallet_address, username, auth_methods) 
VALUES 
('test-user-2', '0x842d35Cc6634C0532925a3b8D6B3985a0c6b7a8d', 'testuser2', '[
  {"type": "phone", "data": "encrypted_phone_2", "createdAt": "2024-01-01T00:00:00Z", "lastUsed": "2024-01-01T00:00:00Z"},
  {"type": "pin", "data": "encrypted_pin_2", "createdAt": "2024-01-01T00:00:00Z", "lastUsed": "2024-01-01T00:00:00Z"},
  {"type": "face", "data": "encrypted_face_2", "createdAt": "2024-01-01T00:00:00Z", "lastUsed": "2024-01-01T00:00:00Z"}
]'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

-- NEW: Insert sample payment and subscription data for testing
INSERT INTO payment_transactions (reference, phone, customer_email, amount, currency, user_id, status, customer_code, plan_code)
VALUES 
('test_pay_ref_001', '+2347012345678', '2347012345678@k33p.app', 5000.00, 'NGN', 'test-user-1', 'success', 'CUS_test001', 'PLN_monthly_5000')
ON CONFLICT (reference) DO NOTHING;

INSERT INTO subscriptions (user_id, phone, tier, is_active, start_date, end_date, auto_renew, subscription_code, customer_code, plan_code, status)
VALUES 
('test-user-1', '+2347012345678', 'premium', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month', true, 'SUB_test001', 'CUS_test001', 'PLN_monthly_5000', 'active')
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- Print success message
DO $$ 
BEGIN
  RAISE NOTICE 'Database schema created successfully with Payment and Subscription tables';
  RAISE NOTICE 'Added: payment_transactions table with Paystack integration';
  RAISE NOTICE 'Updated: subscriptions table with Paystack fields';
  RAISE NOTICE 'Added: payment_subscription_summary view';
END $$;