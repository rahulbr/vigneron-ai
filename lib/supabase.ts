// lib/supabase.ts - MERGED with authentication + your existing functions
import { createClient } from '@supabase/supabase-js'

// Use environment variables OR hardcoded values for quick setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ozesvylffpvktxldvthi.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96ZXN2eWxmZnB2a3R4bGR2dGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNDE5NjksImV4cCI6MjA2NjYxNzk2OX0.R-7u_ptj2XbvIWLe6qGelf5PqjrACLZChYdKTNVX3Ow'

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
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  created_at?: string
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
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) {
    return null; // Return null instead of throwing error
  }
  return data[0];
}

export async function getVineyardDetails(vineyardId: string): Promise<Vineyard | null> {
  try {
    const { data, error } = await supabase
      .from('vineyards')
      .select('*')
      .eq('id', vineyardId)
      .limit(1);

    if (error) {
      console.error('Error fetching vineyard details:', error);
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      console.log('🍇 No vineyard found with ID:', vineyardId);
      return null; // Return null instead of throwing error
    }

    const vineyard = data[0];
    console.log('🍇 Loaded vineyard details:', vineyard);
    return vineyard;
  } catch (error) {
    console.error('❌ Failed to fetch vineyard details:', error);
    throw error;
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

    const insertData: any = {
      vineyard_id: vineyardId,
      event_type: eventType,
      event_date: eventDate,
      notes: notes || ''
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

    console.log('✅ Phenology event saved successfully:', data[0]);
    return data[0];
  } catch (error) {
    console.error('❌ Failed to save phenology event:', error);
    throw error;
  }
}

export async function getPhenologyEvents(vineyardId: string): Promise<PhenologyEvent[]> {
  try {
    // Validate vineyard ID before querying
    const validVineyardId = validateAndFixVineyardId(vineyardId);

    console.log('🔍 Getting phenology events for vineyard ID validation:', { 
      originalId: vineyardId, 
      validId: validVineyardId 
    });

    const { data, error } = await supabase
      .from('phenology_events')
      .select('*')
      .eq('vineyard_id', validVineyardId)
      .order('event_date', { ascending: true });

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
        .single();

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

export async function deletePhenologyEvent(eventId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting phenology event:', eventId);

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