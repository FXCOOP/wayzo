-- Complete Database Schema Fix for Wayzo Plans Table
-- Run this entire script in Supabase SQL Editor

-- Add all potentially missing columns to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS markdown TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS html TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS budget_low NUMERIC;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS budget_high NUMERIC;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS travelers INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS style TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Verify all columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'plans'
ORDER BY ordinal_position;

-- Check if any plans exist
SELECT COUNT(*) as total_plans FROM plans;

-- Show sample of plans table structure (will be empty if no plans yet)
SELECT * FROM plans LIMIT 5;
