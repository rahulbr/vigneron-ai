// hooks/useWeather.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WeatherData } from '../lib/weather';
import { WeatherService } from '../lib/weatherService';

// In-memory cache for weather data
const weatherCache = new Map<string, { data: WeatherData[]; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

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
  const [data, setData] = useState<WeatherData[]>([]);
  const [loading, setIsLoading] = useState(false);
  const [error, setError] = useState<WeatherError | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { latitude, longitude, startDate, endDate, baseGDDTemp = 50, autoFetch = true } = options;

  const createError = (code: string, message: string): WeatherError => ({
    code,
    message,
    timestamp: new Date()
  });

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_DELAY = 500; // ms

  const fetchWeatherData = useCallback(async (lat: number, lon: number, startDate?: string, endDate?: string) => {
    // Create cache key
    const cacheKey = `${lat.toFixed(4)}-${lon.toFixed(4)}-${startDate || 'null'}-${endDate || 'null'}`;
    const cached = weatherCache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('🚀 Using cached weather data');
      setData(cached.data);
      setIsLoading(false);
      setLastUpdated(new Date(cached.timestamp)); // Reflect the cached timestamp
      setError(null); // Clear any previous errors
      return cached.data;
    }

    // Don't fetch if coordinates are invalid
    if (!lat || !lon) {
      setError(createError('INVALID_COORDS', 'Latitude and longitude are required'));
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      let weatherData: WeatherData[];

      if (startDate && endDate) {
        // Fetch specific date range
        weatherData = await weatherService.getHistoricalWeather(
          lat,
          lon,
          startDate,
          endDate,
          baseGDDTemp
        );
      } else {
        // Fetch current growing season
        weatherData = await weatherService.getCurrentSeasonWeather(
          lat,
          lon,
          new Date().getFullYear(),
          baseGDDTemp
        );
      }

      console.log('✅ Successfully processed', weatherData.length, 'weather data points');

      // Cache the successful response
      weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });

      setData(weatherData);
      setIsLoading(false);
      setLastUpdated(new Date());
      return weatherData;

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

      setError(createError(errorCode, errorMessage));
      setIsLoading(false);
      return [];
    }
  }, [baseGDDTemp]); // baseGDDTemp is now a dependency

  // Debounced fetch function
  const debouncedFetchWeatherData = useCallback((lat: number, lon: number, startDate?: string, endDate?: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchWeatherData(lat, lon, startDate, endDate);
    }, DEBOUNCE_DELAY);
  }, [fetchWeatherData]);

  const retry = useCallback(() => {
    debouncedFetchWeatherData(latitude, longitude, startDate, endDate);
  }, [debouncedFetchWeatherData, latitude, longitude, startDate, endDate]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount and when dependencies change, using the debounced function
  useEffect(() => {
    if (autoFetch && latitude && longitude) {
      debouncedFetchWeatherData(latitude, longitude, startDate, endDate);
    }
    // Cleanup the timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autoFetch, debouncedFetchWeatherData, latitude, longitude, startDate, endDate]);

  // Refetch function that bypasses debounce
  const refetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    fetchWeatherData(latitude, longitude, startDate, endDate);
  }, [fetchWeatherData, latitude, longitude, startDate, endDate]);


  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
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
      const result = await WeatherService.testConnection(); // Use WeatherService directly
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