
import { useState, useEffect, useCallback } from 'react';
import { WeatherDashboard } from '../components/WeatherDashboard';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

interface Vineyard {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export default function Home() {
  const [vineyard, setVineyard] = useState<Vineyard | null>(null);
  const [vineyardId, setVineyardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVineyardData = useCallback(async () => {
    console.log('🔍 Using stored vineyard ID:', vineyardId);
    
    if (!vineyardId) {
      setLoading(false);
      return;
    }

    try {
      if (!supabase) {
        console.log('🏗️ Creating demo vineyard data locally (bypassing database for now)');
        
        const demoVineyard: Vineyard = {
          id: vineyardId,
          name: 'Demo Vineyard - Napa Valley',
          location: 'Napa Valley, CA',
          latitude: 38.2975,
          longitude: -122.2869,
          created_at: new Date().toISOString()
        };
        
        setVineyard(demoVineyard);
        console.log('✅ Demo vineyard data loaded:', demoVineyard);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('vineyards')
        .select('*')
        .eq('id', vineyardId)
        .maybeSingle();

      if (error) {
        console.error('❌ Database error:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setVineyard(data);
        console.log('✅ Vineyard data loaded:', data);
      }
    } catch (error) {
      console.error('❌ Error loading vineyard:', error);
    } finally {
      setLoading(false);
    }
  }, [vineyardId]);

  useEffect(() => {
    const storedVineyardId = localStorage.getItem('current_vineyard_id') || 
                            '8a7802ad-566f-417a-ad24-3df7d006ecf4';
    setVineyardId(storedVineyardId);
  }, []);

  useEffect(() => {
    if (vineyardId) {
      loadVineyardData();
    }
  }, [vineyardId, loadVineyardData]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Loading vineyard data...</p>
      </div>
    );
  }

  return (
    <div>
      <WeatherDashboard
        vineyardId={vineyard?.id}
        initialLatitude={vineyard?.latitude}
        initialLongitude={vineyard?.longitude}
        locationName={vineyard?.location}
      />
    </div>
  );
}
