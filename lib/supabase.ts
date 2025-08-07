// lib/supabase.ts - MERGED with authentication + your existing functions
import { createClient } from '@supabase/supabase-js'

// Use environment variables OR hardcoded values for demo project
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wyzgljbmcrhceauysgpw.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ========================================
// AUTH FUNCTIONS (NEW)
// ========================================
export const getCurrentUser = () => supabase.auth.getUser()
export const signOut = () => supabase.auth.signOut()
export const signInWithEmail = (email: string, password: string) => 
  supabase.auth.signInWithPassword({ email, password })
export const signUpWithEmail = (email: string, password: string) =>
  supabase.auth.signUp({ email, password })

// ========================================
// TYPE DEFINITIONS (YOUR EXISTING + NEW)
// ========================================
interface Vineyard {
  id: string;
  name: string;
  location?: string;
  location_name?: string; // Added for compatibility
  latitude: number;
  longitude: number;
  user_id?: string; // Added for multi-user support
  created_at: string;
  updated_at?: string;
}

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface PhenologyEvent {
  id?: string;
  vineyard_id: string;
  user_id?: string; // Added for multi-user support
  event_type: string; // Made more flexible
  event_date: string;
  end_date?: string;
  notes?: string;
  harvest_block?: string;
  is_actual?: boolean;
  created_at?: string;
  // Fields for associated blocks, managed via a separate table
  blocks?: string[]; // This will store block IDs associated with the event
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  created_at?: string
}

export interface Organization {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at?: string
}

export interface Property {
  id: string
  organization_id: string
  name: string
  location?: string
  latitude?: number
  longitude?: number
  property_type: string
  created_at: string
  updated_at?: string
}

export interface Block {
  id: string
  property_id: string
  name: string
  varietal?: string
  planted_year?: number
  area_acres?: number
  row_count?: number
  vine_spacing?: number
  row_spacing?: number
  notes?: string
  created_at: string
  updated_at?: string
}

export interface UserOrganization {
  id: string
  user_id: string
  organization_id: string
  role: string
  created_at: string
}

// ========================================
// VINEYARD OPERATIONS (YOUR EXISTING + ENHANCED)
// ========================================
export async function createVineyard(name: string, location: string, lat: number, lon: number): Promise<Vineyard> {
  // Add user authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Generate a proper UUID for the vineyard
  const vineyardId = crypto.randomUUID()

  const { data, error } = await supabase
    .from('vineyards')
    .insert([{
      id: vineyardId,
      name,
      location,
      latitude: lat,
      longitude: lon,
      user_id: user.id // Multi-user support
    }])
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Failed to create vineyard');
  }

  return data[0];
}

export async function getVineyard(id: string): Promise<Vineyard | null> {
  const { data, error } = await supabase
    .from('vineyards')
    .select('id,name,location,latitude,longitude,user_id,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching vineyard:', error);
    return null;
  }

  return data;
}

export async function getVineyardDetails(vineyardId: string): Promise<Vineyard | null> {
  try {
    const { data, error } = await supabase
      .from('vineyards')
      .select('id,name,location,latitude,longitude,user_id,created_at,updated_at')
      .eq('id', vineyardId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching vineyard details:', error);
      return null;
    }

    if (!data) {
      console.log('🍇 No vineyard found with ID:', vineyardId);
      return null;
    }

    console.log('🍇 Loaded vineyard details:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch vineyard details:', error);
    return null;
  }
}

