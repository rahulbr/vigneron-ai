// lib/weather.ts
interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  gdd: number;
  rainfall: number;
}

interface WeatherResponse {
  days: WeatherDay[];
}

interface LocationCoords {
  lat: number;
  lon: number;
  name: string;
  state: string;
}

export async function getWeatherData(lat: number, lon: number, startDate: Date | null = null): Promise<WeatherResponse> {
  // Try both environment variable names
  const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;

  console.log('🌤️ getWeatherData called with:', { lat, lon, hasApiKey: !!API_KEY });

  if (!startDate) {
    startDate = new Date();
    startDate.setMonth(3); // April (0-indexed)
    startDate.setDate(1);
  }

  if (!API_KEY) {
    console.warn('❌ No OpenWeather API key, using mock data');
    return generateMockWeatherData(startDate);
  }

  try {
    console.log('📡 Fetching real weather data...');

    // Get current weather and 5-day forecast
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`;

    console.log('📡 Current weather URL:', currentUrl.replace(API_KEY, 'API_KEY_HIDDEN'));
    console.log('📡 Forecast URL:', forecastUrl.replace(API_KEY, 'API_KEY_HIDDEN'));

    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl)
    ]);

    console.log('📡 API Response status:', { 
      current: currentResponse.status, 
      forecast: forecastResponse.status 
    });

    if (!currentResponse.ok || !forecastResponse.ok) {
      throw new Error(`Weather API error: current=${currentResponse.status}, forecast=${forecastResponse.status}`);
    }

    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();

    console.log('✅ Real weather data fetched for:', currentData.name);
    console.log('📊 Current weather:', {
      temp: currentData.main.temp,
      tempMax: currentData.main.temp_max,
      tempMin: currentData.main.temp_min,
      description: currentData.weather[0].description
    });

    // Combine current + forecast + historical mock data
    const weatherDays = await buildWeatherDataset(currentData, forecastData, startDate);

    console.log('📈 Built weather dataset:', { totalDays: weatherDays.length });

    return { days: weatherDays };
  } catch (error) {
    console.error('❌ Weather API error:', error);
    console.log('🔄 Falling back to mock data');
    return generateMockWeatherData(startDate);
  }
}

async function buildWeatherDataset(currentData: any, forecastData: any, startDate: Date): Promise<WeatherDay[]> {
  const days: WeatherDay[] = [];
  const today = new Date();

  // 1. Generate historical mock data from startDate to yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const currentDate = new Date(startDate);
  while (currentDate < yesterday) {
    const dayOfYear = Math.floor((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

    // Simulate realistic temperature progression through growing season
    const baseTempHigh = 60 + Math.sin((dayOfYear - 90) / 365 * 2 * Math.PI) * 20 + Math.random() * 10;
    const baseTempLow = baseTempHigh - 20 - Math.random() * 10;
    const gdd = calculateGDD(baseTempHigh, baseTempLow);

    days.push({
      date: new Date(currentDate).toISOString().split('T')[0],
      temp_high: Math.round(baseTempHigh),
      temp_low: Math.round(baseTempLow),
      gdd: Math.round(gdd * 10) / 10,
      rainfall: Math.random() < 0.3 ? Math.random() * 0.5 : 0
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 2. Add today's actual weather
  const todayHigh = currentData.main.temp_max;
  const todayLow = currentData.main.temp_min;
  const todayGDD = calculateGDD(todayHigh, todayLow);

  days.push({
    date: today.toISOString().split('T')[0],
    temp_high: Math.round(todayHigh),
    temp_low: Math.round(todayLow),
    gdd: Math.round(todayGDD * 10) / 10,
    rainfall: 0 // Current API doesn't give daily rainfall easily
  });

  // 3. Add forecast data (next 5 days)
  const dailyForecasts = groupForecastByDay(forecastData.list);
  for (const [dateStr, forecasts] of Object.entries(dailyForecasts)) {
    const temps = forecasts.map((f: any) => f.main.temp);
    const tempHigh = Math.max(...temps);
    const tempLow = Math.min(...temps);
    const gdd = calculateGDD(tempHigh, tempLow);

    days.push({
      date: dateStr,
      temp_high: Math.round(tempHigh),
      temp_low: Math.round(tempLow),
      gdd: Math.round(gdd * 10) / 10,
      rainfall: 0
    });
  }

  return days;
}

function groupForecastByDay(forecastList: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  forecastList.forEach(forecast => {
    const date = forecast.dt_txt.split(' ')[0]; // Extract date part
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(forecast);
  });

  return grouped;
}

export function calculateGDD(tempHigh: number, tempLow: number, baseTemp: number = 50): number {
  // Standard GDD calculation for wine grapes
  const avgTemp = (tempHigh + tempLow) / 2;
  const gdd = Math.max(0, avgTemp - baseTemp);
  return gdd;
}

export function generateMockWeatherData(startDate: Date): WeatherResponse {
  // Mock data for development - simulates Northern California spring weather
  const days = [];
  const currentDate = new Date(startDate);
  const today = new Date();

  while (currentDate <= today) {
    const dayOfYear = Math.floor((currentDate - new Date(currentDate.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));

    // Simulate realistic temperature progression through growing season
    const baseTempHigh = 60 + Math.sin((dayOfYear - 90) / 365 * 2 * Math.PI) * 20 + Math.random() * 10;
    const baseTempLow = baseTempHigh - 20 - Math.random() * 10;

    const gdd = calculateGDD(baseTempHigh, baseTempLow);

    days.push({
      date: new Date(currentDate).toISOString().split('T')[0],
      temp_high: Math.round(baseTempHigh),
      temp_low: Math.round(baseTempLow),
      gdd: Math.round(gdd * 10) / 10,
      rainfall: Math.random() < 0.3 ? Math.random() * 0.5 : 0 // 30% chance of rain
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { days };
}

// Get location coordinates from zip code or city name
export async function getCoordinates(location: string): Promise<LocationCoords> {
  const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

  // If no API key, use fallback immediately
  if (!API_KEY) {
    console.warn('No OpenWeather API key found, using fallback location');
    return getFallbackLocation(location);
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${API_KEY}`
    );

    if (!response.ok) {
      console.warn(`Geocoding API returned ${response.status}, using fallback`);
      return getFallbackLocation(location);
    }

    const data = await response.json();

    if (data.length > 0) {
      console.log(`✅ Found coordinates for ${location}:`, data[0]);
      return {
        lat: data[0].lat,
        lon: data[0].lon,
        name: data[0].name,
        state: data[0].state || data[0].country
      };
    }

    console.warn(`No results found for "${location}", using fallback`);
    return getFallbackLocation(location);
  } catch (error) {
    console.warn('Geocoding error:', error, '- using fallback location');
    return getFallbackLocation(location);
  }
}

// Fallback locations for common wine regions
function getFallbackLocation(location: string): LocationCoords {
  const fallbacks: Record<string, LocationCoords> = {
    'napa': { lat: 38.2975, lon: -122.2869, name: 'Napa', state: 'CA' },
    'sonoma': { lat: 38.2919, lon: -122.4580, name: 'Sonoma', state: 'CA' },
    'paso robles': { lat: 35.6269, lon: -120.6906, name: 'Paso Robles', state: 'CA' },
    'santa barbara': { lat: 34.4208, lon: -119.6982, name: 'Santa Barbara', state: 'CA' },
    'willamette': { lat: 45.3311, lon: -123.0351, name: 'Willamette Valley', state: 'OR' },
    'walla walla': { lat: 46.0645, lon: -118.3430, name: 'Walla Walla', state: 'WA' }
  };

  // Check if location matches any fallback
  const locationLower = location.toLowerCase();
  for (const [key, coords] of Object.entries(fallbacks)) {
    if (locationLower.includes(key)) {
      console.log(`📍 Using fallback coordinates for ${key.toUpperCase()}:`, coords);
      return coords;
    }
  }

  // Default to Napa Valley
  console.log('📍 Using default fallback: Napa Valley, CA');
  return fallbacks.napa;
}