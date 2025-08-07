
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWeather } from '../hooks/useWeather';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';
import { saveWeatherData, getWeatherData, saveVineyardLocation } from '../lib/supabase';

interface WeatherDashboardProps {
  vineyardId?: string;
  initialLocation?: {
    latitude: number;
    longitude: number;
    name: string;
  };
}

interface LocationState {
  latitude: number;
  longitude: number;
  name: string;
}

const WeatherDashboard: React.FC<WeatherDashboardProps> = ({ 
  vineyardId,
  initialLocation 
}) => {
  const [location, setLocation] = useState<LocationState>(
    initialLocation || {
      latitude: 37.3272,
      longitude: -122.2813,
      name: 'La Honda, CA'
    }
  );
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 2, 1).toISOString().split('T')[0], // March 1
    endDate: new Date().toISOString().split('T')[0] // Today
  });

  // Weather data hook
  const { 
    data: weatherData, 
    loading: weatherLoading, 
    error: weatherError,
    refetch: refetchWeather 
  } = useWeather({
    latitude: location.latitude,
    longitude: location.longitude,
    startDate: selectedDateRange.startDate,
    endDate: selectedDateRange.endDate,
    autoFetch: true
  });

  // Search locations with Google Maps API
  const searchLocations = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await googleGeocodingService.geocodeLocation(query);
      setSearchResults(results.slice(0, 5)); // Show top 5 results
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle location selection
  const selectLocation = useCallback(async (result: GeocodeResult) => {
    const newLocation = {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name
    };

    setLocation(newLocation);
    setSearchQuery('');
    setShowResults(false);

    // Save to database if we have a vineyard ID
    if (vineyardId) {
      try {
        await saveVineyardLocation(
          vineyardId,
          result.latitude,
          result.longitude,
          result.name
        );
        console.log('✅ Location saved to vineyard');
      } catch (error) {
        console.error('❌ Failed to save location:', error);
      }
    }
  }, [vineyardId]);

  // Save weather data to database
  const saveWeatherToDatabase = useCallback(async () => {
    if (!vineyardId || !weatherData || weatherData.length === 0) return;

    try {
      await saveWeatherData(vineyardId, weatherData);
      console.log('✅ Weather data saved to database');
    } catch (error) {
      console.error('❌ Failed to save weather data:', error);
    }
  }, [vineyardId, weatherData]);

  // Calculate summary statistics
  const weatherSummary = useMemo(() => {
    if (!weatherData || weatherData.length === 0) return null;

    const totalGDD = weatherData.reduce((sum, day) => sum + day.gdd, 0);
    const totalRainfall = weatherData.reduce((sum, day) => sum + day.rainfall, 0);
    const avgTempHigh = weatherData.reduce((sum, day) => sum + day.temp_high, 0) / weatherData.length;
    const avgTempLow = weatherData.reduce((sum, day) => sum + day.temp_low, 0) / weatherData.length;
    const maxTemp = Math.max(...weatherData.map(day => day.temp_high));
    const minTemp = Math.min(...weatherData.map(day => day.temp_low));

    return {
      totalGDD: Math.round(totalGDD * 10) / 10,
      totalRainfall: Math.round(totalRainfall * 100) / 100,
      avgTempHigh: Math.round(avgTempHigh * 10) / 10,
      avgTempLow: Math.round(avgTempLow * 10) / 10,
      maxTemp,
      minTemp,
      dayCount: weatherData.length
    };
  }, [weatherData]);

  // Auto-save weather data when it changes
  useEffect(() => {
    if (weatherData && weatherData.length > 0) {
      saveWeatherToDatabase();
    }
  }, [weatherData, saveWeatherToDatabase]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '2rem',
    textAlign: 'center'
  };

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '500px',
    marginBottom: '2rem'
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  };

  const resultsContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    maxHeight: '300px',
    overflowY: 'auto'
  };

  const resultItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.2s'
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    margin: '12px',
    minWidth: '280px',
    maxWidth: '400px'
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    width: '100%',
    maxWidth: '1200px',
    marginTop: '20px'
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  };

  const dateInputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    margin: '0 8px'
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>
        🌤️ Weather Dashboard
      </h1>

      {/* Location Search */}
      <div style={searchContainerStyle}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            searchLocations(e.target.value);
          }}
          placeholder="Search for a location..."
          style={searchInputStyle}
        />

        {/* Search Results */}
        {showResults && searchResults.length > 0 && (
          <div style={resultsContainerStyle}>
            {searchResults.map((result, index) => (
              <div
                key={index}
                style={resultItemStyle}
                onClick={() => selectLocation(result)}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'white';
                }}
              >
                <div style={{ fontWeight: '500', color: '#1e293b' }}>
                  {result.name}
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  {result.formattedAddress}
                </div>
              </div>
            ))}
          </div>
        )}

        {isSearching && (
          <div style={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0, 
            backgroundColor: 'white', 
            padding: '12px', 
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            borderRadius: '8px'
          }}>
            Searching...
          </div>
        )}
      </div>

      {/* Current Location */}
      <div style={{ 
        backgroundColor: '#e0f2fe', 
        padding: '12px 20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        textAlign: 'center' 
      }}>
        <span style={{ fontWeight: '500' }}>📍 Current Location: </span>
        {location.name} ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
      </div>

      {/* Date Range Controls */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '16px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <label style={{ fontWeight: '500' }}>Date Range:</label>
        <input
          type="date"
          value={selectedDateRange.startDate}
          onChange={(e) => setSelectedDateRange(prev => ({ ...prev, startDate: e.target.value }))}
          style={dateInputStyle}
        />
        <span>to</span>
        <input
          type="date"
          value={selectedDateRange.endDate}
          onChange={(e) => setSelectedDateRange(prev => ({ ...prev, endDate: e.target.value }))}
          style={dateInputStyle}
        />
        <button 
          onClick={refetchWeather} 
          style={buttonStyle}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#3b82f6';
          }}
        >
          Refresh Data
        </button>
      </div>

      {/* Loading State */}
      {weatherLoading && (
        <div style={{ 
          ...cardStyle, 
          textAlign: 'center', 
          color: '#6b7280' 
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div>Loading weather data...</div>
        </div>
      )}

      {/* Error State */}
      {weatherError && (
        <div style={{ 
          ...cardStyle, 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca',
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ color: '#dc2626', fontWeight: '500', marginBottom: '8px' }}>
            Weather Data Error
          </div>
          <div style={{ color: '#7f1d1d', fontSize: '14px' }}>
            {weatherError.message}
          </div>
          <button 
            onClick={refetchWeather} 
            style={{ ...buttonStyle, marginTop: '12px', backgroundColor: '#dc2626' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Weather Data Display */}
      {weatherData && weatherData.length > 0 && (
        <div style={gridStyle}>
          {/* Summary Card */}
          {weatherSummary && (
            <div style={cardStyle}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                color: '#1e293b', 
                fontSize: '20px' 
              }}>
                📊 Weather Summary
              </h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🌡️ Avg High:</span>
                  <strong>{weatherSummary.avgTempHigh}°F</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🌡️ Avg Low:</span>
                  <strong>{weatherSummary.avgTempLow}°F</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🔥 Max Temp:</span>
                  <strong>{weatherSummary.maxTemp}°F</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>❄️ Min Temp:</span>
                  <strong>{weatherSummary.minTemp}°F</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🌱 Total GDD:</span>
                  <strong>{weatherSummary.totalGDD}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🌧️ Total Rainfall:</span>
                  <strong>{weatherSummary.totalRainfall}"</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>📅 Days:</span>
                  <strong>{weatherSummary.dayCount}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Recent Weather Card */}
          <div style={cardStyle}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: '#1e293b', 
              fontSize: '20px' 
            }}>
              🗓️ Recent Weather ({Math.min(7, weatherData.length)} days)
            </h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {weatherData.slice(-7).reverse().map((day, index) => (
                <div 
                  key={day.date} 
                  style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '6px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: '8px',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}
                >
                  <span style={{ fontWeight: '500' }}>
                    {new Date(day.date).toLocaleDateString()}
                  </span>
                  <span>🌡️ {day.temp_high}°/{day.temp_low}°F</span>
                  <span>🌱 {day.gdd} GDD</span>
                  <span>🌧️ {day.rainfall}"</span>
                </div>
              ))}
            </div>
          </div>

          {/* Data Actions Card */}
          <div style={cardStyle}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: '#1e293b', 
              fontSize: '20px' 
            }}>
              ⚙️ Data Actions
            </h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <button 
                onClick={saveWeatherToDatabase}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#10b981'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#10b981';
                }}
              >
                💾 Save to Database
              </button>
              <button 
                onClick={refetchWeather}
                style={{
                  ...buttonStyle,
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#3b82f6';
                }}
              >
                🔄 Refresh Weather Data
              </button>
            </div>
            <div style={{ 
              marginTop: '12px', 
              fontSize: '12px', 
              color: '#6b7280',
              textAlign: 'center' 
            }}>
              {vineyardId ? `Vineyard ID: ${vineyardId}` : 'No vineyard selected'}
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!weatherLoading && !weatherError && (!weatherData || weatherData.length === 0) && (
        <div style={{ 
          ...cardStyle, 
          textAlign: 'center', 
          color: '#6b7280' 
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div>No weather data available for the selected location and date range.</div>
          <button 
            onClick={refetchWeather} 
            style={{ ...buttonStyle, marginTop: '12px' }}
          >
            Try Loading Data
          </button>
        </div>
      )}
    </div>
  );
};

export default WeatherDashboard;
