
// lib/hybridWeatherService.ts
interface WeatherData {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface NOAAStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance: number;
}

class HybridWeatherService {
  private static instance: HybridWeatherService;
  private retryAttempts = 3;
  private retryDelay = 1000;

  static getInstance(): HybridWeatherService {
    if (!HybridWeatherService.instance) {
      HybridWeatherService.instance = new HybridWeatherService();
    }
    return HybridWeatherService.instance;
  }

  private calculateGDD(tempHigh: number, tempLow: number, baseTemp: number = 50): number {
    const avgTemp = (tempHigh + tempLow) / 2;
    const gdd = Math.max(0, avgTemp - baseTemp);
    return Math.round(gdd * 10) / 10;
  }

  private isUSLocation(latitude: number, longitude: number): boolean {
    // Continental US boundaries (approximate)
    return latitude >= 24.396308 && latitude <= 49.384358 && 
           longitude >= -125.0 && longitude <= -66.93457;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private findNearestNOAAStation(latitude: number, longitude: number): NOAAStation {
    // Major US weather stations
    const stations: NOAAStation[] = [
      { id: "USW00023234", name: "San Francisco International Airport", latitude: 37.6213, longitude: -122.3790, distance: 0 },
      { id: "USW00014739", name: "New York Central Park", latitude: 40.7794, longitude: -73.9632, distance: 0 },
      { id: "USW00012839", name: "Chicago O'Hare", latitude: 41.9742, longitude: -87.9073, distance: 0 },
      { id: "USW00023174", name: "Los Angeles International", latitude: 33.9425, longitude: -118.4081, distance: 0 },
      { id: "USW00013781", name: "Denver International", latitude: 39.8561, longitude: -104.6737, distance: 0 },
    ];

    // Calculate distances and find nearest
    stations.forEach(station => {
      station.distance = this.calculateDistance(latitude, longitude, station.latitude, station.longitude);
    });

    const nearest = stations.reduce((min, station) => 
      station.distance < min.distance ? station : min
    );

    console.log(`📍 Found nearest NOAA station: ${nearest.id} (${nearest.name})`);
    return nearest;
  }

  private async fetchNOAAData(
    latitude: number, 
    longitude: number, 
    startDate: string, 
    endDate: string
  ): Promise<WeatherData[]> {
    console.log('🇺🇸 Fetching REAL weather data from NOAA for US location');
    
    const station = this.findNearestNOAAStation(latitude, longitude);
    const year = new Date(startDate).getFullYear();
    
    try {
      // For current year (2025), there's no historical data yet
      if (year >= 2025) {
        console.log(`⚠️ Could not fetch NOAA data for year ${year}:`, {});
        return []; // Return empty array for future dates
      }

      const url = `https://www.ncei.noaa.gov/data/global-summary-of-the-day/access/${year}/${station.id}.csv`;
      
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          console.log(`🌤️ Fetching weather data (attempt ${attempt}/${this.retryAttempts})`);
          
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const csvData = await response.text();
          const processedData = this.parseNOAACSV(csvData, startDate, endDate);
          
          console.log(`✅ NOAA: Successfully processed ${processedData.length} REAL weather data points`);
          return processedData;
          
        } catch (error) {
          console.log(`❌ Weather API attempt ${attempt} failed:`, {});
          
          if (attempt < this.retryAttempts) {
            const delay = this.retryDelay * attempt;
            console.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      return [];
    } catch (error) {
      console.log(`⚠️ Could not fetch NOAA data for year ${year}:`, {});
      return [];
    }
  }

  private parseNOAACSV(csvData: string, startDate: string, endDate: string): WeatherData[] {
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    const data: WeatherData[] = [];

    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      const dateStr = values[headers.indexOf('DATE')];
      
      if (!dateStr) continue;

      const date = new Date(dateStr);
      if (date.getTime() < startTime || date.getTime() > endTime) continue;

      const tempMax = parseFloat(values[headers.indexOf('TEMP_MAX')] || values[headers.indexOf('TMAX')]);
      const tempMin = parseFloat(values[headers.indexOf('TEMP_MIN')] || values[headers.indexOf('TMIN')]);
      const precip = parseFloat(values[headers.indexOf('PRCP')] || '0');

      if (!isNaN(tempMax) && !isNaN(tempMin)) {
        // Convert from Celsius to Fahrenheit if needed
        const tempHighF = tempMax > 50 ? tempMax : (tempMax * 9/5) + 32;
        const tempLowF = tempMin > 50 ? tempMin : (tempMin * 9/5) + 32;
        const precipInches = precip > 10 ? precip / 25.4 : precip; // Convert mm to inches if needed

        data.push({
          date: date.toISOString().split('T')[0],
          temp_high: Math.round(tempHighF * 10) / 10,
          temp_low: Math.round(tempLowF * 10) / 10,
          gdd: this.calculateGDD(tempHighF, tempLowF),
          rainfall: Math.round(precipInches * 100) / 100
        });
      }
    }

    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private async fetchWeatherAPIData(
    latitude: number, 
    longitude: number, 
    startDate: string, 
    endDate: string
  ): Promise<WeatherData[]> {
    console.log('🌍 Fetching REAL weather data from WeatherAPI for global location');
    
    const apiKey = process.env.NEXT_PUBLIC_WEATHERAPI_KEY;
    if (!apiKey) {
      throw new Error('WeatherAPI key not configured');
    }

    const url = `https://api.weatherapi.com/v1/history.json?key=${apiKey}&q=${latitude},${longitude}&dt=${startDate}&end_dt=${endDate}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`WeatherAPI error: ${response.status}`);
    }

    const data = await response.json();
    const processedData: WeatherData[] = [];

    if (data.forecast?.forecastday) {
      data.forecast.forecastday.forEach((day: any) => {
        const tempHigh = day.day.maxtemp_f;
        const tempLow = day.day.mintemp_f;
        const rainfall = day.day.totalprecip_in;

        processedData.push({
          date: day.date,
          temp_high: Math.round(tempHigh * 10) / 10,
          temp_low: Math.round(tempLow * 10) / 10,
          gdd: this.calculateGDD(tempHigh, tempLow),
          rainfall: Math.round(rainfall * 100) / 100
        });
      });
    }

    console.log(`✅ WeatherAPI: Successfully processed ${processedData.length} REAL weather data points`);
    return processedData;
  }

  async getHistoricalWeather(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): Promise<WeatherData[]> {
    // Validate inputs
    if (!latitude || !longitude || !startDate || !endDate) {
      throw new Error('Invalid parameters: latitude, longitude, startDate, and endDate are required');
    }

    try {
      if (this.isUSLocation(latitude, longitude)) {
        console.log('📍 US location detected, using NOAA');
        return await this.fetchNOAAData(latitude, longitude, startDate, endDate);
      } else {
        console.log('📍 Global location detected, using WeatherAPI');
        return await this.fetchWeatherAPIData(latitude, longitude, startDate, endDate);
      }
    } catch (error) {
      console.error('❌ Hybrid weather service error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - 7);
      const startDate = testDate.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      await this.getHistoricalWeather(37.7749, -122.4194, startDate, endDate);
      return true;
    } catch (error) {
      console.error('Weather API connection test failed:', error);
      return false;
    }
  }
}

export const hybridWeatherService = HybridWeatherService.getInstance();