export async function saveVineyardLocation(
  vineyardId: string,
  latitude: number,
  longitude: number,
  locationName: string
): Promise<Vineyard> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Generate a proper UUID if the provided ID is not a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const properVineyardId = uuidRegex.test(vineyardId) ? vineyardId : crypto.randomUUID();

    console.log('🔍 Vineyard ID check:', { 
      originalId: vineyardId, 
      isValidUUID: uuidRegex.test(vineyardId),
      finalId: properVineyardId 
    });

    // Check if the vineyard already exists
    const { data: existingData } = await supabase
      .from('vineyards')
      .select('*')
      .eq('id', properVineyardId)
      .limit(1);

    let vineyard;

    if (existingData && existingData.length > 0) {
      // Update existing vineyard - only use fields that exist in your schema
      const updateData: any = {
        name: locationName,
        latitude: latitude,
        longitude: longitude,
        location: locationName
      };

      const { data, error } = await supabase
        .from('vineyards')
        .update(updateData)
        .eq('id', properVineyardId)
        .select();

      if (error) {
        console.error('Error updating vineyard location:', error);
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to update vineyard location');
      }

      vineyard = data[0];
    } else {
      // Create new vineyard - only use fields that exist in your schema
      const insertData: any = {
        id: properVineyardId,
        name: locationName,
        latitude: latitude,
        longitude: longitude,
        location: locationName
      };

      const { data, error } = await supabase
        .from('vineyards')
        .insert([insertData])
        .select();

      if (error) {
        console.error('Error creating vineyard:', error);
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to create vineyard');
      }

      vineyard = data[0];
    }

    console.log('✅ Vineyard location saved:', vineyard);
    return vineyard;
  } catch (error) {
    console.error('❌ Failed to save vineyard location:', error);
    throw error;
  }
}

// Get user's vineyards (NEW)
export async function getUserVineyards(): Promise<Vineyard[]> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('Authentication error:', authError)
      return []
    }

    if (!user) {
      console.log('No authenticated user found')
      return []
    }

    const { data, error } = await supabase
      .from('vineyards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user vineyards:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Unexpected error in getUserVineyards:', error)
    return []
  }
}

