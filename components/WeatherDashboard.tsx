
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWeather } from '../hooks/useWeather';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';
import { 
  saveWeatherData, 
  getWeatherData, 
  saveVineyardLocation,
  savePhenologyEvent,
  getPhenologyEvents,
  updatePhenologyEvent,
  deletePhenologyEvent,
  getVineyardDetails
} from '../lib/supabase';
import { GrowthCurveChart } from './GrowthCurveChart';
import { EnhancedGDDChart } from './EnhancedGDDChart';
import { ReportsModal } from './ReportsModal';

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

interface PhenologyEvent {
  id?: string;
  event_type: string;
  event_date: string;
  end_date?: string;
  notes?: string;
  harvest_block?: string;
  created_at?: string;
  [key: string]: any; // For additional event-specific fields
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

  // Event Log State
  const [phenologyEvents, setPhenologyEvents] = useState<PhenologyEvent[]>([]);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PhenologyEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    event_type: '',
    event_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
    harvest_block: '',
    spray_product: '',
    spray_quantity: '',
    spray_unit: 'gallons',
    spray_target: '',
    spray_equipment: '',
    spray_conditions: '',
    irrigation_amount: '',
    irrigation_unit: 'gallons',
    irrigation_method: '',
    irrigation_duration: '',
    fertilizer_type: '',
    fertilizer_npk: '',
    fertilizer_rate: '',
    fertilizer_unit: 'lbs/acre',
    fertilizer_method: '',
    harvest_yield: '',
    harvest_unit: 'tons',
    harvest_brix: '',
    harvest_ph: '',
    harvest_ta: '',
    canopy_activity: '',
    canopy_intensity: '',
    canopy_side: '',
    canopy_stage: '',
    scout_focus: '',
    scout_severity: '',
    scout_distribution: '',
    scout_action: ''
  });
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [vineyard, setVineyard] = useState<any>(null);

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

  // Load vineyard details
  const loadVineyardDetails = useCallback(async () => {
    if (!vineyardId) return;
    
    try {
      const vineyardData = await getVineyardDetails(vineyardId);
      if (vineyardData) {
        setVineyard(vineyardData);
        // Update location if vineyard has coordinates
        if (vineyardData.latitude && vineyardData.longitude) {
          setLocation({
            latitude: vineyardData.latitude,
            longitude: vineyardData.longitude,
            name: vineyardData.location || vineyardData.name || location.name
          });
        }
      }
    } catch (error) {
      console.error('Failed to load vineyard details:', error);
    }
  }, [vineyardId, location.name]);

  // Load phenology events
  const loadPhenologyEvents = useCallback(async () => {
    if (!vineyardId) return;

    try {
      const events = await getPhenologyEvents(vineyardId);
      setPhenologyEvents(events || []);
    } catch (error) {
      console.error('Failed to load phenology events:', error);
    }
  }, [vineyardId]);

  // Load data on mount and vineyard change
  useEffect(() => {
    loadVineyardDetails();
    loadPhenologyEvents();
  }, [loadVineyardDetails, loadPhenologyEvents]);

  // Listen for chart date clicks
  useEffect(() => {
    const handleChartDateClick = (event: CustomEvent) => {
      if (event.detail?.date) {
        setEventForm(prev => ({ ...prev, event_date: event.detail.date }));
        setShowAddEventForm(true);
      }
    };

    window.addEventListener('chartDateClicked', handleChartDateClick as EventListener);
    return () => {
      window.removeEventListener('chartDateClicked', handleChartDateClick as EventListener);
    };
  }, []);

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
      setSearchResults(results.slice(0, 5));
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

  // Handle event form submission
  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vineyardId) return;

    try {
      const eventData = {
        ...eventForm,
        notes: eventForm.notes || undefined,
        end_date: eventForm.end_date || undefined,
        harvest_block: eventForm.harvest_block || undefined
      };

      // Create structured data objects for different event types
      const locationData = undefined; // Add location data if needed
      const sprayData = eventForm.event_type === 'spray_application' ? {
        product: eventForm.spray_product,
        quantity: eventForm.spray_quantity,
        unit: eventForm.spray_unit,
        target: eventForm.spray_target,
        equipment: eventForm.spray_equipment,
        conditions: eventForm.spray_conditions
      } : undefined;

      const irrigationData = eventForm.event_type === 'irrigation' ? {
        amount: eventForm.irrigation_amount,
        unit: eventForm.irrigation_unit,
        method: eventForm.irrigation_method,
        duration: eventForm.irrigation_duration
      } : undefined;

      const fertilizationData = eventForm.event_type === 'fertilization' ? {
        type: eventForm.fertilizer_type,
        npk: eventForm.fertilizer_npk,
        rate: eventForm.fertilizer_rate,
        unit: eventForm.fertilizer_unit,
        method: eventForm.fertilizer_method
      } : undefined;

      const harvestData = eventForm.event_type === 'harvest' ? {
        yield: eventForm.harvest_yield,
        unit: eventForm.harvest_unit,
        brix: eventForm.harvest_brix,
        ph: eventForm.harvest_ph,
        ta: eventForm.harvest_ta,
        block: eventForm.harvest_block
      } : undefined;

      const canopyData = eventForm.event_type === 'canopy_management' ? {
        activity: eventForm.canopy_activity,
        intensity: eventForm.canopy_intensity,
        side: eventForm.canopy_side,
        stage: eventForm.canopy_stage
      } : undefined;

      const scoutData = eventForm.event_type === 'scouting' ? {
        focus: eventForm.scout_focus,
        severity: eventForm.scout_severity,
        distribution: eventForm.scout_distribution,
        action: eventForm.scout_action
      } : undefined;

      if (editingEvent && editingEvent.id) {
        // Update existing event
        await updatePhenologyEvent(editingEvent.id, eventData);
      } else {
        // Create new event
        await savePhenologyEvent(
          vineyardId,
          eventData.event_type,
          eventData.event_date,
          eventData.notes,
          eventData.end_date,
          eventData.harvest_block,
          locationData,
          sprayData,
          irrigationData,
          fertilizationData,
          harvestData,
          canopyData,
          scoutData
        );
      }

      // Reset form and reload events
      setEventForm({
        event_type: '',
        event_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: '',
        harvest_block: '',
        spray_product: '',
        spray_quantity: '',
        spray_unit: 'gallons',
        spray_target: '',
        spray_equipment: '',
        spray_conditions: '',
        irrigation_amount: '',
        irrigation_unit: 'gallons',
        irrigation_method: '',
        irrigation_duration: '',
        fertilizer_type: '',
        fertilizer_npk: '',
        fertilizer_rate: '',
        fertilizer_unit: 'lbs/acre',
        fertilizer_method: '',
        harvest_yield: '',
        harvest_unit: 'tons',
        harvest_brix: '',
        harvest_ph: '',
        harvest_ta: '',
        canopy_activity: '',
        canopy_intensity: '',
        canopy_side: '',
        canopy_stage: '',
        scout_focus: '',
        scout_severity: '',
        scout_distribution: '',
        scout_action: ''
      });
      setShowAddEventForm(false);
      setEditingEvent(null);
      await loadPhenologyEvents();

      // Dispatch event to notify chart
      const changeEvent = new CustomEvent('phenologyEventsChanged', { detail: { vineyardId } });
      window.dispatchEvent(changeEvent);

    } catch (error) {
      console.error('Failed to save event:', error);
      alert('Failed to save event: ' + (error as Error).message);
    }
  };

  // Handle event deletion
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await deletePhenologyEvent(eventId);
      await loadPhenologyEvents();
      
      // Dispatch event to notify chart
      const changeEvent = new CustomEvent('phenologyEventsChanged', { detail: { vineyardId } });
      window.dispatchEvent(changeEvent);
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Failed to delete event: ' + (error as Error).message);
    }
  };

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
        🍇 {vineyard?.name || 'Vineyard'} Dashboard
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
        <button 
          onClick={() => setShowReportsModal(true)}
          style={{...buttonStyle, backgroundColor: '#10b981'}}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#059669';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#10b981';
          }}
        >
          📊 Reports
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
        <>
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

          {/* Enhanced GDD Chart with Event Tracking */}
          <div style={{ width: '100%', maxWidth: '1200px', marginTop: '30px' }}>
            <EnhancedGDDChart
              weatherData={weatherData}
              locationName={location.name}
              vineyardId={vineyardId}
              onEventsChange={loadPhenologyEvents}
              vineyardName={vineyard?.name}
            />
          </div>

          {/* Event Log Section */}
          <div 
            data-event-log-section
            style={{ 
              width: '100%', 
              maxWidth: '1200px', 
              marginTop: '30px',
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                📅 Event Log ({phenologyEvents.length} events)
              </h2>
              <button
                data-event-log-add-button
                onClick={() => {
                  setShowAddEventForm(!showAddEventForm);
                  setEditingEvent(null);
                  setEventForm({
                    event_type: '',
                    event_date: new Date().toISOString().split('T')[0],
                    end_date: '',
                    notes: '',
                    harvest_block: '',
                    spray_product: '',
                    spray_quantity: '',
                    spray_unit: 'gallons',
                    spray_target: '',
                    spray_equipment: '',
                    spray_conditions: '',
                    irrigation_amount: '',
                    irrigation_unit: 'gallons',
                    irrigation_method: '',
                    irrigation_duration: '',
                    fertilizer_type: '',
                    fertilizer_npk: '',
                    fertilizer_rate: '',
                    fertilizer_unit: 'lbs/acre',
                    fertilizer_method: '',
                    harvest_yield: '',
                    harvest_unit: 'tons',
                    harvest_brix: '',
                    harvest_ph: '',
                    harvest_ta: '',
                    canopy_activity: '',
                    canopy_intensity: '',
                    canopy_side: '',
                    canopy_stage: '',
                    scout_focus: '',
                    scout_severity: '',
                    scout_distribution: '',
                    scout_action: ''
                  });
                }}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#10b981'
                }}
              >
                {showAddEventForm ? '❌ Cancel' : '➕ Add Event'}
              </button>
            </div>

            {/* Add/Edit Event Form */}
            {showAddEventForm && (
              <form onSubmit={handleEventSubmit} style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0 }}>
                  {editingEvent ? '✏️ Edit Event' : '➕ Add New Event'}
                </h3>
                
                {/* Basic Event Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Event Type:</label>
                    <select
                      value={eventForm.event_type}
                      onChange={(e) => setEventForm({...eventForm, event_type: e.target.value})}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    >
                      <option value="">Select Event Type</option>
                      <optgroup label="Phenology Stages">
                        <option value="bud_break">🌱 Bud Break</option>
                        <option value="bloom">🌸 Bloom</option>
                        <option value="fruit_set">🫐 Fruit Set</option>
                        <option value="veraison">🍇 Veraison</option>
                        <option value="harvest">🍷 Harvest</option>
                      </optgroup>
                      <optgroup label="Management Activities">
                        <option value="pruning">✂️ Pruning</option>
                        <option value="spray_application">🌿 Spray Application</option>
                        <option value="irrigation">💧 Irrigation</option>
                        <option value="fertilization">🌱 Fertilization</option>
                        <option value="canopy_management">🍃 Canopy Management</option>
                        <option value="soil_work">🌍 Soil Work</option>
                        <option value="equipment_maintenance">🔧 Equipment Maintenance</option>
                      </optgroup>
                      <optgroup label="Monitoring">
                        <option value="scouting">🔍 Scouting</option>
                        <option value="pest">🐞 Pest Observation</option>
                        <option value="disease">🦠 Disease Observation</option>
                      </optgroup>
                      <optgroup label="Other">
                        <option value="other">📝 Other</option>
                      </optgroup>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Event Date:</label>
                    <input
                      type="date"
                      value={eventForm.event_date}
                      onChange={(e) => setEventForm({...eventForm, event_date: e.target.value})}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    />
                  </div>

                  {(['bud_break', 'bloom', 'veraison'].includes(eventForm.event_type)) && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>End Date (optional):</label>
                      <input
                        type="date"
                        value={eventForm.end_date}
                        onChange={(e) => setEventForm({...eventForm, end_date: e.target.value})}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Event-Specific Fields */}
                {eventForm.event_type === 'spray_application' && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '12px', color: '#374151' }}>🌿 Spray Application Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Product:</label>
                        <input
                          type="text"
                          value={eventForm.spray_product}
                          onChange={(e) => setEventForm({...eventForm, spray_product: e.target.value})}
                          placeholder="Product name"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Quantity:</label>
                        <input
                          type="text"
                          value={eventForm.spray_quantity}
                          onChange={(e) => setEventForm({...eventForm, spray_quantity: e.target.value})}
                          placeholder="Amount"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Unit:</label>
                        <select
                          value={eventForm.spray_unit}
                          onChange={(e) => setEventForm({...eventForm, spray_unit: e.target.value})}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        >
                          <option value="gallons">Gallons</option>
                          <option value="liters">Liters</option>
                          <option value="lbs">Pounds</option>
                          <option value="oz">Ounces</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Target:</label>
                        <input
                          type="text"
                          value={eventForm.spray_target}
                          onChange={(e) => setEventForm({...eventForm, spray_target: e.target.value})}
                          placeholder="Target pest/disease"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Equipment:</label>
                        <input
                          type="text"
                          value={eventForm.spray_equipment}
                          onChange={(e) => setEventForm({...eventForm, spray_equipment: e.target.value})}
                          placeholder="Sprayer type"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Conditions:</label>
                        <input
                          type="text"
                          value={eventForm.spray_conditions}
                          onChange={(e) => setEventForm({...eventForm, spray_conditions: e.target.value})}
                          placeholder="Weather conditions"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {eventForm.event_type === 'harvest' && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '12px', color: '#374151' }}>🍷 Harvest Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Yield:</label>
                        <input
                          type="text"
                          value={eventForm.harvest_yield}
                          onChange={(e) => setEventForm({...eventForm, harvest_yield: e.target.value})}
                          placeholder="Amount"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Unit:</label>
                        <select
                          value={eventForm.harvest_unit}
                          onChange={(e) => setEventForm({...eventForm, harvest_unit: e.target.value})}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        >
                          <option value="tons">Tons</option>
                          <option value="lbs">Pounds</option>
                          <option value="kg">Kilograms</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Brix:</label>
                        <input
                          type="text"
                          value={eventForm.harvest_brix}
                          onChange={(e) => setEventForm({...eventForm, harvest_brix: e.target.value})}
                          placeholder="°Brix"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>pH:</label>
                        <input
                          type="text"
                          value={eventForm.harvest_ph}
                          onChange={(e) => setEventForm({...eventForm, harvest_ph: e.target.value})}
                          placeholder="pH level"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>TA:</label>
                        <input
                          type="text"
                          value={eventForm.harvest_ta}
                          onChange={(e) => setEventForm({...eventForm, harvest_ta: e.target.value})}
                          placeholder="Titratable acidity"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Block:</label>
                        <input
                          type="text"
                          value={eventForm.harvest_block}
                          onChange={(e) => setEventForm({...eventForm, harvest_block: e.target.value})}
                          placeholder="Block/section"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Notes:</label>
                  <textarea
                    value={eventForm.notes}
                    onChange={(e) => setEventForm({...eventForm, notes: e.target.value})}
                    placeholder="Additional notes..."
                    rows={3}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical' }}
                  />
                </div>

                {/* Form Actions */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    style={{
                      ...buttonStyle,
                      backgroundColor: '#10b981'
                    }}
                  >
                    {editingEvent ? '💾 Update Event' : '➕ Add Event'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddEventForm(false);
                      setEditingEvent(null);
                    }}
                    style={{
                      ...buttonStyle,
                      backgroundColor: '#6b7280'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Events List */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {phenologyEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
                  <div>No events recorded yet.</div>
                  <div style={{ fontSize: '14px', marginTop: '8px' }}>
                    Click "Add Event" or click on the growth curve to get started.
                  </div>
                </div>
              ) : (
                phenologyEvents
                  .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
                  .map((event, index) => {
                    const eventEmojis: { [key: string]: string } = {
                      bud_break: '🌱',
                      bloom: '🌸',
                      fruit_set: '🫐',
                      veraison: '🍇',
                      harvest: '🍷',
                      pruning: '✂️',
                      spray_application: '🌿',
                      irrigation: '💧',
                      fertilization: '🌱',
                      canopy_management: '🍃',
                      soil_work: '🌍',
                      equipment_maintenance: '🔧',
                      scouting: '🔍',
                      pest: '🐞',
                      disease: '🦠',
                      other: '📝'
                    };

                    return (
                      <div
                        key={event.id || index}
                        style={{
                          padding: '16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          marginBottom: '12px',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '20px' }}>
                                {eventEmojis[event.event_type] || '📝'}
                              </span>
                              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                                {event.event_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </h4>
                              <span style={{ 
                                padding: '2px 8px', 
                                backgroundColor: '#e0f2fe', 
                                borderRadius: '12px', 
                                fontSize: '12px',
                                color: '#0369a1'
                              }}>
                                {new Date(event.event_date).toLocaleDateString()}
                              </span>
                              {event.end_date && (
                                <span style={{ 
                                  padding: '2px 8px', 
                                  backgroundColor: '#f0f9ff', 
                                  borderRadius: '12px', 
                                  fontSize: '12px',
                                  color: '#0369a1'
                                }}>
                                  → {new Date(event.end_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            {event.notes && (
                              <p style={{ margin: '8px 0', color: '#4b5563', lineHeight: '1.5' }}>
                                {event.notes}
                              </p>
                            )}

                            {/* Event-specific details */}
                            {event.event_type === 'spray_application' && event.spray_product && (
                              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
                                Product: {event.spray_product}
                                {event.spray_quantity && ` • ${event.spray_quantity} ${event.spray_unit || ''}`}
                                {event.spray_target && ` • Target: ${event.spray_target}`}
                              </div>
                            )}

                            {event.event_type === 'harvest' && (
                              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
                                {event.harvest_yield && `Yield: ${event.harvest_yield} ${event.harvest_unit || ''}`}
                                {event.harvest_brix && ` • Brix: ${event.harvest_brix}°`}
                                {event.harvest_ph && ` • pH: ${event.harvest_ph}`}
                                {event.harvest_block && ` • Block: ${event.harvest_block}`}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                            <button
                              onClick={() => {
                                setEditingEvent(event);
                                setEventForm({
                                  event_type: event.event_type,
                                  event_date: event.event_date,
                                  end_date: event.end_date || '',
                                  notes: event.notes || '',
                                  harvest_block: event.harvest_block || '',
                                  spray_product: (event as any).spray_product || '',
                                  spray_quantity: (event as any).spray_quantity || '',
                                  spray_unit: (event as any).spray_unit || 'gallons',
                                  spray_target: (event as any).spray_target || '',
                                  spray_equipment: (event as any).spray_equipment || '',
                                  spray_conditions: (event as any).spray_conditions || '',
                                  irrigation_amount: (event as any).irrigation_amount || '',
                                  irrigation_unit: (event as any).irrigation_unit || 'gallons',
                                  irrigation_method: (event as any).irrigation_method || '',
                                  irrigation_duration: (event as any).irrigation_duration || '',
                                  fertilizer_type: (event as any).fertilizer_type || '',
                                  fertilizer_npk: (event as any).fertilizer_npk || '',
                                  fertilizer_rate: (event as any).fertilizer_rate || '',
                                  fertilizer_unit: (event as any).fertilizer_unit || 'lbs/acre',
                                  fertilizer_method: (event as any).fertilizer_method || '',
                                  harvest_yield: (event as any).harvest_yield || '',
                                  harvest_unit: (event as any).harvest_unit || 'tons',
                                  harvest_brix: (event as any).harvest_brix || '',
                                  harvest_ph: (event as any).harvest_ph || '',
                                  harvest_ta: (event as any).harvest_ta || '',
                                  canopy_activity: (event as any).canopy_activity || '',
                                  canopy_intensity: (event as any).canopy_intensity || '',
                                  canopy_side: (event as any).canopy_side || '',
                                  canopy_stage: (event as any).canopy_stage || '',
                                  scout_focus: (event as any).scout_focus || '',
                                  scout_severity: (event as any).scout_severity || '',
                                  scout_distribution: (event as any).scout_distribution || '',
                                  scout_action: (event as any).scout_action || ''
                                });
                                setShowAddEventForm(true);
                              }}
                              style={{
                                ...buttonStyle,
                                backgroundColor: '#f59e0b',
                                padding: '6px 12px',
                                fontSize: '12px'
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => event.id && handleDeleteEvent(event.id)}
                              style={{
                                ...buttonStyle,
                                backgroundColor: '#ef4444',
                                padding: '6px 12px',
                                fontSize: '12px'
                              }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </>
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

      {/* Reports Modal */}
      {showReportsModal && vineyard && weatherData && (
        <ReportsModal
          isOpen={showReportsModal}
          onClose={() => setShowReportsModal(false)}
          vineyard={vineyard}
          phenologyEvents={phenologyEvents}
          weatherData={weatherData}
          dateRange={{
            start: selectedDateRange.startDate,
            end: selectedDateRange.endDate
          }}
        />
      )}
    </div>
  );
};

export default WeatherDashboard;
