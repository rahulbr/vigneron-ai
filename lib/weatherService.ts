// lib/weatherService.ts
import { weatherCache } from './weatherCache';

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
   * Fetch weather data with retry logic
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<WeatherAPIResponse> {
    try {
      console.log(`🌤️ Fetching weather data (attempt ${attempt}/${this.retryAttempts})`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate response structure
      if (!data.daily || !data.daily.time || !Array.isArray(data.daily.time)) {
        throw new Error('Invalid API response structure');
      }

      return data;
    } catch (error) {
      console.warn(`❌ Weather API attempt ${attempt} failed:`, error);

      if (attempt < this.retryAttempts) {
        const delay = this.retryDelay * attempt; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.fetchWithRetry(url, attempt + 1);
      }

      throw new Error(`Weather API failed after ${this.retryAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // Check cache first
    const cacheKey = `${latitude}_${longitude}`;
    const cachedData = weatherCache.get(cacheKey, startDate, endDate);
    if (cachedData) {
      return cachedData;
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
        throw new Error('No daily weather data received');
      }

      const { time, temperature_2m_max, temperature_2m_min, precipitation_sum } = data.daily;

      // Validate arrays have same length
      if (time.length !== temperature_2m_max.length || 
          time.length !== temperature_2m_min.length || 
          time.length !== precipitation_sum.length) {
        throw new Error('Inconsistent weather data arrays');
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

        // Validate data point and ensure date is not in the future
        const isValidDataPoint = (point: any): boolean => {
          const today = new Date();
          today.setHours(23, 59, 59, 999); // End of today
          const pointDate = new Date(point.date);

          return (
            point &&
            typeof point.temp_high === 'number' &&
            typeof point.temp_low === 'number' &&
            !isNaN(point.temp_high) &&
            !isNaN(point.temp_low) &&
            point.temp_high >= -50 &&
            point.temp_high <= 60 &&
            point.temp_low >= -50 &&
            point.temp_low <= 60 &&
            pointDate <= today // Ensure date is not in the future
          );
        };

        // Calculate GDD
        const gdd = this.calculateGDD(tempHigh, tempLow, baseGDDTemp);

        processedData.push({
          date: time[i],
          temp_high: Math.round(tempHigh * 10) / 10,
          temp_low: Math.round(tempLow * 10) / 10,
          gdd: gdd,
          rainfall: Math.round(rainfall * 100) / 100 // Round to 2 decimal places
        });
      }

      if (processedData.length === 0) {
        throw new Error('No valid weather data points processed');
      }

      console.log(`✅ Successfully processed ${processedData.length} weather data points`);
      
      // Cache the processed data
      const cacheKey = `${latitude}_${longitude}`;
      weatherCache.set(cacheKey, startDate, endDate, processedData);
      
      return processedData;

    } catch (error) {
      console.error('❌ Weather service error:', error);
      throw error;
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