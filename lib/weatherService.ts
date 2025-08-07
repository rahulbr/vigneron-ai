// lib/weatherService.ts
interface WeatherAPIResponse {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
  error?: string;
}

interface ProcessedWeatherData {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

export class WeatherService {
  private static instance: WeatherService;
  private baseURL = 'https://archive-api.open-meteo.com/v1/era5';
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 second

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  /**
   * Calculate Growing Degree Days using the standard formula
   */
  private calculateGDD(tempHigh: number, tempLow: number, baseTemp: number = 50): number {
    const avgTemp = (tempHigh + tempLow) / 2;
    const gdd = Math.max(0, avgTemp - baseTemp);
    return Math.round(gdd * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Validate coordinates
   */
  private validateCoordinates(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180
    );
  }

  /**
   * Validate date range
   */
  private validateDateRange(startDate: string, endDate: string): boolean {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }

    // Check if start is before end
    if (start >= end) {
      return false;
    }

    // Check if dates are not in the future
    if (start > now || end > now) {
      return false;
    }

    // Check reasonable range (not more than 2 years)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 730) {
      return false;
    }

    return true;
  }

  /**
   * Sleep function for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch weather data with retry logic and proper error handling
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<WeatherAPIResponse> {
    try {
      console.log(`🌤️ Fetching weather data (attempt ${attempt}/${this.retryAttempts})`);

      // Check if we're in a browser environment and if fetch is available
      if (typeof fetch === 'undefined') {
        throw new Error('FETCH_UNAVAILABLE: Weather data service is not available in this environment');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, { 
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; VineyardApp/1.0)'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED: Weather service temporarily unavailable due to rate limiting');
        }
        if (response.status >= 500) {
          throw new Error('SERVER_ERROR: Weather service is temporarily down');
        }
        throw new Error(`API_ERROR: Weather service returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate response structure
      if (!data.daily || !data.daily.time || !Array.isArray(data.daily.time)) {
        throw new Error('INVALID_RESPONSE: Weather service returned invalid data format');
      }

      return data;
    } catch (error) {
      console.warn(`❌ Weather API attempt ${attempt} failed:`, error);

      // Don't retry for certain types of errors
      if (error instanceof Error) {
        if (error.message.includes('FETCH_UNAVAILABLE') || 
            error.message.includes('RATE_LIMITED') ||
            error.name === 'AbortError') {
          throw error;
        }
      }

      if (attempt < this.retryAttempts) {
        const delay = this.retryDelay * attempt; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.fetchWithRetry(url, attempt + 1);
      }

      // Provide user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`WEATHER_UNAVAILABLE: Weather data is temporarily unavailable. ${errorMessage}`);
    }
  }

  /**
   * Get historical weather data for a location and date range
   */
  async getHistoricalWeather(
    latitude: number, 
    longitude: number, 
    startDate: string, 
    endDate: string,
    baseGDDTemp: number = 50
  ): Promise<ProcessedWeatherData[]> {

    // Input validation
    if (!this.validateCoordinates(latitude, longitude)) {
      throw new Error(`Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180`);
    }

    if (!this.validateDateRange(startDate, endDate)) {
      throw new Error(`Invalid date range: dates must be valid, start before end, not in future, and within 2 years`);
    }

    // Construct API URL
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      start_date: startDate,
      end_date: endDate,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
      temperature_unit: 'fahrenheit',
      precipitation_unit: 'inch',
      timezone: 'auto'
    });

    const url = `${this.baseURL}?${params.toString()}`;

    try {
      const data = await this.fetchWithRetry(url);

      // Process the weather data
      const processedData: ProcessedWeatherData[] = [];

      if (!data.daily) {
        throw new Error('WEATHER_UNAVAILABLE: No weather data available from service');
      }

      const { time, temperature_2m_max, temperature_2m_min, precipitation_sum } = data.daily;

      // Validate arrays have same length
      if (time.length !== temperature_2m_max.length || 
          time.length !== temperature_2m_min.length || 
          time.length !== precipitation_sum.length) {
        throw new Error('WEATHER_UNAVAILABLE: Weather service returned inconsistent data');
      }

      for (let i = 0; i < time.length; i++) {
        const tempHigh = temperature_2m_max[i];
        const tempLow = temperature_2m_min[i];
        const rainfall = precipitation_sum[i];

        // Validate individual data points
        if (typeof tempHigh !== 'number' || typeof tempLow !== 'number' || typeof rainfall !== 'number') {
          console.warn(`⚠️ Invalid data point at index ${i}, skipping`);
          continue;
        }

        // Validate temperature ranges (reasonable for wine regions)
        if (tempHigh < -50 || tempHigh > 120 || tempLow < -50 || tempLow > 120) {
          console.warn(`⚠️ Temperature out of reasonable range at index ${i}, skipping`);
          continue;
        }

        // Ensure date is not in the future
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const pointDate = new Date(time[i]);

        if (pointDate > today) {
          console.warn(`⚠️ Future date detected at index ${i}, skipping`);
          continue;
        }

        // Calculate GDD
        const gdd = this.calculateGDD(tempHigh, tempLow, baseGDDTemp);

        processedData.push({
          date: time[i],
          temp_high: Math.round(tempHigh * 10) / 10,
          temp_low: Math.round(tempLow * 10) / 10,
          gdd: gdd,
          rainfall: Math.round(rainfall * 100) / 100
        });
      }

      if (processedData.length === 0) {
        throw new Error('WEATHER_UNAVAILABLE: No valid weather data points could be processed');
      }

      console.log(`✅ Successfully processed ${processedData.length} weather data points`);
      return processedData;

    } catch (error) {
      console.error('❌ Weather service error:', error);
      
      // Re-throw with user-friendly message if it doesn't already have one
      if (error instanceof Error && error.message.includes('WEATHER_UNAVAILABLE')) {
        throw error;
      } else {
        throw new Error('WEATHER_UNAVAILABLE: Weather data is currently unavailable. Please try again later.');
      }
    }
  }

  /**
   * Get current growing season data (March 1 to November 30)
   */
  async getCurrentSeasonWeather(
    latitude: number, 
    longitude: number, 
    year: number = new Date().getFullYear(),
    baseGDDTemp: number = 50
  ): Promise<ProcessedWeatherData[]> {

    const startDate = `${year}-03-01`;
    const endDate = `${year}-11-30`;

    return this.getHistoricalWeather(latitude, longitude, startDate, endDate, baseGDDTemp);
  }

  /**
   * Get weather data for a specific month
   */
  async getMonthlyWeather(
    latitude: number, 
    longitude: number, 
    year: number, 
    month: number,
    baseGDDTemp: number = 50
  ): Promise<ProcessedWeatherData[]> {

    if (month < 1 || month > 12) {
      throw new Error('Month must be between 1 and 12');
    }

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;

    // Calculate last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    return this.getHistoricalWeather(latitude, longitude, startDate, endDate, baseGDDTemp);
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple request for recent data
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - 7); // 7 days ago
      const startDate = testDate.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      await this.getHistoricalWeather(37.7749, -122.4194, startDate, endDate); // San Francisco
      return true;
    } catch (error) {
      console.error('Weather API connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const weatherService = WeatherService.getInstance();