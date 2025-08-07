
import { useState, useEffect, useCallback } from 'react';
import { WeatherDashboard } from '../components/WeatherDashboard';
import { supabase } from '../lib/supabase';

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
