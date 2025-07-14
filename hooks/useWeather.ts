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

      // Validate and process the data
      const processedData = validateWeatherData(weatherData);

      if (processedData.length === 0) {
        throw new Error('No valid weather data available for the selected period. Please check your date range and try again.');
      }

      // Additional validation for data quality
      const invalidCount = weatherData.length - processedData.length;
      if (invalidCount > 0) {
        console.warn(`⚠️ Filtered out ${invalidCount} invalid data points out of ${weatherData.length} total`);
      }

      setState(prev => ({
        ...prev,
        data: processedData,
        loading: false,
        error: null,
        lastUpdated: new Date()
      }));

    } catch (error) {
      let errorCode = 'UNKNOWN_ERROR';
      let errorMessage = 'An unknown error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Categorize errors
        if (errorMessage.includes('Invalid coordinates')) {
          errorCode = 'INVALID_COORDS';
        } else if (errorMessage.includes('Invalid date range')) {
          errorCode = 'INVALID_DATE_RANGE';
        } else if (errorMessage.includes('HTTP')) {
          errorCode = 'API_ERROR';
        } else if (errorMessage.includes('failed after')) {
          errorCode = 'NETWORK_ERROR';
        } else if (errorMessage.includes('Invalid API response')) {
          errorCode = 'DATA_FORMAT_ERROR';
        }
      }

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

// Basic data validation function
function validateWeatherData(data: WeatherData[]): WeatherData[] {
  return data.filter(item => {
    // Check if temp_high, temp_low, gdd, and rainfall are valid numbers
    const isValid =
      typeof item.temp_high === 'number' && !isNaN(item.temp_high) &&
      typeof item.temp_low === 'number' && !isNaN(item.temp_low) &&
      typeof item.gdd === 'number' && !isNaN(item.gdd) &&
      typeof item.rainfall === 'number' && !isNaN(item.rainfall);

    return isValid;
  });
}