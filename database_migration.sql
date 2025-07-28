
-- Add irrigation columns
ALTER TABLE phenology_events ADD COLUMN irrigation_amount TEXT;
ALTER TABLE phenology_events ADD COLUMN irrigation_unit TEXT;
ALTER TABLE phenology_events ADD COLUMN irrigation_method TEXT;
ALTER TABLE phenology_events ADD COLUMN irrigation_duration TEXT;

-- Add fertilization columns
ALTER TABLE phenology_events ADD COLUMN fertilizer_type TEXT;
ALTER TABLE phenology_events ADD COLUMN fertilizer_npk TEXT;
ALTER TABLE phenology_events ADD COLUMN fertilizer_rate TEXT;
ALTER TABLE phenology_events ADD COLUMN fertilizer_unit TEXT;
ALTER TABLE phenology_events ADD COLUMN fertilizer_method TEXT;

-- Add harvest columns
ALTER TABLE phenology_events ADD COLUMN harvest_yield TEXT;
ALTER TABLE phenology_events ADD COLUMN harvest_unit TEXT;
ALTER TABLE phenology_events ADD COLUMN harvest_brix TEXT;
ALTER TABLE phenology_events ADD COLUMN harvest_ph TEXT;
ALTER TABLE phenology_events ADD COLUMN harvest_ta TEXT;
ALTER TABLE phenology_events ADD COLUMN harvest_block TEXT;

-- Add canopy management columns
ALTER TABLE phenology_events ADD COLUMN canopy_activity TEXT;
ALTER TABLE phenology_events ADD COLUMN canopy_intensity TEXT;
ALTER TABLE phenology_events ADD COLUMN canopy_side TEXT;
ALTER TABLE phenology_events ADD COLUMN canopy_stage TEXT;

-- Add scouting columns
ALTER TABLE phenology_events ADD COLUMN scout_focus TEXT;
ALTER TABLE phenology_events ADD COLUMN scout_severity TEXT;
ALTER TABLE phenology_events ADD COLUMN scout_distribution TEXT;
ALTER TABLE phenology_events ADD COLUMN scout_action TEXT;
