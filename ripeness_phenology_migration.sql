
-- Add new phenology tracking columns
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS phenology_percent_complete INTEGER;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS phenology_location TEXT;

-- Add new ripeness tracking columns
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS ripeness_brix DECIMAL(4,2);
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS ripeness_ph DECIMAL(3,2);
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS ripeness_ta DECIMAL(4,2);
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS ripeness_seed_brownness TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS ripeness_block_estimates TEXT;

-- Add new irrigation tracking column
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS irrigation_measurement_method TEXT;
