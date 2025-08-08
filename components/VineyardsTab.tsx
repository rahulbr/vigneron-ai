
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';
import { MapPin, Edit, Save, X, Plus, Search, Trash2 } from 'lucide-react';

interface VineyardsTabProps {
  currentVineyard: any;
  userVineyards: any[];
  onVineyardSwitch: (vineyard: any) => void;
  onVineyardCreate: () => void;
  onVineyardUpdate: (vineyardId: string, updates: any) => void;
  onVineyardDelete: (vineyard: any) => void;
}

export function VineyardsTab({
  currentVineyard,
  userVineyards,
  onVineyardSwitch,
  onVineyardCreate,
  onVineyardUpdate,
  onVineyardDelete
}: VineyardsTabProps) {
  const [editingVineyardId, setEditingVineyardId] = useState<string | null>(null);
  const [editingVineyardName, setEditingVineyardName] = useState('');
  const [editingVineyardLocation, setEditingVineyardLocation] = useState(false);
  const [showCreateVineyard, setShowCreateVineyard] = useState(false);
  const [newVineyardName, setNewVineyardName] = useState('');
  const [newVineyardLatitude, setNewVineyardLatitude] = useState(37.3272);
  const [newVineyardLongitude, setNewVineyardLongitude] = useState(-122.2813);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Search for locations using Google Maps API
  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) return;

    setIsSearching(true);
    try {
      const results = await googleGeocodingService.geocodeLocation(locationSearch);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Google Maps search error:', error);
      alert('Search failed: ' + (error as Error).message + '\n\nFalling back to La Honda, CA');

      // Use La Honda fallback if search fails
      const fallback = googleGeocodingService.getLaHondaFallback();
      selectLocation(fallback);
    } finally {
      setIsSearching(false);
    }
  };

  // Select a location from search results
  const selectLocation = (location: GeocodeResult) => {
    if (editingVineyardLocation) {
      // Update existing vineyard location
      setNewVineyardLatitude(location.latitude);
      setNewVineyardLongitude(location.longitude);
      setEditingVineyardName(location.name);
    } else {
      // For new vineyard
      setNewVineyardLatitude(location.latitude);
      setNewVineyardLongitude(location.longitude);
      setNewVineyardName(location.name);
    }
    
    setShowSearchResults(false);
    setLocationSearch('');
  };

  // Start editing a vineyard name
  const startEditingVineyard = (vineyard: any) => {
    setEditingVineyardId(vineyard.id);
    setEditingVineyardName(vineyard.name);
    setEditingVineyardLocation(false);
  };

  // Start editing a vineyard location
  const startEditingVineyardLocation = (vineyard: any) => {
    setEditingVineyardId(vineyard.id);
    setEditingVineyardLocation(true);
    setNewVineyardLatitude(vineyard.latitude);
    setNewVineyardLongitude(vineyard.longitude);
    setEditingVineyardName(vineyard.name);
    setLocationSearch('');
    setShowSearchResults(false);
  };

  // Cancel editing a vineyard
  const cancelEditingVineyard = () => {
    setEditingVineyardId(null);
    setEditingVineyardName('');
    setEditingVineyardLocation(false);
  };

  // Save vineyard changes
  const saveVineyardChanges = async (vineyardId: string) => {
    if (editingVineyardLocation) {
      // Save location changes
      const updates = {
        name: editingVineyardName.trim(),
        latitude: newVineyardLatitude,
        longitude: newVineyardLongitude
      };
      await onVineyardUpdate(vineyardId, updates);
    } else {
      // Save name changes only
      const updates = {
        name: editingVineyardName.trim()
      };
      await onVineyardUpdate(vineyardId, updates);
    }
    cancelEditingVineyard();
  };

  // Create new vineyard
  const createVineyard = async () => {
    if (!newVineyardName.trim()) {
      alert('Please enter a vineyard name');
      return;
    }

    try {
      const { createVineyard } = await import('../lib/supabase');
      const newVineyard = await createVineyard(
        newVineyardName.trim(),
        newVineyardName.trim(),
        newVineyardLatitude,
        newVineyardLongitude
      );

      onVineyardCreate();
      setShowCreateVineyard(false);
      setNewVineyardName('');
      setNewVineyardLatitude(37.3272);
      setNewVineyardLongitude(-122.2813);
    } catch (error) {
      console.error('Error creating vineyard:', error);
      alert('Failed to create vineyard: ' + (error as Error).message);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0', fontSize: '1.25rem', color: '#374151' }}>
          🍇 Vineyard Management
        </h3>
        <button
          onClick={() => setShowCreateVineyard(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus size={16} />
          Add Vineyard
        </button>
      </div>

      {/* Current vineyard highlight */}
      {currentVineyard && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f0f9ff',
          border: '2px solid #0ea5e9',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>🍇</span>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#0369a1' }}>
              Currently Viewing: {currentVineyard.name}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={14} />
            {currentVineyard.latitude.toFixed(4)}, {currentVineyard.longitude.toFixed(4)}
          </div>
        </div>
      )}

      {/* Vineyard list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {userVineyards.map((vineyard) => (
          <div
            key={vineyard.id}
            style={{
              padding: '16px',
              backgroundColor: 'white',
              border: currentVineyard?.id === vineyard.id ? '2px solid #22c55e' : '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {editingVineyardId === vineyard.id ? (
              // Editing mode
              <div>
                {editingVineyardLocation ? (
                  // Location editing
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      type="text"
                      value={editingVineyardName}
                      onChange={(e) => setEditingVineyardName(e.target.value)}
                      placeholder="Vineyard name"
                      style={{
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={locationSearch}
                        onChange={(e) => setLocationSearch(e.target.value)}
                        placeholder="Search for new location..."
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
                      />
                      <button
                        onClick={handleLocationSearch}
                        disabled={isSearching}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        <Search size={14} />
                      </button>
                    </div>
                    
                    {/* Search results */}
                    {showSearchResults && searchResults.length > 0 && (
                      <div style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {searchResults.map((result, index) => (
                          <div
                            key={index}
                            onClick={() => selectLocation(result)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: index < searchResults.length - 1 ? '1px solid #e5e7eb' : 'none',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div style={{ fontWeight: '500' }}>{result.name}</div>
                            <div style={{ color: '#6b7280', fontSize: '12px' }}>
                              {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => saveVineyardChanges(vineyard.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Save size={12} />
                        Save Location
                      </button>
                      <button
                        onClick={cancelEditingVineyard}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <X size={12} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Name editing
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={editingVineyardName}
                      onChange={(e) => setEditingVineyardName(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && saveVineyardChanges(vineyard.id)}
                    />
                    <button
                      onClick={() => saveVineyardChanges(vineyard.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <Save size={12} />
                    </button>
                    <button
                      onClick={cancelEditingVineyard}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Display mode
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                      {vineyard.name}
                    </h4>
                    <div style={{ fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} />
                      {vineyard.latitude.toFixed(4)}, {vineyard.longitude.toFixed(4)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {currentVineyard?.id !== vineyard.id && (
                      <button
                        onClick={() => onVineyardSwitch(vineyard)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Switch To
                      </button>
                    )}
                    <button
                      onClick={() => startEditingVineyard(vineyard)}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={() => startEditingVineyardLocation(vineyard)}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <MapPin size={12} />
                    </button>
                    <button
                      onClick={() => onVineyardDelete(vineyard)}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                  ID: {vineyard.id.slice(0, 8)}...
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {userVineyards.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '2px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🍇</div>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Vineyards Yet</h4>
          <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
            Create your first vineyard to start tracking weather and phenology data.
          </p>
          <button
            onClick={() => setShowCreateVineyard(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Create First Vineyard
          </button>
        </div>
      )}

      {/* Create vineyard modal */}
      {showCreateVineyard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
              Create New Vineyard
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                  Vineyard Name
                </label>
                <input
                  type="text"
                  value={newVineyardName}
                  onChange={(e) => setNewVineyardName(e.target.value)}
                  placeholder="Enter vineyard name"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                  Location
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    placeholder="Search for location..."
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
                  />
                  <button
                    onClick={handleLocationSearch}
                    disabled={isSearching}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    <Search size={14} />
                  </button>
                </div>

                {/* Search results */}
                {showSearchResults && searchResults.length > 0 && (
                  <div style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginBottom: '8px'
                  }}>
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        onClick={() => selectLocation(result)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: index < searchResults.length - 1 ? '1px solid #e5e7eb' : 'none',
                          fontSize: '14px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <div style={{ fontWeight: '500' }}>{result.name}</div>
                        <div style={{ color: '#6b7280', fontSize: '12px' }}>
                          {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Selected: {newVineyardLatitude.toFixed(4)}, {newVineyardLongitude.toFixed(4)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={createVineyard}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Create Vineyard
              </button>
              <button
                onClick={() => {
                  setShowCreateVineyard(false);
                  setNewVineyardName('');
                  setNewVineyardLatitude(37.3272);
                  setNewVineyardLongitude(-122.2813);
                  setLocationSearch('');
                  setShowSearchResults(false);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
