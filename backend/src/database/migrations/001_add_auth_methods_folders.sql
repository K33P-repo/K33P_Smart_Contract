-- Migration: Add auth_methods and folders to users table
-- Run this to update your existing schema

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN auth_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN folders JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add constraint to ensure at least 3 auth methods
CREATE OR REPLACE FUNCTION validate_auth_methods()
RETURNS TRIGGER AS $$
BEGIN
  IF jsonb_array_length(NEW.auth_methods) < 3 THEN
    RAISE EXCEPTION 'At least 3 authentication methods are required';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_auth_methods_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_auth_methods();

-- Update existing users to have default auth methods
-- This is a temporary fix - you'll need to properly set up auth methods for existing users
UPDATE users 
SET auth_methods = '[
  {"type": "phone", "createdAt": "now()"},
  {"type": "pin", "data": "default-hash", "createdAt": "now()"},
  {"type": "fingerprint", "createdAt": "now()"}
]'::jsonb
WHERE jsonb_array_length(auth_methods) = 0;

-- Create index for better performance on JSON queries
CREATE INDEX idx_users_auth_methods ON users USING gin (auth_methods);
CREATE INDEX idx_users_folders ON users USING gin (folders);