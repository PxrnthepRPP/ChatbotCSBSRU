-- Migration: Add can_admin column to advisors table
-- Allows designated advisors to have administrator privileges

ALTER TABLE advisors ADD COLUMN IF NOT EXISTS can_admin BOOLEAN DEFAULT FALSE NOT NULL;

