// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions
interface Vineyard {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
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

// Weather data operations
export async function saveWeatherData(vineyardId: string, weatherDays: WeatherDay[]) {
  console.log('💾 Saving weather data:', { vineyardId, dayCount: weatherDays.length });

  const weatherRecords = weatherDays.map(day => ({
    vineyard_id: vineyardId,
    date: day.date,
    temp_high: day.temp_high,
    temp_low: day.temp_low,
    gdd: day.gdd,
    rainfall: day.rainfall || 0
  }));

  try {
    // Use upsert with the correct conflict resolution
    const { data, error } = await supabase
      .from('daily_weather')
      .upsert(weatherRecords, { 
        onConflict: 'vineyard_id,date',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Weather data saved successfully:', data?.length || 0, 'records');
    return data;
  } catch (error) {
    console.error('❌ Failed to save weather data:', error);
    // Don't throw the error - just log it and continue
    // The app should work even if database save fails
    return [];
  }
}

export async function getWeatherData(vineyardId: string, startDate: string | null = null) {
  let query = supabase
    .from('daily_weather')
    .select('*')
    .eq('vineyard_id', vineyardId)
    .order('date');

  if (startDate) {
    query = query.gte('date', startDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Phenology operations
export async function savePhenologyEvent(vineyardId: string, eventType: string, eventDate: string, notes: string = '') {
  const { data, error } = await supabase
    .from('phenology_events')
    .insert([{
      vineyard_id: vineyardId,
      event_type: eventType,
      event_date: eventDate,
      notes
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPhenologyEvents(vineyardId: string) {
  const { data, error } = await supabase
    .from('phenology_events')
    .select('*')
    .eq('vineyard_id', vineyardId)
    .order('event_date');

  if (error) throw error;
  return data;
}