// ========================================
// WEATHER OPERATIONS (YOUR EXISTING)
// ========================================
export async function saveWeatherData(
  vineyardId: string, 
  weatherData: WeatherDay[]
): Promise<any[]> {
  console.log('💾 Saving weather data:', { vineyardId, dayCount: weatherData.length });

  const uniqueWeatherDays = weatherData.filter((day, index, self) => 
    index === self.findIndex(d => d.date === day.date)
  );

  console.log('💾 After deduplication:', { 
    originalCount: weatherData.length, 
    uniqueCount: uniqueWeatherDays.length 
  });

  const weatherRecords = uniqueWeatherDays.map(day => ({
    vineyard_id: vineyardId,
    date: day.date,
    temp_high: day.temp_high,
    temp_low: day.temp_low,
    gdd: day.gdd,
    rainfall: day.rainfall || 0
  }));

  try {
    const { error: deleteError } = await supabase
      .from('weather_data')
      .delete()
      .eq('vineyard_id', vineyardId);

    if (deleteError) {
      console.log('📊 New weather_data table not available, trying daily_weather table');

      const { error: oldDeleteError } = await supabase
        .from('daily_weather')
        .delete()
        .eq('vineyard_id', vineyardId);

      if (oldDeleteError) {
        console.warn('⚠️ Could not delete existing weather data:', oldDeleteError);
      }

      const { data, error } = await supabase
        .from('daily_weather')
        .insert(weatherRecords)
        .select();

      if (error) {
        console.error('❌ Database error (daily_weather):', error);
        throw error;
      }

      console.log('✅ Weather data saved to daily_weather:', data?.length || 0, 'records');
      return data || [];
    } else {
      console.log('🗑️ Cleared existing weather data for fresh insert');

      const newTableRecords = weatherRecords.map(record => ({
        ...record,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('weather_data')
        .insert(newTableRecords)
        .select();

      if (error) {
        console.error('❌ Database error (weather_data):', error);
        throw error;
      }

      console.log('✅ Weather data saved to weather_data:', data?.length || 0, 'records');
      return data || [];
    }
  } catch (error) {
    console.error('❌ Failed to save weather data:', error);
    return [];
  }
}

export async function getWeatherData(
  vineyardId: string, 
  startDate: string | null = null
): Promise<WeatherDay[]> {
  try {
    let query = supabase
      .from('weather_data')
      .select('*')
      .eq('vineyard_id', vineyardId)
      .order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }

    const { data, error } = await query;

    if (error) {
      console.log('📊 New weather_data table not available, trying daily_weather table');

      let oldQuery = supabase
        .from('daily_weather')
        .select('*')
        .eq('vineyard_id', vineyardId)
        .order('date');

      if (startDate) {
        oldQuery = oldQuery.gte('date', startDate);
      }

      const { data: oldData, error: oldError } = await oldQuery;

      if (oldError) {
        throw oldError;
      }

      console.log('🌤️ Loaded cached weather data from daily_weather:', oldData?.length || 0, 'records');
      return oldData || [];
    }

    console.log('🌤️ Loaded cached weather data from weather_data:', data?.length || 0, 'records');
    return data || [];
  } catch (error) {
    console.error('❌ Failed to fetch weather data:', error);
    throw error;
  }
}

// ========================================
// PHENOLOGY OPERATIONS (YOUR EXISTING + ENHANCED)
// ========================================
export async function savePhenologyEvent(
  vineyardId: string, 
  eventType: string, 
  eventDate: string, 
  notes: string = '', 
  endDate?: string, 
  harvestBlock?: string,
  selectedBlockIds?: string[], // Renamed from blockIds to selectedBlockIds for clarity
  locationData?: {
    latitude?: number;
    longitude?: number;
    locationName?: string;
    accuracy?: number;
  },
  sprayData?: {
    product?: string;
    quantity?: string;
    unit?: string;
    target?: string;
    conditions?: string;
    equipment?: string;
  },
  irrigationData?: {
    amount?: string;
    unit?: string;
    method?: string;
    duration?: string;
  },
  fertilizationData?: {
    type?: string;
    npk?: string;
    rate?: string;
    unit?: string;
    method?: string;
  },
  harvestData?: {
    yield?: string;
    unit?: string;
    brix?: string;
    ph?: string;
    ta?: string;
    block?: string;
  },
  canopyData?: {
    activity?: string;
    intensity?: string;
    side?: string;
    stage?: string;
  },
  scoutData?: {
    focus?: string;
    severity?: string;
    distribution?: string;
    action?: string;
  }
): Promise<PhenologyEvent> {
  try {
    console.log('💾 Saving phenology event:', { vineyardId, eventType, eventDate, notes });

    // First, ensure the vineyard exists - if not, create it
    await ensureVineyardExistsInDatabase(vineyardId);

    // Get current user for multi-user support
    const { data: { user } } = await supabase.auth.getUser();

    const insertData: any = {
      vineyard_id: vineyardId,
      event_type: eventType,
      event_date: eventDate,
      notes: notes || '',
      user_id: user?.id || null
    };

    // Only add optional fields if they have values
    if (endDate) {
      insertData.end_date = endDate;
    }

    if (harvestBlock) {
      insertData.harvest_block = harvestBlock;
    }

    // Add location data if provided
    if (locationData) {
      if (locationData.latitude !== undefined) {
        insertData.location_lat = locationData.latitude;
      }
      if (locationData.longitude !== undefined) {
        insertData.location_lng = locationData.longitude;
      }
      if (locationData.locationName) {
        insertData.location_name = locationData.locationName;
      }
      if (locationData.accuracy !== undefined) {
        insertData.location_accuracy = locationData.accuracy;
      }
    }

    // Add spray application data if provided
    if (sprayData) {
      if (sprayData.product) {
        insertData.spray_product = sprayData.product;
      }
      if (sprayData.quantity) {
        insertData.spray_quantity = sprayData.quantity;
      }
      if (sprayData.unit) {
        insertData.spray_unit = sprayData.unit;
      }
      if (sprayData.target) {
        insertData.spray_target = sprayData.target;
      }
      if (sprayData.conditions) {
        insertData.spray_conditions = sprayData.conditions;
      }
      if (sprayData.equipment) {
        insertData.spray_equipment = sprayData.equipment;
      }
    }

    // Add irrigation data if provided
    if (irrigationData) {
      if (irrigationData.amount) {
        insertData.irrigation_amount = irrigationData.amount;
      }
      if (irrigationData.unit) {
        insertData.irrigation_unit = irrigationData.unit;
      }
      if (irrigationData.method) {
        insertData.irrigation_method = irrigationData.method;
      }
      if (irrigationData.duration) {
        insertData.irrigation_duration = irrigationData.duration;
      }
    }

    // Add fertilization data if provided
    if (fertilizationData) {
      if (fertilizationData.type) {
        insertData.fertilizer_type = fertilizationData.type;
      }
      if (fertilizationData.npk) {
        insertData.fertilizer_npk = fertilizationData.npk;
      }
      if (fertilizationData.rate) {
        insertData.fertilizer_rate = fertilizationData.rate;
      }
      if (fertilizationData.unit) {
        insertData.fertilizer_unit = fertilizationData.unit;
      }
      if (fertilizationData.method) {
        insertData.fertilizer_method = fertilizationData.method;
      }
    }

    // Add harvest data if provided
    if (harvestData) {
      if (harvestData.yield) {
        insertData.harvest_yield = harvestData.yield;
      }
      if (harvestData.unit) {
        insertData.harvest_unit = harvestData.unit;
      }
      if (harvestData.brix) {
        insertData.harvest_brix = harvestData.brix;
      }
      if (harvestData.ph) {
        insertData.harvest_ph = harvestData.ph;
      }
      if (harvestData.ta) {
        insertData.harvest_ta = harvestData.ta;
      }
      if (harvestData.block) {
        insertData.harvest_block = harvestData.block;
      }
    }

    // Add canopy management data if provided
    if (canopyData) {
      if (canopyData.activity) {
        insertData.canopy_activity = canopyData.activity;
      }
      if (canopyData.intensity) {
        insertData.canopy_intensity = canopyData.intensity;
      }
      if (canopyData.side) {
        insertData.canopy_side = canopyData.side;
      }
      if (canopyData.stage) {
        insertData.canopy_stage = canopyData.stage;
      }
    }

    // Add scouting data if provided
    if (scoutData) {
      if (scoutData.focus) {
        insertData.scout_focus = scoutData.focus;
      }
      if (scoutData.severity) {
        insertData.scout_severity = scoutData.severity;
      }
      if (scoutData.distribution) {
        insertData.scout_distribution = scoutData.distribution;
      }
      if (scoutData.action) {
        insertData.scout_action = scoutData.action;
      }
    }

    console.log('💾 Inserting phenology event data:', insertData);

    const { data, error } = await supabase
      .from('phenology_events')
      .insert([insertData])
      .select();

    if (error) {
      console.error('❌ Database error saving phenology event:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to save phenology event');
    }

    const savedEvent = data[0];

    // Associate event with blocks if provided
    if (selectedBlockIds && selectedBlockIds.length > 0) {
      await associateEventWithBlocks(savedEvent.id, selectedBlockIds);
      console.log('✅ Event associated with blocks:', selectedBlockIds);
    }

    console.log('✅ Phenology event saved successfully:', savedEvent);
    return savedEvent;
  } catch (error) {
    console.error('❌ Failed to save phenology event:', error);
    throw error;
  }
}

export async function getPhenologyEvents(vineyardId: string): Promise<PhenologyEvent[]> {
  try {
    // Validate vineyard ID before querying
    const validVineyardId = validateAndFixVineyardId(vineyardId);

    // Get current user for filtering
    const { data: { user } } = await supabase.auth.getUser();

    console.log('🔍 Getting phenology events for vineyard ID validation:', { 
      originalId: vineyardId, 
      validId: validVineyardId,
      userId: user?.id 
    });

    let query = supabase
      .from('phenology_events')
      .select('id,vineyard_id,user_id,event_type,event_date,end_date,notes,harvest_block,created_at,location_lat,location_lng,location_name')
      .eq('vineyard_id', validVineyardId)
      .order('event_date', { ascending: true });

    // Filter by user if authenticated
    if (user) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching phenology events:', error);
      throw new Error(error.message);
    }

    console.log('📅 Loaded phenology events:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Failed to fetch phenology events:', error);
    throw error;
  }
}

// ========================================
// VINEYARD MANAGEMENT HELPERS
// ========================================
export async function ensureVineyardExistsInDatabase(vineyardId: string): Promise<void> {
  try {
    console.log('🔍 Checking if vineyard exists in database:', vineyardId);

    // Check if vineyard exists - use proper select query
    const { data: existingVineyard, error: checkError } = await supabase
      .from('vineyards')
      .select('id')
      .eq('id', vineyardId)
      .maybeSingle(); // Use maybeSingle() to handle 0 or 1 row gracefully

    if (checkError) {
      console.error('❌ Error checking vineyard existence:', checkError);
      throw checkError;
    }

    if (!existingVineyard) {
      console.log('🆕 Vineyard not found, creating it...');

      // Get current user for user_id
      const { data: { user } } = await supabase.auth.getUser();

      // Create a basic vineyard record
      const { data: newVineyard, error: createError } = await supabase
        .from('vineyards')
        .insert([{
          id: vineyardId,
          name: 'Default Vineyard',
          latitude: 37.3272, // Default to La Honda
          longitude: -122.2813,
          location: 'La Honda, CA',
          user_id: user?.id || null
        }])
        .select()
        .maybeSingle();

      if (createError) {
        console.error('❌ Error creating vineyard:', createError);
        throw createError;
      }

      if (!newVineyard) {
        throw new Error('Failed to create default vineyard');
      }

      console.log('✅ Created new vineyard:', newVineyard);
    } else {
      console.log('✅ Vineyard already exists in database');
    }
  } catch (error) {
    console.error('❌ Failed to ensure vineyard exists:', error);
    throw error;
  }
}

export async function ensureVineyardExists(
  vineyardId: string,
  locationName: string,
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    console.log('🔍 Ensuring vineyard exists:', { vineyardId, locationName });

    // Simple approach: just return the vineyard ID
    // The phenology_events table should accept any vineyard_id
    // We'll handle vineyard creation separately if needed
    return vineyardId;
  } catch (error) {
    console.error('❌ Failed to ensure vineyard exists:', error);
    throw error;
  }
}

