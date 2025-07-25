-- Migration to add subscription and avatar fields to users table
-- Run this migration to support subscription tiers and avatar selection

-- Add subscription and avatar columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'freemium' CHECK (subscription_tier IN ('freemium', 'premium')),
ADD COLUMN IF NOT EXISTS avatar_id INTEGER DEFAULT 1 CHECK (avatar_id IN (1, 2, 3)),
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_avatar_id ON users(avatar_id);

-- Update existing users to have default values
UPDATE users 
SET subscription_tier = 'freemium', avatar_id = 1 
WHERE subscription_tier IS NULL OR avatar_id IS NULL;