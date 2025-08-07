
-- Add blocks column to store block names directly in events
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS blocks TEXT[];

-- Index for faster block-based queries
CREATE INDEX IF NOT EXISTS idx_phenology_events_blocks ON phenology_events USING GIN(blocks);

-- Update existing events to have empty blocks array
UPDATE phenology_events SET blocks = '{}' WHERE blocks IS NULL;
