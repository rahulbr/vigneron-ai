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
      let errorCode = 'UNKNOWN_ERROR';
      let errorMessage = 'Weather data temporarily unavailable';

      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Categorize errors for farmers
        if (errorMessage.includes('Invalid coordinates')) {
          errorCode = 'INVALID_COORDS';
          errorMessage = 'Invalid vineyard location coordinates';
        } else if (errorMessage.includes('Invalid date range')) {
          errorCode = 'INVALID_DATE_RANGE';
          errorMessage = 'Invalid date range selected';
        } else if (errorMessage.includes('API key')) {
          errorCode = 'API_KEY_ERROR';
          errorMessage = 'Weather service configuration error - please contact support';
        } else if (errorMessage.includes('rate limit')) {
          errorCode = 'RATE_LIMIT_ERROR';
          errorMessage = 'Weather service temporarily unavailable - please try again in a few minutes';
        } else if (errorMessage.includes('Weather data unavailable')) {
          errorCode = 'DATA_UNAVAILABLE';
          errorMessage = errorMessage; // Use the specific message from the service
        } else if (errorMessage.includes('HTTP') || errorMessage.includes('fetch')) {
          errorCode = 'NETWORK_ERROR';
          errorMessage = 'Network connection issue - please check your internet connection';
        }
      }

      // Log the error for debugging
      console.error('Weather service error:', { errorCode, errorMessage });

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
      if (!result) {
        console.warn('❌ Weather service connection failed - check API key configuration');
      }
    } catch (error) {
      console.error('❌ Weather service connection error:', error);
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