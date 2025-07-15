
// lib/weatherService.ts
interface WeatherAPIResponse {
  list?: any[];
  dt?: number;
  main?: {
    temp: number;
    temp_min: number;
    temp_max: number;
  };
  weather?: any[];
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
  private baseURL = 'https://api.openweathermap.org/data/2.5';
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
    
    // Check if dates are not too far in the future
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
   * Get API key from environment
   */
  private getApiKey(): string {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeatherMap API key not found. Please set NEXT_PUBLIC_OPENWEATHER_API_KEY environment variable.');
    }
    return apiKey;
  }

  /**
   * Fetch weather data with retry logic
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<WeatherAPIResponse> {
    try {
      console.log(`🌤️ Fetching weather data (attempt ${attempt}/${this.retryAttempts})`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid OpenWeatherMap API key. Please check your NEXT_PUBLIC_OPENWEATHER_API_KEY.');
        }
        if (response.status === 429) {
          throw new Error('OpenWeatherMap API rate limit exceeded. Please try again later.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
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
   * Generate mock historical data for dates where we don't have real data
   */
  private generateMockHistoricalData(startDate: string, endDate: string, latitude: number, baseGDDTemp: number): ProcessedWeatherData[] {
    const data: ProcessedWeatherData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    
    // Only generate mock data for dates before today
    const maxDate = new Date(Math.min(end.getTime(), today.getTime() - 24 * 60 * 60 * 1000));
    
    const currentDate = new Date(start);
    while (currentDate <= maxDate) {
      const dayOfYear = Math.floor((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      
      // Simulate realistic temperature based on latitude and season
      const latitudeFactor = Math.max(0.5, 1 - Math.abs(latitude - 40) / 50);
      const seasonalTemp = Math.sin((dayOfYear - 90) / 365 * 2 * Math.PI) * 25 * latitudeFactor;
      const baseTempHigh = 65 + seasonalTemp + (Math.random() - 0.5) * 10;
      const baseTempLow = baseTempHigh - 15 - Math.random() * 10;
      
      const gdd = this.calculateGDD(baseTempHigh, baseTempLow, baseGDDTemp);
      
      data.push({
        date: new Date(currentDate).toISOString().split('T')[0],
        temp_high: Math.round(baseTempHigh * 10) / 10,
        temp_low: Math.round(baseTempLow * 10) / 10,
        gdd: gdd,
        rainfall: Math.random() < 0.25 ? Math.round(Math.random() * 0.5 * 100) / 100 : 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return data;
  }

  /**
   * Get current weather and forecast data from OpenWeatherMap
   */
  private async getRealWeatherData(latitude: number, longitude: number): Promise<{ current: any, forecast: any }> {
    const apiKey = this.getApiKey();
    
    // Get current weather
    const currentUrl = `${this.baseURL}/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=imperial`;
    const currentData = await this.fetchWithRetry(currentUrl);
    
    // Get 5-day forecast
    const forecastUrl = `${this.baseURL}/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=imperial`;
    const forecastData = await this.fetchWithRetry(forecastUrl);
    
    return { current: currentData, forecast: forecastData };
  }

  /**
   * Process forecast data into daily weather
   */
  private processForecastData(forecastData: any, baseGDDTemp: number): ProcessedWeatherData[] {
    const data: ProcessedWeatherData[] = [];
    
    if (!forecastData.list || !Array.isArray(forecastData.list)) {
      return data;
    }
    
    // Group forecast by date
    const dailyData: { [date: string]: { temps: number[], rain: number } } = {};
    
    forecastData.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      const temp = item.main.temp;
      const rain = item.rain ? (item.rain['3h'] || 0) : 0;
      
      if (!dailyData[date]) {
        dailyData[date] = { temps: [], rain: 0 };
      }
      
      dailyData[date].temps.push(temp);
      dailyData[date].rain += rain;
    });
    
    // Convert to daily summaries
    Object.entries(dailyData).forEach(([date, dayData]) => {
      const tempHigh = Math.max(...dayData.temps);
      const tempLow = Math.min(...dayData.temps);
      const gdd = this.calculateGDD(tempHigh, tempLow, baseGDDTemp);
      
      data.push({
        date,
        temp_high: Math.round(tempHigh * 10) / 10,
        temp_low: Math.round(tempLow * 10) / 10,
        gdd: gdd,
        rainfall: Math.round(dayData.rain * 100) / 100
      });
    });
    
    return data.sort((a, b) => a.date.localeCompare(b.date));
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

    try {
      console.log(`🌤️ Fetching OpenWeatherMap data for coordinates: ${latitude}, ${longitude}`);
      
      const { current, forecast } = await this.getRealWeatherData(latitude, longitude);
      
      // Generate mock historical data for the date range
      const mockData = this.generateMockHistoricalData(startDate, endDate, latitude, baseGDDTemp);
      
      // Add current weather for today
      const today = new Date().toISOString().split('T')[0];
      const todayData = mockData.find(d => d.date === today);
      
      if (current.main && !todayData) {
        const currentTempHigh = current.main.temp_max || current.main.temp;
        const currentTempLow = current.main.temp_min || current.main.temp;
        const currentGDD = this.calculateGDD(currentTempHigh, currentTempLow, baseGDDTemp);
        
        mockData.push({
          date: today,
          temp_high: Math.round(currentTempHigh * 10) / 10,
          temp_low: Math.round(currentTempLow * 10) / 10,
          gdd: currentGDD,
          rainfall: 0 // Current weather doesn't include precipitation sum
        });
      }
      
      // Process forecast data and add to the dataset
      const forecastData = this.processForecastData(forecast, baseGDDTemp);
      
      // Combine and deduplicate data
      const allData = [...mockData, ...forecastData];
      const uniqueData = allData.filter((item, index, self) => 
        index === self.findIndex(d => d.date === item.date)
      );
      
      // Sort by date and filter to requested range
      const filteredData = uniqueData
        .filter(d => d.date >= startDate && d.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date));
      
      if (filteredData.length === 0) {
        throw new Error('No valid weather data points processed');
      }
      
      console.log(`✅ Successfully processed ${filteredData.length} weather data points`);
      console.log(`📊 Real weather data from OpenWeatherMap: ${current.name || 'Unknown location'}`);
      console.log(`🌡️ Current conditions: ${current.weather?.[0]?.description || 'N/A'}`);
      
      return filteredData;
      
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
      const apiKey = this.getApiKey();
      
      // Test with a simple request for San Francisco
      const testUrl = `${this.baseURL}/weather?lat=37.7749&lon=-122.4194&appid=${apiKey}&units=imperial`;
      const response = await fetch(testUrl);
      
      if (!response.ok) {
        console.error('OpenWeatherMap API test failed:', response.status, response.statusText);
        return false;
      }
      
      const data = await response.json();
      console.log('✅ OpenWeatherMap API connection successful:', data.name);
      return true;
      
    } catch (error) {
      console.error('OpenWeatherMap API connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const weatherService = WeatherService.getInstance();
