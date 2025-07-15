// lib/weatherService.ts - Open-Meteo with real historical data
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
  private retryDelay = 1000;

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
    return Math.round(gdd * 10) / 10;
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

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }

    if (start >= end) {
      return false;
    }

    // ERA5 data is available from 1940 to near-present
    const minDate = new Date('1940-01-01');
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() - 5); // ERA5 has ~5 day delay

    if (start < minDate || end > maxDate) {
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
   * Convert Celsius to Fahrenheit
   */
  private celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9/5) + 32;
  }

  /**
   * Fetch weather data with retry logic
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<WeatherAPIResponse> {
    try {
      console.log(`🌤️ Fetching Open-Meteo ERA5 data (attempt ${attempt}/${this.retryAttempts})`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid API response structure');
      }

      return data;
    } catch (error) {
      console.warn(`❌ Open-Meteo API attempt ${attempt} failed:`, error);

      if (attempt < this.retryAttempts) {
        const delay = this.retryDelay * attempt;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.fetchWithRetry(url, attempt + 1);
      }

      throw new Error(`Open-Meteo API failed after ${this.retryAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get real historical weather data from Open-Meteo ERA5
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
      throw new Error(`Invalid date range: dates must be valid, start before end, and within ERA5 availability (1940 to ~5 days ago)`);
    }

    try {
      console.log(`🌤️ Fetching real ERA5 historical data for coordinates: ${latitude}, ${longitude}`);
      console.log(`📅 Date range: ${startDate} to ${endDate}`);

      // Build Open-Meteo ERA5 API URL
      const url = `${this.baseURL}?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

      console.log(`📡 Open-Meteo URL: ${url}`);

      const data = await this.fetchWithRetry(url);

      if (!data.daily || !data.daily.time || !Array.isArray(data.daily.time)) {
        throw new Error('Invalid Open-Meteo response: missing daily data');
      }

      const processedData: ProcessedWeatherData[] = [];

      for (let i = 0; i < data.daily.time.length; i++) {
        const date = data.daily.time[i];
        const tempMaxC = data.daily.temperature_2m_max[i];
        const tempMinC = data.daily.temperature_2m_min[i];
        const precipitationMm = data.daily.precipitation_sum[i] || 0;

        // Convert to Fahrenheit
        const tempHighF = this.celsiusToFahrenheit(tempMaxC);
        const tempLowF = this.celsiusToFahrenheit(tempMinC);

        // Convert precipitation from mm to inches
        const rainfallInches = precipitationMm * 0.0393701;

        const gdd = this.calculateGDD(tempHighF, tempLowF, baseGDDTemp);

        processedData.push({
          date: date,
          temp_high: Math.round(tempHighF * 10) / 10,
          temp_low: Math.round(tempLowF * 10) / 10,
          gdd: gdd,
          rainfall: Math.round(rainfallInches * 100) / 100
        });
      }

      if (processedData.length === 0) {
        throw new Error('No valid weather data points processed');
      }

      console.log(`✅ Successfully processed ${processedData.length} real historical weather data points from ERA5`);
      console.log(`📊 Real ERA5 historical weather data from Open-Meteo`);
      console.log(`🌡️ Temperature range: ${Math.min(...processedData.map(d => d.temp_low))}°F to ${Math.max(...processedData.map(d => d.temp_high))}°F`);
      console.log(`🌧️ Total rainfall: ${Math.round(processedData.reduce((sum, d) => sum + d.rainfall, 0) * 100) / 100} inches`);
      console.log(`🌱 Total GDD: ${Math.round(processedData.reduce((sum, d) => sum + d.gdd, 0) * 10) / 10}`);

      return processedData;

    } catch (error) {
      console.error('❌ Open-Meteo weather service error:', error);
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

    // For current year, end at yesterday (ERA5 has delay)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 5); // ERA5 ~5 day delay

    const endDate = year === now.getFullYear() 
      ? yesterday.toISOString().split('T')[0]
      : `${year}-11-30`;

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
      // Test with a simple request for San Francisco, last 7 days
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 5); // Account for ERA5 delay
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);

      const testUrl = `${this.baseURL}?latitude=37.7749&longitude=-122.4194&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

      const response = await fetch(testUrl);

      if (!response.ok) {
        console.error('Open-Meteo API test failed:', response.status, response.statusText);
        return false;
      }

      const data = await response.json();
      console.log('✅ Open-Meteo ERA5 API connection successful');
      return true;

    } catch (error) {
      console.error('Open-Meteo API connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const weatherService = WeatherService.getInstance();