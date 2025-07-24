-- Migration: Make wallet_address column optional in users table
-- This migration removes the NOT NULL constraint from wallet_address

ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;

-- Add a comment to document the change
COMMENT ON COLUMN users.wallet_address IS 'User wallet address - optional field, can be added later during verification';