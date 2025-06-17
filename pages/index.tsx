// pages/index.tsx
import { useState, useEffect } from 'react';
import { getCoordinates, getWeatherData } from '../lib/weather';
import { supabase, saveWeatherData } from '../lib/supabase';

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface LocationInfo {
  lat: number;
  lon: number;
  name: string;
  state: string;
}

export default function Home() {
  const [location, setLocation] = useState<string>('');
  const [weatherData, setWeatherData] = useState<WeatherDay[] | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [vineyardId, setVineyardId] = useState<string>('');

  // Get demo vineyard ID on load
  useEffect(() => {
    async function getDemoVineyard() {
      const { data } = await supabase
        .from('vineyards')
        .select('id')
        .limit(1)
        .single();
      if (data) setVineyardId(data.id);
    }
    getDemoVineyard();
  }, []);

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Getting coordinates for:', location);
      const coords = await getCoordinates(location);
      setLocationInfo(coords);
      console.log('Coordinates:', coords);

      console.log('Fetching real weather data...');
      const weather = await getWeatherData(coords.lat, coords.lon, new Date('2024-04-01'));
      console.log('Weather data fetched:', weather.days.length, 'days');

      // Skip database save for now to avoid conflicts
      if (vineyardId && false) { // Temporarily disabled
        console.log('Saving to database...');
        await saveWeatherData(vineyardId, weather.days);
        console.log('Saved to database successfully');
      } else {
        console.log('⏭️ Skipping database save (demo mode)');
      }

      setWeatherData(weather.days);
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const totalGDD = weatherData ? 
    weatherData.reduce((sum, day) => sum + day.gdd, 0).toFixed(1) : 0;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🍇 Vigneron.AI - Day 1 Test</h1>

      <form onSubmit={handleLocationSubmit} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter location (e.g., Napa Valley, CA)"
          style={{ padding: '10px', marginRight: '10px', width: '250px' }}
        />
        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}
        >
          {loading ? 'Loading...' : 'Get Weather Data'}
        </button>
      </form>

      {weatherData && locationInfo && (
        <div>
          <h2>✅ Success! Weather Data Loaded</h2>
          <p><strong>📍 Location:</strong> {locationInfo.name}, {locationInfo.state} ({locationInfo.lat.toFixed(4)}, {locationInfo.lon.toFixed(4)})</p>
          <p><strong>Total GDD since April 1st:</strong> {totalGDD}°F</p>
          <p><strong>Days of data:</strong> {weatherData.length}</p>
          <p><strong>Latest day:</strong> {weatherData[weatherData.length - 1]?.date}</p>
          <p><strong>Latest GDD:</strong> {weatherData[weatherData.length - 1]?.gdd}°F</p>

          <h3>Recent Weather (last 5 days):</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {weatherData.slice(-5).map((day, idx) => (
              <div key={idx} style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '5px' }}>
                <strong>{day.date}</strong><br />
                High: {day.temp_high}°F<br />
                Low: {day.temp_low}°F<br />
                GDD: {day.gdd}°F
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '40px', fontSize: '14px', color: '#666' }}>
        <h3>Day 1 Progress Checklist:</h3>
        <ul>
          <li>✅ Project setup (Next.js + Replit)</li>
          <li>✅ Weather API integration (mock data working)</li>
          <li>✅ Database setup (Supabase)</li>
          <li>✅ Basic GDD calculation</li>
          <li>🔄 Location-based weather lookup</li>
          <li>🔄 Growth curve visualization (tomorrow)</li>
        </ul>
      </div>
    </div>
  );
}