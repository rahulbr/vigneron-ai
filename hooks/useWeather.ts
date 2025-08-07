// hooks/useWeather.ts
import { useState, useEffect, useCallback } from 'react';
import { weatherService } from '../lib/weatherService';

interface WeatherData {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface WeatherError {
  code: string;
  message: string;
  timestamp: Date;
}

interface UseWeatherState {
  data: WeatherData[];
  loading: boolean;
  error: WeatherError | null;
  lastUpdated: Date | null;
}

interface UseWeatherOptions {
  latitude: number;
  longitude: number;
  startDate?: string;
  endDate?: string;
  baseGDDTemp?: number;
  autoFetch?: boolean;
}

export function useWeather(options: UseWeatherOptions) {
  const [state, setState] = useState<UseWeatherState>({
    data: [],
    loading: false,
    error: null,
    lastUpdated: null
  });

  const { latitude, longitude, startDate, endDate, baseGDDTemp = 50, autoFetch = true } = options;

  const createError = (code: string, message: string): WeatherError => ({
    code,
    message,
    timestamp: new Date()
  });

  const fetchWeatherData = useCallback(async () => {
    // Don't fetch if coordinates are invalid
    if (!latitude || !longitude) {
      setState(prev => ({
        ...prev,
        error: createError('INVALID_COORDS', 'Latitude and longitude are required')
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let weatherData: WeatherData[];

      if (startDate && endDate) {
        // Fetch specific date range
        weatherData = await weatherService.getHistoricalWeather(
          latitude, 
          longitude, 
          startDate, 
          endDate, 
          baseGDDTemp
        );
      } else {
        // Fetch current growing season
        weatherData = await weatherService.getCurrentSeasonWeather(
          latitude, 
          longitude, 
          new Date().getFullYear(), 
          baseGDDTemp
        );
      }

      setState(prev => ({
        ...prev,
        data: weatherData,
        loading: false,
        error: null,
        lastUpdated: new Date()
      }));

    } catch (error) {
      let errorCode = 'WEATHER_UNAVAILABLE';
      let errorMessage = 'Weather data is currently unavailable';

      if (error instanceof Error) {
        const originalMessage = error.message;
        
        // Categorize errors with user-friendly messages
        if (originalMessage.includes('Invalid coordinates')) {
          errorCode = 'INVALID_COORDS';
          errorMessage = 'Invalid location coordinates provided';
        } else if (originalMessage.includes('Invalid date range')) {
          errorCode = 'INVALID_DATE_RANGE';
          errorMessage = 'Invalid date range specified';
        } else if (originalMessage.includes('WEATHER_UNAVAILABLE') || originalMessage.includes('RATE_LIMITED')) {
          errorCode = 'WEATHER_UNAVAILABLE';
          errorMessage = 'Weather data is temporarily unavailable. Please try again later.';
        } else if (originalMessage.includes('SERVER_ERROR')) {
          errorCode = 'SERVER_ERROR';
          errorMessage = 'Weather service is temporarily down. Please try again later.';
        } else if (originalMessage.includes('FETCH_UNAVAILABLE')) {
          errorCode = 'FETCH_UNAVAILABLE';
          errorMessage = 'Weather service is not available in this environment';
        } else if (originalMessage.includes('failed after') || originalMessage.includes('Failed to fetch')) {
          errorCode = 'NETWORK_ERROR';
          errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        } else {
          errorCode = 'WEATHER_UNAVAILABLE';
          errorMessage = 'Weather data is currently unavailable. Please try again later.';
        }
      }

      console.warn('⚠️ Weather fetch failed:', { errorCode, errorMessage });

      setState(prev => ({
        ...prev,
        loading: false,
        error: createError(errorCode, errorMessage)
      }));
    }
  }, [latitude, longitude, startDate, endDate, baseGDDTemp]);

  const retry = useCallback(() => {
    fetchWeatherData();
  }, [fetchWeatherData]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch && latitude && longitude) {
      fetchWeatherData();
    }
  }, [autoFetch, fetchWeatherData]);

  return {
    ...state,
    refetch: fetchWeatherData,
    retry,
    clearError
  };
}

// Hook for testing API connectivity
export function useWeatherConnection() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const result = await weatherService.testConnection();
      setIsConnected(result);
    } catch (error) {
      setIsConnected(false);
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    testConnection();
  }, [testConnection]);

  return {
    isConnected,
    testing,
    testConnection
  };
}