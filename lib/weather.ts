// lib/weather.ts - Built from scratch with Google Geocoding + OpenWeather
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

// Get coordinates using Google Maps Geocoding API
export async function getCoordinates(location: string): Promise<LocationCoords> {
  const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  console.log('📍 getCoordinates called with:', location);
  console.log('📍 Google API Key available:', !!GOOGLE_API_KEY);

  if (!GOOGLE_API_KEY) {
    console.warn('❌ No Google Maps API key found, using fallback location');
    return getFallbackLocation(location);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_API_KEY}`;
    console.log('📡 Google Geocoding URL:', url.replace(GOOGLE_API_KEY, 'API_KEY_HIDDEN'));

    const response = await fetch(url);
    console.log('📡 Google response status:', response.status);

    if (!response.ok) {
      console.warn(`❌ Google API returned ${response.status}, using fallback`);
      return getFallbackLocation(location);
    }

    const data = await response.json();
    console.log('📡 Google response data:', data);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const coords = result.geometry.location;

      // Extract place name and region from address components
      const addressComponents = result.address_components || [];
      const getComponent = (types: string[]) => {
        return addressComponents.find((comp: any) => 
          types.some(type => comp.types.includes(type))
        )?.long_name || '';
      };

      const placeName = getComponent(['locality', 'administrative_area_level_3']) ||
                       getComponent(['administrative_area_level_2']) ||
                       result.formatted_address.split(',')[0];

      const region = getComponent(['administrative_area_level_1']) || getComponent(['country']);

      console.log(`✅ Google found coordinates for ${location}:`, {
        lat: coords.lat,
        lng: coords.lng,
        name: placeName,
        state: region,
        formatted: result.formatted_address
      });

      return {
        lat: coords.lat,
        lon: coords.lng,
        name: placeName,
        state: region
      };
    } else {
      console.warn(`❌ Google API status: ${data.status}`, data.error_message || '');
      return getFallbackLocation(location);
    }
  } catch (error) {
    console.warn('❌ Google Geocoding error:', error);
    return getFallbackLocation(location);
  }
}

// Get weather data using OpenWeather API
export async function getWeatherData(lat: number, lon: number, startDate: Date | null = null): Promise<WeatherResponse> {
  const OPENWEATHER_API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

  console.log('🌤️ getWeatherData called with:', { lat, lon, hasApiKey: !!OPENWEATHER_API_KEY });

  if (!startDate) {
    startDate = new Date();
    startDate.setMonth(3); // April (0-indexed)
    startDate.setDate(1);
  }

  if (!OPENWEATHER_API_KEY) {
    console.warn('❌ No OpenWeather API key, using mock data');
    return generateMockWeatherData(startDate);
  }

  try {
    console.log('📡 Fetching real weather data...');

    // Get current weather and 5-day forecast
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=imperial`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=imperial`;

    console.log('📡 Current weather URL:', currentUrl.replace(OPENWEATHER_API_KEY, 'API_KEY_HIDDEN'));
    console.log('📡 Forecast URL:', forecastUrl.replace(OPENWEATHER_API_KEY, 'API_KEY_HIDDEN'));

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
    const weatherDays = buildWeatherDataset(currentData, forecastData, startDate);

    console.log('📈 Built weather dataset:', { totalDays: weatherDays.length });

    return { days: weatherDays };
  } catch (error) {
    console.error('❌ Weather API error:', error);
    console.log('🔄 Falling back to mock data');
    return generateMockWeatherData(startDate);
  }
}

function buildWeatherDataset(currentData: any, forecastData: any, startDate: Date): WeatherDay[] {
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
    rainfall: 0
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
    const date = forecast.dt_txt.split(' ')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(forecast);
  });

  return grouped;
}

export function calculateGDD(tempHigh: number, tempLow: number, baseTemp: number = 50): number {
  const avgTemp = (tempHigh + tempLow) / 2;
  const gdd = Math.max(0, avgTemp - baseTemp);
  return gdd;
}

export function generateMockWeatherData(startDate: Date): WeatherResponse {
  const days = [];
  const currentDate = new Date(startDate);
  const today = new Date();

  while (currentDate <= today) {
    const dayOfYear = Math.floor((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

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

  return { days };
}

function getFallbackLocation(location: string): LocationCoords {
  const fallbacks: Record<string, LocationCoords> = {
    'napa': { lat: 38.2975, lon: -122.2869, name: 'Napa', state: 'CA' },
    'sonoma': { lat: 38.2919, lon: -122.4580, name: 'Sonoma', state: 'CA' },
    'paso robles': { lat: 35.6269, lon: -120.6906, name: 'Paso Robles', state: 'CA' },
    'santa barbara': { lat: 34.4208, lon: -119.6982, name: 'Santa Barbara', state: 'CA' },
    'willamette': { lat: 45.3311, lon: -123.0351, name: 'Willamette Valley', state: 'OR' },
    'walla walla': { lat: 46.0645, lon: -118.3430, name: 'Walla Walla', state: 'WA' },
    'finger lakes': { lat: 42.6064, lon: -77.0762, name: 'Finger Lakes', state: 'NY' },
    'hudson valley': { lat: 41.7658, lon: -73.9776, name: 'Hudson Valley', state: 'NY' },
    'bordeaux': { lat: 44.8378, lon: -0.5792, name: 'Bordeaux', state: 'France' },
    'burgundy': { lat: 47.0379, lon: 4.8035, name: 'Burgundy', state: 'France' },
    'champagne': { lat: 49.0369, lon: 4.0266, name: 'Champagne', state: 'France' },
    'tuscany': { lat: 43.7710, lon: 11.2486, name: 'Tuscany', state: 'Italy' },
    'mendoza': { lat: -32.8894, lon: -68.8446, name: 'Mendoza', state: 'Argentina' },
    'portland': { lat: 45.5152, lon: -122.6784, name: 'Portland', state: 'OR' },
    'seattle': { lat: 47.6062, lon: -122.3321, name: 'Seattle', state: 'WA' },
    'denver': { lat: 39.7392, lon: -104.9903, name: 'Denver', state: 'CO' }
  };

  const locationLower = location.toLowerCase();
  for (const [key, coords] of Object.entries(fallbacks)) {
    if (locationLower.includes(key)) {
      console.log(`📍 Using fallback coordinates for ${key.toUpperCase()}:`, coords);
      return coords;
    }
  }

  console.log('📍 Using default fallback: Napa Valley, CA');
  return fallbacks.napa;
}