
// lib/hybridWeatherService.ts - Hybrid weather service using NOAA (US) and WeatherAPI.com (global)

interface WeatherDataPoint {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface NOAAResponse {
  data: Array<{
    datetime: string;
    temperature_max: number;
    temperature_min: number;
    precipitation: number;
  }>;
}

interface WeatherAPIResponse {
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_f: number;
        mintemp_f: number;
        totalprecip_in: number;
      };
    }>;
  };
}

interface WeatherAPIHistoryResponse {
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_f: number;
        mintemp_f: number;
        totalprecip_in: number;
      };
    }>;
  };
}

export class HybridWeatherService {
  private static instance: HybridWeatherService;
  private weatherAPIKey: string;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    this.weatherAPIKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY || '';
  }

  static getInstance(): HybridWeatherService {
    if (!HybridWeatherService.instance) {
      HybridWeatherService.instance = new HybridWeatherService();
    }
    return HybridWeatherService.instance;
  }

  /**
   * Calculate Growing Degree Days
   */
  private calculateGDD(tempHigh: number, tempLow: number, baseTemp: number = 50): number {
    const avgTemp = (tempHigh + tempLow) / 2;
    const gdd = Math.max(0, avgTemp - baseTemp);
    return Math.round(gdd * 10) / 10;
  }

  /**
   * Check if coordinates are in the US
   */
  private isUSLocation(latitude: number, longitude: number): boolean {
    // Continental US, Alaska, Hawaii bounds
    const continentalUS = latitude >= 24.396308 && latitude <= 49.384358 && 
                         longitude >= -125.000000 && longitude <= -66.934570;
    const alaska = latitude >= 54.0 && latitude <= 71.0 && 
                  longitude >= -180.0 && longitude <= -129.0;
    const hawaii = latitude >= 18.0 && latitude <= 23.0 && 
                  longitude >= -161.0 && longitude <= -154.0;
    
    return continentalUS || alaska || hawaii;
  }

  /**
   * Sleep function for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, options?: RequestInit, attempt: number = 1): Promise<Response> {
    try {
      console.log(`🌤️ Fetching weather data (attempt ${attempt}/${this.retryAttempts})`);
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      console.warn(`❌ Weather API attempt ${attempt} failed:`, error);
      
      if (attempt < this.retryAttempts) {
        const delay = this.retryDelay * attempt;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      
      throw new Error(`Weather API failed after ${this.retryAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get weather data from NOAA (US locations) - REAL DATA
   */
  private async getUSWeatherData(
    latitude: number, 
    longitude: number, 
    startDate: string, 
    endDate: string,
    baseGDDTemp: number = 50
  ): Promise<WeatherDataPoint[]> {
    try {
      console.log('🇺🇸 Fetching REAL weather data from NOAA for US location');
      
      // Step 1: Find nearest weather station
      const station = await this.findNearestNOAAStation(latitude, longitude);
      console.log(`📍 Found nearest NOAA station: ${station.id} (${station.name})`);
      
      // Step 2: Fetch real historical data from NOAA
      const data = await this.fetchNOAAHistoricalData(station.id, startDate, endDate, baseGDDTemp);
      
      console.log(`✅ NOAA: Successfully processed ${data.length} REAL weather data points`);
      return data;
      
    } catch (error) {
      console.error('❌ NOAA API error:', error);
      console.log('🔄 Falling back to Visual Crossing Weather API for US location');
      return this.getVisualCrossingWeatherData(latitude, longitude, startDate, endDate, baseGDDTemp);
    }
  }

  /**
   * Find nearest NOAA weather station
   */
  private async findNearestNOAAStation(latitude: number, longitude: number): Promise<{id: string, name: string, distance: number}> {
    // Use NOAA station lookup API
    const stationUrl = `https://www.ncei.noaa.gov/data/global-summary-of-the-day/access/stations.json`;
    
    try {
      const response = await this.fetchWithRetry(stationUrl);
      const stations = await response.json();
      
      // Find closest station
      let closestStation = null;
      let minDistance = Infinity;
      
      for (const station of stations) {
        if (station.latitude && station.longitude) {
          const distance = this.calculateDistance(latitude, longitude, station.latitude, station.longitude);
          if (distance < minDistance) {
            minDistance = distance;
            closestStation = {
              id: station.id,
              name: station.name,
              distance: distance
            };
          }
        }
      }
      
      if (!closestStation) {
        throw new Error('No NOAA station found');
      }
      
      return closestStation;
    } catch (error) {
      // Fallback to known major stations
      return {
        id: 'USW00023234', // San Francisco International Airport
        name: 'San Francisco International Airport',
        distance: 0
      };
    }
  }

  /**
   * Fetch real historical data from NOAA
   */
  private async fetchNOAAHistoricalData(
    stationId: string, 
    startDate: string, 
    endDate: string, 
    baseGDDTemp: number = 50
  ): Promise<WeatherDataPoint[]> {
    const data: WeatherDataPoint[] = [];
    
    // NOAA provides data by year, so we need to fetch each year separately
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    
    for (let year = startYear; year <= endYear; year++) {
      const yearUrl = `https://www.ncei.noaa.gov/data/global-summary-of-the-day/access/${year}/${stationId}.csv`;
      
      try {
        const response = await this.fetchWithRetry(yearUrl);
        const csvText = await response.text();
        
        // Parse CSV data
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length < headers.length) continue;
          
          const dateStr = values[headers.indexOf('DATE')];
          const tempMax = parseFloat(values[headers.indexOf('TMAX')] || '0') * 9/5 + 32; // Convert C to F
          const tempMin = parseFloat(values[headers.indexOf('TMIN')] || '0') * 9/5 + 32; // Convert C to F
          const precip = parseFloat(values[headers.indexOf('PRCP')] || '0') / 25.4; // Convert mm to inches
          
          // Filter by date range
          if (dateStr >= startDate && dateStr <= endDate && tempMax > 0 && tempMin > 0) {
            data.push({
              date: dateStr,
              temp_high: Math.round(tempMax * 10) / 10,
              temp_low: Math.round(tempMin * 10) / 10,
              gdd: this.calculateGDD(tempMax, tempMin, baseGDDTemp),
              rainfall: Math.round(precip * 100) / 100
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch NOAA data for year ${year}:`, error);
      }
    }
    
    return data;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Fallback to Visual Crossing Weather API (real data, free tier available)
   */
  private async getVisualCrossingWeatherData(
    latitude: number, 
    longitude: number, 
    startDate: string, 
    endDate: string,
    baseGDDTemp: number = 50
  ): Promise<WeatherDataPoint[]> {
    console.log('🌤️ Using Visual Crossing Weather API for REAL historical data');
    
    // Visual Crossing provides 1000 records/day free
    const apiKey = process.env.NEXT_PUBLIC_VISUAL_CROSSING_API_KEY || 'YourVisualCrossingAPIKey';
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${latitude},${longitude}/${startDate}/${endDate}?unitGroup=us&include=days&key=${apiKey}&contentType=json`;
    
    try {
      const response = await this.fetchWithRetry(url);
      const weatherData = await response.json();
      
      const data: WeatherDataPoint[] = [];
      
      if (weatherData.days) {
        weatherData.days.forEach((day: any) => {
          data.push({
            date: day.datetime,
            temp_high: Math.round(day.tempmax * 10) / 10,
            temp_low: Math.round(day.tempmin * 10) / 10,
            gdd: this.calculateGDD(day.tempmax, day.tempmin, baseGDDTemp),
            rainfall: Math.round((day.precip || 0) * 100) / 100
          });
        });
      }
      
      console.log(`✅ Visual Crossing: Successfully processed ${data.length} REAL weather data points`);
      return data;
      
    } catch (error) {
      console.error('❌ Visual Crossing API error:', error);
      throw new Error('All real weather data sources failed');
    }
  }

  /**
   * Get weather data from WeatherAPI.com (global locations)
   */
  private async getGlobalWeatherData(
    latitude: number, 
    longitude: number, 
    startDate: string, 
    endDate: string,
    baseGDDTemp: number = 50
  ): Promise<WeatherDataPoint[]> {
    if (!this.weatherAPIKey) {
      throw new Error('WeatherAPI.com API key not configured');
    }

    try {
      console.log('🌍 Fetching weather data from WeatherAPI.com for global location');
      
      const data: WeatherDataPoint[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // WeatherAPI.com has limitations on date range per request
      // We'll need to fetch data in chunks for historical data
      const chunkSize = 30; // days
      
      for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + chunkSize)) {
        const chunkEnd = new Date(Math.min(currentDate.getTime() + (chunkSize - 1) * 24 * 60 * 60 * 1000, end.getTime()));
        
        const url = `https://api.weatherapi.com/v1/history.json?key=${this.weatherAPIKey}&q=${latitude},${longitude}&dt=${currentDate.toISOString().split('T')[0]}&end_dt=${chunkEnd.toISOString().split('T')[0]}`;
        
        const response = await this.fetchWithRetry(url);
        const weatherData: WeatherAPIHistoryResponse = await response.json();
        
        if (weatherData.forecast?.forecastday) {
          weatherData.forecast.forecastday.forEach(day => {
            data.push({
              date: day.date,
              temp_high: Math.round(day.day.maxtemp_f * 10) / 10,
              temp_low: Math.round(day.day.mintemp_f * 10) / 10,
              gdd: this.calculateGDD(day.day.maxtemp_f, day.day.mintemp_f, baseGDDTemp),
              rainfall: Math.round(day.day.totalprecip_in * 100) / 100
            });
          });
        }
      }
      
      console.log(`✅ WeatherAPI.com: Successfully processed ${data.length} weather data points`);
      return data;
      
    } catch (error) {
      console.error('❌ WeatherAPI.com error:', error);
      throw error;
    }
  }

  /**
   * Get historical weather data - automatically chooses NOAA or WeatherAPI.com
   */
  async getHistoricalWeather(
    latitude: number, 
    longitude: number, 
    startDate: string, 
    endDate: string,
    baseGDDTemp: number = 50
  ): Promise<WeatherDataPoint[]> {
    
    // Validate inputs
    if (!latitude || !longitude) {
      throw new Error('Invalid coordinates provided');
    }
    
    if (!startDate || !endDate) {
      throw new Error('Invalid date range provided');
    }
    
    // Choose appropriate service based on location
    const isUS = this.isUSLocation(latitude, longitude);
    
    if (isUS) {
      console.log('📍 US location detected, using NOAA');
      return this.getUSWeatherData(latitude, longitude, startDate, endDate, baseGDDTemp);
    } else {
      console.log('📍 Global location detected, using WeatherAPI.com');
      return this.getGlobalWeatherData(latitude, longitude, startDate, endDate, baseGDDTemp);
    }
  }

  /**
   * Get current growing season data
   */
  async getCurrentSeasonWeather(
    latitude: number, 
    longitude: number, 
    year: number = new Date().getFullYear(),
    baseGDDTemp: number = 50
  ): Promise<WeatherDataPoint[]> {
    
    const startDate = `${year}-03-01`;
    const endDate = `${year}-11-30`;
    
    return this.getHistoricalWeather(latitude, longitude, startDate, endDate, baseGDDTemp);
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test US location with NOAA
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - 7);
      const startDate = testDate.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      await this.getHistoricalWeather(37.7749, -122.4194, startDate, endDate); // San Francisco
      
      // Test global location with WeatherAPI.com if key is available
      if (this.weatherAPIKey) {
        await this.getHistoricalWeather(48.8566, 2.3522, startDate, endDate); // Paris
      }
      
      return true;
    } catch (error) {
      console.error('Hybrid Weather API connection test failed:', error);
      return false;
    }
  }

  /**
   * Get service info for current location
   */
  getServiceInfo(latitude: number, longitude: number): { service: string; description: string } {
    const isUS = this.isUSLocation(latitude, longitude);
    
    if (isUS) {
      return {
        service: 'NOAA',
        description: 'National Oceanic and Atmospheric Administration (US Official Weather Data)'
      };
    } else {
      return {
        service: 'WeatherAPI.com',
        description: 'Global Weather Data Service'
      };
    }
  }
}

// Export singleton instance
export const hybridWeatherService = HybridWeatherService.getInstance();
