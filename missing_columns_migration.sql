-- Add missing location tracking columns
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(10, 2);

-- Add missing spray application columns
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_product TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_quantity TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_unit TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_target TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_equipment TEXT;
-- Add missing location tracking columns
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(10, 2);

-- Add missing spray application columns
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_product TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_quantity TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_unit TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_target TEXT;
ALTER TABLE phenology_events ADD COLUMN IF NOT EXISTS spray_equipment TEXT;
