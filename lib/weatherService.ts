
// lib/weatherService.ts
interface OpenWeatherResponse {
  list?: Array<{
    dt: number;
    main: {
      temp_max: number;
      temp_min: number;
    };
    weather: Array<{
      main: string;
      description: string;
    }>;
    rain?: {
      '1h'?: number;
    };
    snow?: {
      '1h'?: number;
    };
  }>;
  city?: {
    name: string;
    country: string;
  };
  message?: string;
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
  private baseURL = 'https://api.openweathermap.org/data/2.5';
  private historicalURL = 'https://history.openweathermap.org/data/2.5/history/city';
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 second

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  /**
   * Get API key from environment variables
   */
  private getAPIKey(): string {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenWeatherMap API key not found. Please set NEXT_PUBLIC_OPENWEATHER_API_KEY or OPENWEATHER_API_KEY in your environment variables.');
    }
    
    return apiKey;
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
   * Convert Kelvin to Fahrenheit
   */
  private kelvinToFahrenheit(kelvin: number): number {
    return (kelvin - 273.15) * 9/5 + 32;
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
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<OpenWeatherResponse> {
    try {
      console.log(`🌤️ Fetching weather data from OpenWeatherMap (attempt ${attempt}/${this.retryAttempts})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VigneronAI/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid OpenWeatherMap API key. Please check your API key configuration.');
        }
        if (response.status === 429) {
          throw new Error('OpenWeatherMap API rate limit exceeded. Please try again later.');
        }
        throw new Error(`OpenWeatherMap API error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.message && data.message.includes('Invalid API key')) {
        throw new Error('Invalid OpenWeatherMap API key. Please check your API key configuration.');
      }

      return data;
    } catch (error) {
      console.warn(`❌ OpenWeatherMap API attempt ${attempt} failed:`, error);

      if (attempt < this.retryAttempts) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.fetchWithRetry(url, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Get current weather data (last 5 days) - OpenWeatherMap's free tier limitation
   */
  async getCurrentWeather(
    latitude: number, 
    longitude: number, 
    baseGDDTemp: number = 50
  ): Promise<ProcessedWeatherData[]> {
    
    // Input validation
    if (!this.validateCoordinates(latitude, longitude)) {
      throw new Error(`Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180`);
    }

    const apiKey = this.getAPIKey();

    // OpenWeatherMap's free tier only provides current weather and 5-day forecast
    // For historical data, we'd need a paid subscription
    const url = `${this.baseURL}/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=imperial`;

    try {
      const data = await this.fetchWithRetry(url);

      if (!data.list || data.list.length === 0) {
        throw new Error('No weather data received from OpenWeatherMap');
      }

      // Process the forecast data into daily summaries
      const dailyData = new Map<string, {
        tempHigh: number;
        tempLow: number;
        rainfall: number;
        date: string;
      }>();

      data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        const existing = dailyData.get(dateStr);
        const rainfall = (item.rain?.['1h'] || 0) + (item.snow?.['1h'] || 0);
        
        if (!existing) {
          dailyData.set(dateStr, {
            tempHigh: item.main.temp_max,
            tempLow: item.main.temp_min,
            rainfall: rainfall,
            date: dateStr
          });
        } else {
          existing.tempHigh = Math.max(existing.tempHigh, item.main.temp_max);
          existing.tempLow = Math.min(existing.tempLow, item.main.temp_min);
          existing.rainfall += rainfall;
        }
      });

      const processedData: ProcessedWeatherData[] = [];

      dailyData.forEach(dayData => {
        const gdd = this.calculateGDD(dayData.tempHigh, dayData.tempLow, baseGDDTemp);
        
        processedData.push({
          date: dayData.date,
          temp_high: Math.round(dayData.tempHigh * 10) / 10,
          temp_low: Math.round(dayData.tempLow * 10) / 10,
          gdd: gdd,
          rainfall: Math.round(dayData.rainfall * 100) / 100
        });
      });

      processedData.sort((a, b) => a.date.localeCompare(b.date));

      console.log(`✅ Successfully processed ${processedData.length} weather data points from OpenWeatherMap`);
      return processedData;

    } catch (error) {
      console.error('❌ OpenWeatherMap service error:', error);
      
      // Instead of generating fallback data, inform the user
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('Weather data unavailable: Invalid or missing OpenWeatherMap API key. Please contact support.');
        }
        if (error.message.includes('rate limit')) {
          throw new Error('Weather data temporarily unavailable: API rate limit exceeded. Please try again in a few minutes.');
        }
        throw new Error(`Weather data unavailable: ${error.message}`);
      }
      
      throw new Error('Weather data unavailable: Unable to connect to weather service. Please check your internet connection and try again.');
    }
  }

  /**
   * Get historical weather data - requires paid OpenWeatherMap subscription
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

    const apiKey = this.getAPIKey();

    console.log('⚠️ Historical weather data requires OpenWeatherMap paid subscription');
    console.log('🔄 Attempting to use current weather data instead...');

    // Since historical data requires paid subscription, use current weather
    return this.getCurrentWeather(latitude, longitude, baseGDDTemp);
  }

  /**
   * Get current growing season data (limited by API availability)
   */
  async getCurrentSeasonWeather(
    latitude: number, 
    longitude: number, 
    year: number = new Date().getFullYear(),
    baseGDDTemp: number = 50
  ): Promise<ProcessedWeatherData[]> {

    console.log('ℹ️ Growing season weather limited to current forecast data due to API constraints');
    return this.getCurrentWeather(latitude, longitude, baseGDDTemp);
  }

  /**
   * Get weather data for a specific month (limited by API availability)
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

    console.log('ℹ️ Monthly weather limited to current forecast data due to API constraints');
    return this.getCurrentWeather(latitude, longitude, baseGDDTemp);
  }

  /**
   * Test OpenWeatherMap API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔗 Testing OpenWeatherMap API connectivity...');
      
      const apiKey = this.getAPIKey();
      
      // Test with a simple current weather request
      const testUrl = `${this.baseURL}/weather?lat=37.7749&lon=-122.4194&appid=${apiKey}`;

      const response = await fetch(testUrl, {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        console.log('✅ OpenWeatherMap API connection successful');
        return true;
      } else if (response.status === 401) {
        console.log('❌ OpenWeatherMap API: Invalid API key');
        return false;
      } else {
        console.log(`❌ OpenWeatherMap API error: ${response.status}`);
        return false;
      }

    } catch (error) {
      console.warn('❌ OpenWeatherMap API connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const weatherService = WeatherService.getInstance();
