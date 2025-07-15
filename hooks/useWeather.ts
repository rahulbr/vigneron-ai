// hooks/useWeather.ts - Updated for real Open-Meteo data
import { useState, useEffect } from 'react';
import { weatherService } from '../lib/weatherService';

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface UseWeatherReturn {
  weatherData: WeatherDay[];
  loading: boolean;
  error: string | null;
  totalGDD: number;
  refetch: () => void;
}

export function useWeatherConnection() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const connected = await weatherService.testConnection();
      setIsConnected(connected);
    } catch (error) {
      console.error('Connection test failed:', error);
      setIsConnected(false);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return { isConnected, testing, testConnection };
}

export function useWeather(
  latitude: number | null, 
  longitude: number | null,
  baseGDDTemp: number = 50
): UseWeatherReturn {
  const [weatherData, setWeatherData] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherData = async () => {
    if (!latitude || !longitude) {
      setWeatherData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🌤️ Fetching real historical weather data for: ${latitude}, ${longitude}`);

      // Get current growing season (March 1 to present, with ERA5 delay)
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-03-01`;

      // End 5 days ago to account for ERA5 data delay
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 5);
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`📅 Fetching ERA5 data from ${startDate} to ${endDateStr}`);

      const data = await weatherService.getHistoricalWeather(
        latitude, 
        longitude, 
        startDate, 
        endDateStr,
        baseGDDTemp
      );

      setWeatherData(data);
      console.log(`✅ Loaded ${data.length} days of real historical weather data`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch weather data';
      console.error('❌ Weather fetch error:', errorMessage);
      setError(errorMessage);
      setWeatherData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
  }, [latitude, longitude, baseGDDTemp]);

  const totalGDD = weatherData.reduce((sum, day) => sum + day.gdd, 0);

  return {
    weatherData,
    loading,
    error,
    totalGDD: Math.round(totalGDD * 10) / 10,
    refetch: fetchWeatherData
  };
}