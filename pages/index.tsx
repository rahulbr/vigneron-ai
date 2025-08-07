
import { useState, useEffect, useCallback } from 'react';
import WeatherDashboard from '../components/WeatherDashboard';
import { supabase, savePhenologyEvent, getPhenologyEvents } from '../lib/supabase';

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
      // Always try to load from database first
      console.log('🔍 Attempting to load vineyard from database...');

      const { data, error } = await supabase
        .from('vineyards')
        .select('*')
        .eq('id', vineyardId)
        .maybeSingle();

      if (error) {
        console.error('❌ Database error, creating demo vineyard:', error);
        // Create demo vineyard as fallback
        const demoVineyard: Vineyard = {
          id: vineyardId,
          name: 'Demo Vineyard - Napa Valley',
          location: 'Napa Valley, CA',
          latitude: 38.2975,
          longitude: -122.2869,
          created_at: new Date().toISOString()
        };
        setVineyard(demoVineyard);
        console.log('✅ Demo vineyard data loaded as fallback:', demoVineyard);
        setLoading(false);
        return;
      }

      if (data) {
        setVineyard(data);
        console.log('✅ Vineyard data loaded from database:', data);
      } else {
        console.log('🏗️ No vineyard found in database, creating demo vineyard');
        // Create demo vineyard if no data found
        const demoVineyard: Vineyard = {
          id: vineyardId,
          name: 'Demo Vineyard - Napa Valley',
          location: 'Napa Valley, CA',
          latitude: 38.2975,
          longitude: -122.2869,
          created_at: new Date().toISOString()
        };
        setVineyard(demoVineyard);
        console.log('✅ Demo vineyard data created:', demoVineyard);
      }
    } catch (error) {
      console.error('❌ Error loading vineyard, using demo data:', error);
      // Final fallback to demo data
      const demoVineyard: Vineyard = {
        id: vineyardId,
        name: 'Demo Vineyard - Napa Valley',
        location: 'Napa Valley, CA',
        latitude: 38.2975,
        longitude: -122.2869,
        created_at: new Date().toISOString()
      };
      setVineyard(demoVineyard);
      console.log('✅ Demo vineyard data loaded as final fallback:', demoVineyard);
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

  const handleSaveEvent = async (eventData: any) => {
    try {
      await savePhenologyEvent(
        eventData.vineyard_id,
        eventData.event_type,
        eventData.event_date,
        eventData.notes || '',
        eventData.end_date,
        eventData.harvest_block
      );
      console.log('✅ Event saved successfully');
    } catch (error) {
      console.error('❌ Failed to save event:', error);
      throw error;
    }
  };

  const handleLoadEvents = async () => {
    try {
      if (!vineyardId) return [];
      return await getPhenologyEvents(vineyardId);
    } catch (error) {
      console.error('❌ Failed to load events:', error);
      return [];
    }
  };

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

  // Don't render the dashboard until we have vineyard data
  if (!vineyard) {
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
        <p>No vineyard data available. Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <WeatherDashboard
        vineyardId={vineyard.id}
        latitude={vineyard.latitude}
        longitude={vineyard.longitude}
        locationName={vineyard.location}
        onSaveEvent={handleSaveEvent}
        onLoadEvents={handleLoadEvents}
      />
    </div>
  );
}
