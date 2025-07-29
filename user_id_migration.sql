-- Add user_id column for multi-user support
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
