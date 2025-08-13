-- K33P Database Schema
-- This file contains the complete database schema for the K33P project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - stores basic user information
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    username VARCHAR(30), -- Added username field
    wallet_address TEXT,
    phone_hash VARCHAR(128),
    phone_number VARCHAR(20), -- Added actual phone number field
    pin VARCHAR(10), -- Added PIN field
    pin_hash VARCHAR(128), -- Added PIN hash field
    zk_commitment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User deposits table - stores deposit and verification information
CREATE TABLE IF NOT EXISTS user_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_address TEXT NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    phone_hash VARCHAR(128) NOT NULL,
    phone_number VARCHAR(20), -- Added actual phone number field
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
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Transactions table - stores all blockchain transactions
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
);

-- ZK proofs table - stores zero-knowledge proofs
CREATE TABLE IF NOT EXISTS zk_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    commitment TEXT NOT NULL,
    proof TEXT NOT NULL,
    public_inputs JSONB,
    is_valid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Authentication data table - stores various auth methods
CREATE TABLE IF NOT EXISTS auth_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('phone', 'pin', 'biometric', 'passkey')),
    auth_hash VARCHAR(128) NOT NULL,
    salt VARCHAR(64),
    metadata JSONB, -- For storing additional auth-specific data
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, auth_type)
);

-- System logs table - for audit and debugging
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    metadata JSONB,
    user_id VARCHAR(50),
    tx_hash VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Emergency contacts table - for account recovery
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(128),
    token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Backup phrases table - for account recovery
CREATE TABLE IF NOT EXISTS backup_phrases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    phrase_hash VARCHAR(128) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- Phone change requests table - for phone number changes
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
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Recovery requests table - for account recovery
CREATE TABLE IF NOT EXISTS recovery_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recovery_id VARCHAR(128) UNIQUE NOT NULL,
    user_id VARCHAR(50),
    identifier_hash VARCHAR(128) NOT NULL, -- phone or email hash
    new_phone_hash VARCHAR(128) NOT NULL,
    recovery_method VARCHAR(20) CHECK (recovery_method IN ('emergency_contact', 'backup_phrase', 'onchain_proof', 'multi_factor')),
    verification_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed', 'failed', 'expired')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Account activity logs table - for security monitoring
CREATE TABLE IF NOT EXISTS account_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50),
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    success BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_deposits_user_address ON user_deposits(user_address);
CREATE INDEX IF NOT EXISTS idx_user_deposits_user_id ON user_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deposits_tx_hash ON user_deposits(tx_hash);
CREATE INDEX IF NOT EXISTS idx_user_deposits_verified ON user_deposits(verified);
CREATE INDEX IF NOT EXISTS idx_user_deposits_refunded ON user_deposits(refunded);
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

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
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

-- Create a view for active users
CREATE OR REPLACE VIEW active_users AS
SELECT 
    u.*,
    COUNT(ud.id) as total_deposits,
    SUM(CASE WHEN ud.verified = true THEN 1 ELSE 0 END) as verified_deposits,
    SUM(CASE WHEN ud.refunded = true THEN 1 ELSE 0 END) as refunded_deposits
FROM users u
LEFT JOIN user_deposits ud ON u.user_id = ud.user_id
GROUP BY u.id, u.user_id, u.email, u.name, u.wallet_address, u.phone_hash, u.zk_commitment, u.created_at, u.updated_at;

-- Insert default admin user (optional)
-- INSERT INTO users (user_id, email, name, wallet_address) 
-- VALUES ('admin', 'admin@k33p.com', 'Admin User', 'addr_admin') 
-- ON CONFLICT (user_id) DO NOTHING;

COMMIT;