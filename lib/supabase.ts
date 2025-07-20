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
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getVineyard(id: string): Promise<Vineyard> {
  const { data, error } = await supabase
    .from('vineyards')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getVineyardDetails(vineyardId: string): Promise<Vineyard> {
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
      throw new Error('No vineyard found with that ID');
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
        
        .select()
        .single();

      if (error) {
        console.error('Error updating vineyard location:', error);
        throw new Error(error.message);
      }

      vineyard = data;
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
        .select()
        .single();

      if (error) {
        console.error('Error creating vineyard:', error);
        throw new Error(error.message);
      }

      vineyard = data;
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

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
  harvestBlock?: string
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

    console.log('💾 Inserting phenology event data:', insertData);

    const { data, error } = await supabase
      .from('phenology_events')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Database error saving phenology event:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✅ Phenology event saved successfully:', data);
    return data;
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

    // Check if vineyard exists
    const { data: existingVineyard, error: checkError } = await supabase
      .from('vineyards')
      .select('id')
      .eq('id', vineyardId)
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking vineyard existence:', checkError);
      throw checkError;
    }

    if (!existingVineyard || existingVineyard.length === 0) {
      console.log('🆕 Vineyard not found, creating it...');
      
      // Create a basic vineyard record
      const { data: newVineyard, error: createError } = await supabase
        .from('vineyards')
        .insert([{
          id: vineyardId,
          name: 'Default Vineyard',
          latitude: 37.3272, // Default to La Honda
          longitude: -122.2813,
          location: 'La Honda, CA'
        }])
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating vineyard:', createError);
        throw createError;
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