// ========================================
// HELPER FUNCTIONS FOR ID GENERATION
// ========================================
export function generateVineyardId(userId?: string, latitude?: number, longitude?: number): string {
  // Always return a proper UUID
  return crypto.randomUUID();
}

export function validateAndFixVineyardId(vineyardId: string): string {
  // Check if it's already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(vineyardId)) {
    return vineyardId;
  }

  // Generate a new UUID if the provided ID is not valid
  console.log('⚠️ Invalid vineyard ID detected, generating new UUID:', vineyardId);
  return crypto.randomUUID();
}

// ========================================
// ORGANIZATION MANAGEMENT FUNCTIONS
// ========================================

export async function getUserOrganizations(): Promise<(Organization & { role: string })[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('user_organizations')
      .select(`
        role,
        organizations (
          id,
          name,
          description,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)

    if (error) throw error

    return data?.map(item => ({
      ...item.organizations,
      role: item.role
    })) || []
  } catch (error) {
    console.error('Error fetching user organizations:', error)
    return []
  }
}

export async function createOrganization(name: string, description?: string): Promise<Organization> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert([{ name, description }])
      .select()
      .single()

    if (orgError) throw orgError

    // Add user as admin of the organization
    const { error: userOrgError } = await supabase
      .from('user_organizations')
      .insert([{
        user_id: user.id,
        organization_id: orgData.id,
        role: 'admin'
      }])

    if (userOrgError) throw userOrgError

    return orgData
  } catch (error) {
    console.error('Error creating organization:', error)
    throw error
  }
}

export async function getOrganizationProperties(organizationId: string): Promise<Property[]> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching properties:', error)
    return []
  }
}

export async function createProperty(
  organizationId: string,
  name: string,
  location?: string,
  latitude?: number,
  longitude?: number,
  propertyType: string = 'vineyard'
): Promise<Property> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .insert([{
        organization_id: organizationId,
        name,
        location,
        latitude,
        longitude,
        property_type: propertyType
      }])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating property:', error)
    throw error
  }
}

export async function getPropertyBlocks(propertyId: string): Promise<Block[]> {
  try {
    const { data, error } = await supabase
      .from('blocks')
      .select('*')
      .eq('property_id', propertyId)
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching blocks:', error)
    return []
  }
}

export async function createBlock(
  propertyId: string,
  name: string,
  varietal?: string,
  plantedYear?: number,
  areaAcres?: number,
  rowCount?: number,
  vineSpacing?: number,
  rowSpacing?: number,
  notes?: string
): Promise<Block> {
  try {
    const { data, error } = await supabase
      .from('blocks')
      .insert([{
        property_id: propertyId,
        name,
        varietal,
        planted_year: plantedYear,
        area_acres: areaAcres,
        row_count: rowCount,
        vine_spacing: vineSpacing,
        row_spacing: rowSpacing,
        notes
      }])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating block:', error)
    throw error
  }
}

export async function associateEventWithBlocks(eventId: string, blockIds: string[]): Promise<void> {
  try {
    // Clear existing associations
    await supabase
      .from('event_blocks')
      .delete()
      .eq('event_id', eventId)

    // Add new associations
    if (blockIds.length > 0) {
      const associations = blockIds.map(blockId => ({
        event_id: eventId,
        block_id: blockId
      }))

      const { error } = await supabase
        .from('event_blocks')
        .insert(associations)

      if (error) throw error
    }
  } catch (error) {
    console.error('Error associating event with blocks:', error)
    throw error
  }
}

export async function getEventBlocks(eventId: string): Promise<Block[]> {
  try {
    const { data, error } = await supabase
      .from('event_blocks')
      .select(`
        blocks (
          id,
          property_id,
          name,
          varietal,
          planted_year,
          area_acres,
          row_count,
          vine_spacing,
          row_spacing,
          notes,
          created_at,
          updated_at
        )
      `)
      .eq('event_id', eventId)

    if (error) throw error
    return data?.map(item => item.blocks) || []
  } catch (error) {
    console.error('Error fetching event blocks:', error)
    return []
  }
}

// ========================================
// NEW HELPER FUNCTIONS FOR AUTH + PHENOLOGY
// ========================================
export const savePhenologyEventSimple = async (vineyardId: string, event: Omit<PhenologyEvent, 'id' | 'vineyard_id' | 'created_at'>) => {
  const validVineyardId = validateAndFixVineyardId(vineyardId);

  return supabase
    .from('phenology_events')
    .insert({
      ...event,
      vineyard_id: validVineyardId
    })
}

export const saveVineyardSimple = async (vineyard: Omit<Vineyard, 'id' | 'user_id' | 'created_at'>) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  return supabase
    .from('vineyards')
    .insert({
      ...vineyard,
      user_id: user.id
    })
}

export async function updatePhenologyEvent(
  eventId: string,
  updates: Partial<PhenologyEvent & {
    location_lat?: number;
    location_lng?: number;
    location_name?: string;
    location_accuracy?: number;
    spray_product?: string;
    spray_quantity?: string;
    spray_unit?: string;
    spray_target?: string;
    spray_equipment?: string;
    spray_conditions?: string;
    irrigation_amount?: string;
    irrigation_unit?: string;
    irrigation_method?: string;
    irrigation_duration?: string;
    harvest_yield?: string;
    harvest_unit?: string;
    harvest_brix?: string;
    harvest_ph?: string;
    harvest_ta?: string;
    harvest_block?: string;
    // Include blocks field for update
    blocks?: string[];
  }>
): Promise<PhenologyEvent> {
  try {
    console.log('💾 Updating phenology event:', eventId, updates);

    const { data, error } = await supabase
      .from('phenology_events')
      .update(updates)
      .eq('id', eventId)
      .select();

    if (error) {
      console.error('❌ Database error updating phenology event:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to update phenology event');
    }

    const savedEvent = data[0];

    // Update the blocks association if the 'blocks' field is present in updates
    if (updates.blocks !== undefined) {
      await associateEventWithBlocks(eventId, updates.blocks);
      console.log('✅ Event blocks updated:', updates.blocks);
    }

    console.log('✅ Phenology event updated successfully:', savedEvent);
    return savedEvent;
  } catch (error) {
    console.error('❌ Failed to update phenology event:', error);
    throw error;
  }
}

export async function deletePhenologyEvent(eventId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting phenology event:', eventId);

    // First, delete associated blocks
    await supabase
      .from('event_blocks')
      .delete()
      .eq('event_id', eventId);

    // Then, delete the event itself
    const { error } = await supabase
      .from('phenology_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('❌ Database error deleting phenology event:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✅ Phenology event deleted successfully');
  } catch (error) {
    console.error('❌ Failed to delete phenology event:', error);
    throw error;
  }
}