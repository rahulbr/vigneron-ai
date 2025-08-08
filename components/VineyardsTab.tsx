
import React, { useState, useEffect } from 'react';
import { MapPin, Edit, Trash2, Plus, Save, X, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';

interface VineyardsTabProps {
  userVineyards: any[];
  currentVineyard: any | null;
  onVineyardChange: (vineyard: any) => void;
  onVineyardsUpdate: () => void;
}

export function VineyardsTab({ 
  userVineyards, 
  currentVineyard, 
  onVineyardChange, 
  onVineyardsUpdate 
}: VineyardsTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVineyardId, setEditingVineyardId] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [newVineyard, setNewVineyard] = useState({
    name: '',
    location: '',
    latitude: 37.3272, // La Honda, CA fallback
    longitude: -122.2813
  });

  const [editForm, setEditForm] = useState({
    name: '',
    location: '',
    latitude: 0,
    longitude: 0
  });

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
    if (editingVineyardId) {
      setEditForm(prev => ({
        ...prev,
        location: location.name,
        latitude: location.latitude,
        longitude: location.longitude
      }));
    } else {
      setNewVineyard(prev => ({
        ...prev,
        location: location.name,
        latitude: location.latitude,
        longitude: location.longitude
      }));
    }
    setShowSearchResults(false);
    setLocationSearch('');
  };

  // Create new vineyard
  const createVineyard = async () => {
    if (!newVineyard.name.trim()) {
      alert('Please enter a vineyard name');
      return;
    }

    setIsCreating(true);
    try {
      const { createVineyard } = await import('../lib/supabase');
      const vineyard = await createVineyard(
        newVineyard.name.trim(),
        newVineyard.location || 'Unknown Location',
        newVineyard.latitude,
        newVineyard.longitude
      );

      // Reset form
      setNewVineyard({
        name: '',
        location: '',
        latitude: 37.3272,
        longitude: -122.2813
      });
      setShowCreateForm(false);

      // Update parent component
      onVineyardsUpdate();

      // Switch to new vineyard
      onVineyardChange(vineyard);

    } catch (error) {
      console.error('Error creating vineyard:', error);
      alert('Failed to create vineyard: ' + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  // Start editing a vineyard
  const startEditing = (vineyard: any) => {
    setEditingVineyardId(vineyard.id);
    setEditForm({
      name: vineyard.name,
      location: vineyard.location || '',
      latitude: vineyard.latitude,
      longitude: vineyard.longitude
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingVineyardId(null);
    setEditForm({
      name: '',
      location: '',
      latitude: 0,
      longitude: 0
    });
  };

  // Save vineyard changes
  const saveVineyard = async (vineyardId: string) => {
    if (!editForm.name.trim()) {
      alert('Please enter a vineyard name');
      return;
    }

    setIsUpdating(true);
    try {
      const { saveVineyardLocation } = await import('../lib/supabase');
      const updatedVineyard = await saveVineyardLocation(
        vineyardId,
        editForm.latitude,
        editForm.longitude,
        editForm.name.trim()
      );

      // Update parent component
      onVineyardsUpdate();

      // If this is the current vineyard, update it
      if (currentVineyard?.id === vineyardId) {
        onVineyardChange(updatedVineyard);
      }

      cancelEditing();

    } catch (error) {
      console.error('Error updating vineyard:', error);
      alert('Failed to update vineyard: ' + (error as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete vineyard
  const deleteVineyard = async (vineyard: any) => {
    const confirmMessage = `⚠️ WARNING: Delete Vineyard "${vineyard.name}"?\n\n` +
      `This action will permanently delete:\n` +
      `• The vineyard "${vineyard.name}"\n` +
      `• All weather data for this vineyard\n` +
      `• All phenology events and activity logs\n` +
      `• All associated historical data\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "DELETE" to confirm:`;

    const confirmation = window.prompt(confirmMessage);

    if (confirmation !== 'DELETE') {
      if (confirmation !== null) {
        alert('Deletion cancelled. You must type "DELETE" exactly to confirm.');
      }
      return;
    }

    try {
      // Delete all associated data
      await supabase
        .from('phenology_events')
        .delete()
        .eq('vineyard_id', vineyard.id);

      await supabase
        .from('weather_data')
        .delete()
        .eq('vineyard_id', vineyard.id);

      await supabase
        .from('vineyards')
        .delete()
        .eq('id', vineyard.id);

      // Update parent component
      onVineyardsUpdate();

      // If this was the current vineyard, switch to another one
      if (currentVineyard?.id === vineyard.id && userVineyards.length > 1) {
        const remainingVineyards = userVineyards.filter(v => v.id !== vineyard.id);
        if (remainingVineyards.length > 0) {
          onVineyardChange(remainingVineyards[0]);
        }
      }

      alert(`✅ Vineyard "${vineyard.name}" has been deleted.`);

    } catch (error) {
      console.error('Error deleting vineyard:', error);
      alert('Failed to delete vineyard: ' + (error as Error).message);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0', fontSize: '1.25rem', color: '#374151' }}>
          🍇 Vineyard Management
        </h3>
        <button
          onClick={() => setShowCreateForm(true)}
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

      {/* Current Vineyard Info */}
      {currentVineyard && (
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>📍</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1' }}>
              Currently Active: {currentVineyard.name}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#0284c7' }}>
            Location: {currentVineyard.latitude.toFixed(4)}, {currentVineyard.longitude.toFixed(4)}
          </div>
        </div>
      )}

      {/* Create Vineyard Form */}
      {showCreateForm && (
        <div style={{
          backgroundColor: 'white',
          border: '2px solid #22c55e',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: '0', fontSize: '16px', color: '#059669' }}>
              Add New Vineyard
            </h4>
            <button
              onClick={() => setShowCreateForm(false)}
              style={{
                padding: '4px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Vineyard Name *
              </label>
              <input
                type="text"
                value={newVineyard.name}
                onChange={(e) => setNewVineyard(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter vineyard name..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Location Search */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Location
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search for location..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleLocationSearch();
                  }
                }}
              />
              <button
                onClick={handleLocationSearch}
                disabled={isSearching || !locationSearch.trim()}
                style={{
                  padding: '8px 12px',
                  backgroundColor: isSearching ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSearching ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isSearching ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                Search
              </button>
            </div>

            {/* Search Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div style={{
                marginTop: '8px',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => selectLocation(result)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderBottom: index < searchResults.length - 1 ? '1px solid #e5e7eb' : 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      {result.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Location Display */}
            {newVineyard.location && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#065f46'
              }}>
                📍 {newVineyard.location} ({newVineyard.latitude.toFixed(4)}, {newVineyard.longitude.toFixed(4)})
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={createVineyard}
              disabled={isCreating || !newVineyard.name.trim()}
              style={{
                padding: '10px 16px',
                backgroundColor: isCreating || !newVineyard.name.trim() ? '#9ca3af' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isCreating || !newVineyard.name.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isCreating ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
              {isCreating ? 'Creating...' : 'Create Vineyard'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              style={{
                padding: '10px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Vineyard List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <h4 style={{ margin: '0', fontSize: '16px', color: '#374151' }}>
            Your Vineyards ({userVineyards.length})
          </h4>
        </div>

        {userVineyards.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🍇</div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>No Vineyards Yet</h4>
            <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
              Create your first vineyard to start tracking weather and activities.
            </p>
          </div>
        ) : (
          <div>
            {userVineyards.map((vineyard, index) => (
              <div
                key={vineyard.id}
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: index < userVineyards.length - 1 ? '1px solid #e5e7eb' : 'none',
                  backgroundColor: currentVineyard?.id === vineyard.id ? '#f0f9ff' : 'white'
                }}
              >
                {editingVineyardId === vineyard.id ? (
                  /* Edit Form */
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => saveVineyard(vineyard.id)}
                        disabled={isUpdating}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: isUpdating ? '#9ca3af' : '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isUpdating ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                        Save
                      </button>
                      <button
                        onClick={cancelEditing}
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
                  </div>
                ) : (
                  /* Display Mode */
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h5 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                          {vineyard.name}
                        </h5>
                        {currentVineyard?.id === vineyard.id && (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: '#22c55e',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6b7280' }}>
                        <MapPin size={12} />
                        <span>{vineyard.latitude.toFixed(4)}, {vineyard.longitude.toFixed(4)}</span>
                        <span>•</span>
                        <span>ID: {vineyard.id.slice(0, 8)}...</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {currentVineyard?.id !== vineyard.id && (
                        <button
                          onClick={() => onVineyardChange(vineyard)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          Switch To
                        </button>
                      )}
                      <button
                        onClick={() => startEditing(vineyard)}
                        style={{
                          padding: '6px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => deleteVineyard(vineyard)}
                        style={{
                          padding: '6px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
