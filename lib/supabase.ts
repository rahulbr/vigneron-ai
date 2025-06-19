// lib/supabase.ts - Fixed for database compatibility
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions
interface Vineyard {
  id: string;
  name: string;
  location?: string;
  latitude: number;
  longitude: number;
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
  event_type: 'bud_break' | 'bloom' | 'veraison' | 'harvest';
  event_date: string;
  end_date?: string;
  notes?: string;
  harvest_block?: string;
  created_at?: string;
}

// Vineyard operations
export async function createVineyard(name: string, location: string, lat: number, lon: number): Promise<Vineyard> {
  const { data, error } = await supabase
    .from('vineyards')
    .insert([{
      name,
      location,
      latitude: lat,
      longitude: lon
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

// Enhanced function to get vineyard details with better error handling
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

    // Check if we got any results
    if (!data || data.length === 0) {
      throw new Error('No vineyard found with that ID');
    }

    // If we got multiple results, take the first one
    const vineyard = data[0];
    console.log('🍇 Loaded vineyard details:', vineyard);
    return vineyard;
  } catch (error) {
    console.error('❌ Failed to fetch vineyard details:', error);
    throw error;
  }
}

// Enhanced function to save/update vineyard location with database compatibility
export async function saveVineyardLocation(
  vineyardId: string,
  latitude: number,
  longitude: number,
  locationName: string
): Promise<Vineyard> {
  try {
    // First check if the vineyard already exists
    const { data: existingData } = await supabase
      .from('vineyards')
      .select('*')
      .eq('id', vineyardId)
      .limit(1);

    let vineyard;

    if (existingData && existingData.length > 0) {
      // Update existing vineyard - only include fields that exist in the table
      const updateData: any = {
        name: locationName,
        latitude: latitude,
        longitude: longitude,
        location: locationName, // Keep backward compatibility
      };

      // Only add updated_at if the column exists (check by trying to update)
      const { data, error } = await supabase
        .from('vineyards')
        .update(updateData)
        .eq('id', vineyardId)
        .select()
        .single();

      if (error) {
        console.error('Error updating vineyard location:', error);
        throw new Error(error.message);
      }

      vineyard = data;
    } else {
      // Create new vineyard
      const insertData: any = {
        id: vineyardId,
        name: locationName,
        latitude: latitude,
        longitude: longitude,
        location: locationName, // Keep backward compatibility
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

// Weather data operations - Enhanced version with better error handling
export async function saveWeatherData(
  vineyardId: string, 
  weatherData: WeatherDay[]
): Promise<any[]> {
  console.log('💾 Saving weather data:', { vineyardId, dayCount: weatherData.length });

  // Remove any duplicate dates within the same request
  const uniqueWeatherDays = weatherData.filter((day, index, self) => 
    index === self.findIndex(d => d.date === day.date)
  );

  console.log('💾 After deduplication:', { 
    originalCount: weatherData.length, 
    uniqueCount: uniqueWeatherDays.length 
  });

  // Try to save to weather_data table first (new structure), fallback to daily_weather (old structure)
  const weatherRecords = uniqueWeatherDays.map(day => ({
    vineyard_id: vineyardId,
    date: day.date,
    temp_high: day.temp_high,
    temp_low: day.temp_low,
    gdd: day.gdd,
    rainfall: day.rainfall || 0
  }));

  try {
    // Try new table structure first
    const { error: deleteError } = await supabase
      .from('weather_data')
      .delete()
      .eq('vineyard_id', vineyardId);

    if (deleteError) {
      console.log('📊 New weather_data table not available, trying daily_weather table');

      // Fallback to old table structure
      const { error: oldDeleteError } = await supabase
        .from('daily_weather')
        .delete()
        .eq('vineyard_id', vineyardId);

      if (oldDeleteError) {
        console.warn('⚠️ Could not delete existing weather data:', oldDeleteError);
      }

      // Insert into old table
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

      // Insert into new table (add created_at for new table)
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
    // Don't throw the error - just log it and continue
    // The app should work even if database save fails
    return [];
  }
}

export async function getWeatherData(
  vineyardId: string, 
  startDate: string | null = null
): Promise<WeatherDay[]> {
  try {
    // Try new table structure first
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

      // Fallback to old table structure
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

// Enhanced phenology operations with date ranges and harvest blocks
export async function savePhenologyEvent(
  vineyardId: string,
  eventType: 'bud_break' | 'bloom' | 'veraison' | 'harvest',
  eventDate: string,
  notes: string = '',
  endDate?: string,
  harvestBlock?: string
): Promise<PhenologyEvent> {
  try {
    const eventData: any = {
      vineyard_id: vineyardId,
      event_type: eventType,
      event_date: eventDate
    };

    // Add optional fields if provided
    if (notes) eventData.notes = notes;
    if (endDate) eventData.end_date = endDate;
    if (harvestBlock) eventData.harvest_block = harvestBlock;

    const { data, error } = await supabase
      .from('phenology_events')
      .insert([eventData])
      .select()
      .single();

    if (error) {
      console.error('Error saving phenology event:', error);
      throw new Error(error.message);
    }

    console.log('✅ Phenology event saved:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to save phenology event:', error);
    throw error;
  }
}

export async function getPhenologyEvents(vineyardId: string): Promise<PhenologyEvent[]> {
  try {
    const { data, error } = await supabase
      .from('phenology_events')
      .select('*')
      .eq('vineyard_id', vineyardId)
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