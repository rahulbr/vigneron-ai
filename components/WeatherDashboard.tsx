
// components/WeatherDashboard.tsx - Phase 1: Tab-Based Navigation Implementation

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWeather, useWeatherConnection } from '../hooks/useWeather';
import { EnhancedGDDChart } from './EnhancedGDDChart';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';

interface ActivityForm {
  event_type: string;
  event_date: string;
  end_date?: string;
  notes: string;
  harvest_block?: string;
}

interface PhenologyEvent {
  id: string;
  event_type: string;
  event_date: string;
  end_date?: string;
  notes: string;
  harvest_block?: string;
}

interface WeatherDashboardProps {
  vineyardId: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  onSaveEvent?: (eventData: any) => Promise<void>;
  onLoadEvents?: () => Promise<PhenologyEvent[]>;
}

export function WeatherDashboard({
  vineyardId,
  locationName = 'Unknown Location',
  latitude = 0,
  longitude = 0,
  onSaveEvent,
  onLoadEvents
}: WeatherDashboardProps) {
  // Early return if essential props are missing
  if (!vineyardId) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{ color: '#dc2626' }}>⚠️ Configuration Error</h2>
        <p>Vineyard ID is required to display the dashboard.</p>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PhenologyEvent | null>(null);
  const [phenologyEvents, setPhenologyEvents] = useState<PhenologyEvent[]>([]);
  const [activityForm, setActivityForm] = useState<ActivityForm>({
    event_type: '',
    event_date: '',
    notes: '',
    harvest_block: ''
  });

  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [selectedMapEvent, setSelectedMapEvent] = useState<any | null>(null);

  // Memoized form update function to prevent re-renders
  const updateActivityForm = useCallback((field: string, value: any) => {
    setActivityForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const { isConnected, testing, testConnection } = useWeatherConnection();

  const weatherOptions = {
    latitude,
    longitude,
    autoFetch: true
  };

  const { data: weatherData, loading: weatherLoading, error: weatherError, refetch } = useWeather(weatherOptions);

  // Load events on component mount
  useEffect(() => {
    if (onLoadEvents) {
      onLoadEvents().then(events => {
        setPhenologyEvents(events || []);
      }).catch(error => {
        console.error('Failed to load events:', error);
      });
    }
  }, [onLoadEvents]);

  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) return;

    setIsSearching(true);
    try {
      const results = await googleGeocodingService.geocode(locationSearch);
      setSearchResults(results);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveActivity = async () => {
    if (!activityForm.event_type || !activityForm.event_date) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const eventData = {
        ...activityForm,
        vineyard_id: vineyardId,
        id: editingEvent?.id
      };

      if (onSaveEvent) {
        await onSaveEvent(eventData);
      }

      // Reload events
      if (onLoadEvents) {
        const events = await onLoadEvents();
        setPhenologyEvents(events || []);
      }

      // Reset form
      setActivityForm({
        event_type: '',
        event_date: '',
        notes: '',
        harvest_block: ''
      });
      setEditingEvent(null);
      setShowActivityForm(false);
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Failed to save activity');
    }
  };

  const handleEditEvent = (event: PhenologyEvent) => {
    setEditingEvent(event);
    setActivityForm({
      event_type: event.event_type,
      event_date: event.event_date,
      end_date: event.end_date || '',
      notes: event.notes || '',
      harvest_block: event.harvest_block || ''
    });
    setShowActivityForm(true);
  };

  const eventTypeOptions = [
    'Bud Break', 'Flowering', 'Fruit Set', 'Veraison', 'Harvest',
    'Pruning', 'Spray Application', 'Irrigation', 'Canopy Management'
  ];

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ margin: '0', color: '#2d5016' }}>
          🍇 {locationName}
        </h1>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            padding: '8px 12px',
            backgroundColor: isConnected ? '#dcfce7' : '#fef2f2',
            color: isConnected ? '#15803d' : '#dc2626',
            borderRadius: '6px',
            fontSize: '14px',
            border: `1px solid ${isConnected ? '#bbf7d0' : '#fecaca'}`
          }}>
            {testing ? '🔄 Testing...' : isConnected ? '✅ Connected' : '❌ Offline'}
          </div>
          
          <button
            onClick={testConnection}
            disabled={testing}
            style={{
              padding: '8px 16px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: testing ? 'not-allowed' : 'pointer',
              opacity: testing ? 0.6 : 1
            }}
          >
            Test Connection
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        borderBottom: '2px solid #f3f4f6'
      }}>
        {[
          { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
          { id: 'weather', label: '🌤️ Weather', icon: '🌤️' },
          { id: 'phenology', label: '🌱 Phenology', icon: '🌱' },
          { id: 'location', label: '📍 Location', icon: '📍' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              backgroundColor: activeTab === tab.id ? '#22c55e' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              borderBottom: activeTab === tab.id ? '3px solid #16a34a' : '3px solid transparent'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <div>
          <h2 style={{ color: '#2d5016', marginBottom: '20px' }}>🍇 Vineyard Overview</h2>
          
          {/* Quick Stats */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '15px',
            marginBottom: '30px'
          }}>
            <div style={{
              padding: '20px',
              backgroundColor: '#f0fdf4',
              border: '2px solid #bbf7d0',
              borderRadius: '12px'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#15803d' }}>📍 Location</h3>
              <p style={{ margin: '0', fontSize: '14px', color: '#374151' }}>
                {locationName}<br />
                {typeof latitude === 'number' ? latitude.toFixed(4) : '0.0000'}, {typeof longitude === 'number' ? longitude.toFixed(4) : '0.0000'}
              </p>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: '#eff6ff',
              border: '2px solid #bfdbfe',
              borderRadius: '12px'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#1d4ed8' }}>🌤️ Weather Status</h3>
              <p style={{ margin: '0', fontSize: '14px', color: '#374151' }}>
                {weatherLoading ? 'Loading...' : 
                 weatherError ? 'Error loading' : 
                 `${weatherData.length} days loaded`}
              </p>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: '#fefce8',
              border: '2px solid #fde047',
              borderRadius: '12px'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#a16207' }}>📅 Events</h3>
              <p style={{ margin: '0', fontSize: '14px', color: '#374151' }}>
                {phenologyEvents.length} recorded events
              </p>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#374151' }}>📋 Recent Activity</h3>
            {phenologyEvents.slice(0, 5).map((event, index) => (
              <div key={index} style={{
                padding: '10px',
                marginBottom: '10px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                borderLeft: '4px solid #22c55e'
              }}>
                <div style={{ fontWeight: 'bold', color: '#374151' }}>
                  {event.event_type}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {event.event_date}
                </div>
              </div>
            ))}
            {phenologyEvents.length === 0 && (
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                No events recorded yet. Switch to Phenology tab to add events.
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'weather' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#2d5016', margin: '0' }}>🌤️ Weather Data</h2>
            <button
              onClick={refetch}
              disabled={weatherLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: weatherLoading ? 'not-allowed' : 'pointer',
                opacity: weatherLoading ? 0.6 : 1
              }}
            >
              {weatherLoading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {weatherError && (
            <div style={{
              padding: '15px',
              backgroundColor: '#fef2f2',
              border: '2px solid #fecaca',
              borderRadius: '8px',
              marginBottom: '20px',
              color: '#dc2626'
            }}>
              ❌ Weather Error: {weatherError.message}
            </div>
          )}

          {weatherData.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <EnhancedGDDChart weatherData={weatherData} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'phenology' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#2d5016', margin: '0' }}>🌱 Phenology Events</h2>
            <button
              onClick={() => {
                setEditingEvent(null);
                setActivityForm({
                  event_type: '',
                  event_date: '',
                  notes: '',
                  harvest_block: ''
                });
                setShowActivityForm(true);
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ➕ Add Event
            </button>
          </div>

          {/* Event Form */}
          {showActivityForm && (
            <div key={`activity-form-${editingEvent?.id || 'new'}`} style={{
              padding: '20px',
              backgroundColor: 'white',
              border: '2px solid #22c55e',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#2d5016' }}>
                {editingEvent ? 'Edit Event' : 'Add New Event'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>
                    Event Type *
                  </label>
                  <select
                    value={activityForm.event_type}
                    onChange={(e) => updateActivityForm('event_type', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  >
                    <option value="">Select event type...</option>
                    {eventTypeOptions.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={activityForm.event_date}
                    onChange={(e) => updateActivityForm('event_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>
                    Block/Section
                  </label>
                  <input
                    type="text"
                    value={activityForm.harvest_block || ''}
                    onChange={(e) => updateActivityForm('harvest_block', e.target.value)}
                    placeholder="e.g., Block A, North Section"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#374151' }}>
                  Notes
                </label>
                <textarea
                  key="activity-notes"
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add details about this event..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={handleSaveActivity}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  💾 {editingEvent ? 'Update' : 'Save'} Event
                </button>
                <button
                  onClick={() => {
                    setShowActivityForm(false);
                    setEditingEvent(null);
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Events List */}
          <div style={{
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#374151' }}>📋 Recorded Events</h3>
            
            {phenologyEvents.length === 0 ? (
              <p style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '40px' }}>
                No events recorded yet. Click "Add Event" to get started!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {phenologyEvents.map(event => (
                  <div
                    key={event.id}
                    style={{
                      padding: '15px',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      borderLeft: '4px solid #22c55e'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: '5px' }}>
                          {event.event_type}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>
                          📅 {event.event_date}
                          {event.harvest_block && (
                            <span style={{ marginLeft: '15px' }}>
                              📍 {event.harvest_block}
                            </span>
                          )}
                        </div>
                        {event.notes && (
                          <div style={{ fontSize: '14px', color: '#4b5563', marginTop: '8px' }}>
                            {event.notes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleEditEvent(event)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'location' && (
        <div>
          <h2 style={{ color: '#2d5016', marginBottom: '20px' }}>📍 Location Management</h2>
          
          {/* Current Location */}
          <div style={{
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#374151' }}>📍 Current Location</h3>
            <div style={{ fontSize: '16px', color: '#4b5563' }}>
              <strong>{locationName}</strong><br />
              Coordinates: {typeof latitude === 'number' ? latitude.toFixed(6) : '0.000000'}, {typeof longitude === 'number' ? longitude.toFixed(6) : '0.000000'}
            </div>
          </div>

          {/* Location Search */}
          <div style={{
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#374151' }}>🔍 Search New Location</h3>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search for a location..."
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '2px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
              />
              <button
                onClick={handleLocationSearch}
                disabled={isSearching || !locationSearch.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSearching || !locationSearch.trim() ? 'not-allowed' : 'pointer',
                  opacity: isSearching || !locationSearch.trim() ? 0.6 : 1
                }}
              >
                {isSearching ? '🔄' : '🔍'} Search
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Search Results:</h4>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '10px',
                      marginBottom: '10px',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      console.log('Selected location:', result);
                      // You can implement location selection logic here
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: '#374151' }}>
                      {result.formatted_address}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {result.geometry.location.lat.toFixed(6)}, {result.geometry.location.lng.toFixed(6)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Add default export for better import compatibility
export default WeatherDashboard;
