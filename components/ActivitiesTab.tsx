
import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, FileText, MapPin, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ReportsModal } from './ReportsModal';
import BlockSelector from './BlockSelector';

interface ActivitiesTabProps {
  vineyardId: string;
  currentVineyard: any;
  activities: any[];
  onActivitiesChange: () => void;
  selectedOrganization: any;
  selectedProperty: any;
  selectedBlockIds: string[];
  onSelectedBlockIdsChange: (blockIds: string[]) => void;
}

export function ActivitiesTab({ 
  vineyardId, 
  currentVineyard, 
  activities, 
  onActivitiesChange,
  selectedOrganization,
  selectedProperty,
  selectedBlockIds,
  onSelectedBlockIdsChange
}: ActivitiesTabProps) {
  // Activity form state
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
    location_lat: null as number | null,
    location_lng: null as number | null,
    location_name: '',
    location_accuracy: null as number | null,
    // Spray application specific fields
    spray_product: '',
    spray_quantity: '',
    spray_unit: 'oz/acre',
    spray_target: '',
    spray_conditions: '',
    spray_equipment: '',
    // Irrigation specific fields
    irrigation_amount: '',
    irrigation_unit: 'inches',
    irrigation_method: '',
    irrigation_duration: '',
    // Fertilization specific fields
    fertilizer_type: '',
    fertilizer_npk: '',
    fertilizer_rate: '',
    fertilizer_unit: 'lbs/acre',
    fertilizer_method: '',
    // Harvest specific fields
    harvest_yield: '',
    harvest_unit: 'tons/acre',
    harvest_brix: '',
    harvest_ph: '',
    harvest_ta: '',
    harvest_block: '',
    // Canopy management specific fields
    canopy_activity: '',
    canopy_intensity: '',
    canopy_side: '',
    canopy_stage: '',
    // Scouting/Pest specific fields
    scout_focus: '',
    scout_severity: '',
    scout_distribution: '',
    scout_action: ''
  });

  // Edit activity state
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editActivityForm, setEditActivityForm] = useState({
    activity_type: '',
    start_date: '',
    end_date: '',
    notes: '',
    location_lat: null as number | null,
    location_lng: null as number | null,
    location_name: '',
    location_accuracy: null as number | null,
    // All the same fields as activityForm
    spray_product: '',
    spray_quantity: '',
    spray_unit: 'oz/acre',
    spray_target: '',
    spray_conditions: '',
    spray_equipment: '',
    irrigation_amount: '',
    irrigation_unit: 'inches',
    irrigation_method: '',
    irrigation_duration: '',
    fertilizer_type: '',
    fertilizer_npk: '',
    fertilizer_rate: '',
    fertilizer_unit: 'lbs/acre',
    fertilizer_method: '',
    harvest_yield: '',
    harvest_unit: 'tons/acre',
    harvest_brix: '',
    harvest_ph: '',
    harvest_ta: '',
    harvest_block: '',
    canopy_activity: '',
    canopy_intensity: '',
    canopy_side: '',
    canopy_stage: '',
    scout_focus: '',
    scout_severity: '',
    scout_distribution: '',
    scout_action: ''
  });

  // Loading and form states
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isUpdatingActivity, setIsUpdatingActivity] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showReportsModal, setShowReportsModal] = useState(false);

  // Event filtering
  const [eventFilterTypes, setEventFilterTypes] = useState<string[]>([]);
  const [showEventFilterDropdown, setShowEventFilterDropdown] = useState(false);

  // Location search (for future implementation)
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Activity types
  const activityTypes = [
    'Pruning',
    'Bud Break',
    'Bloom',
    'Fruit Set',
    'Veraison',
    'Harvest',
    'Irrigation',
    'Spray Application',
    'Fertilization',
    'Canopy Management',
    'Soil Work',
    'Equipment Maintenance',
    'Pest',
    'Scouting',
    'Other'
  ];

  // Spray database for safety information
  const sprayDatabase = {
    'Captan': { reentryHours: 48, preharvestDays: 14, category: 'Fungicide', signal: 'CAUTION' },
    'Copper Sulfate': { reentryHours: 24, preharvestDays: 0, category: 'Fungicide', signal: 'CAUTION' },
    'Sulfur': { reentryHours: 24, preharvestDays: 0, category: 'Fungicide', signal: 'CAUTION' },
    'Mancozeb': { reentryHours: 24, preharvestDays: 66, category: 'Fungicide', signal: 'CAUTION' },
    'Chlorothalonil': { reentryHours: 12, preharvestDays: 42, category: 'Fungicide', signal: 'WARNING' },
    'Propiconazole': { reentryHours: 24, preharvestDays: 30, category: 'Fungicide', signal: 'CAUTION' },
    'Myclobutanil': { reentryHours: 12, preharvestDays: 21, category: 'Fungicide', signal: 'CAUTION' },
    'Tebuconazole': { reentryHours: 12, preharvestDays: 45, category: 'Fungicide', signal: 'CAUTION' },
    'Imidacloprid': { reentryHours: 12, preharvestDays: 7, category: 'Insecticide', signal: 'CAUTION' },
    'Spinosad': { reentryHours: 4, preharvestDays: 7, category: 'Insecticide', signal: 'CAUTION' },
    'Carbaryl': { reentryHours: 12, preharvestDays: 7, category: 'Insecticide', signal: 'CAUTION' },
    'Malathion': { reentryHours: 12, preharvestDays: 1, category: 'Insecticide', signal: 'WARNING' },
    'Glyphosate': { reentryHours: 4, preharvestDays: 14, category: 'Herbicide', signal: 'CAUTION' },
    '2,4-D': { reentryHours: 48, preharvestDays: 60, category: 'Herbicide', signal: 'DANGER' },
    'Dicamba': { reentryHours: 24, preharvestDays: 21, category: 'Herbicide', signal: 'WARNING' },
    'Paraquat': { reentryHours: 12, preharvestDays: 21, category: 'Herbicide', signal: 'DANGER' },
    'Roundup': { reentryHours: 4, preharvestDays: 14, category: 'Herbicide', signal: 'CAUTION' },
    'Bt (Bacillus thuringiensis)': { reentryHours: 4, preharvestDays: 0, category: 'Biological', signal: 'CAUTION' },
    'Kaolin Clay': { reentryHours: 4, preharvestDays: 0, category: 'Protectant', signal: 'CAUTION' },
    'Neem Oil': { reentryHours: 4, preharvestDays: 0, category: 'Botanical', signal: 'CAUTION' },
    'Horticultural Oil': { reentryHours: 4, preharvestDays: 0, category: 'Oil', signal: 'CAUTION' }
  };

  // Location services
  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    setLocationError('');

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
          }
        );
      });

      const { latitude, longitude, accuracy } = position.coords;

      setActivityForm(prev => ({
        ...prev,
        location_lat: latitude,
        location_lng: longitude,
        location_accuracy: accuracy,
        location_name: `📍 Current Location (±${Math.round(accuracy)}m)`
      }));

    } catch (error: any) {
      let errorMessage = 'Failed to get location';
      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location permissions.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please try again.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      }
      setLocationError(errorMessage);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const useVineyardLocation = () => {
    if (currentVineyard) {
      setActivityForm(prev => ({
        ...prev,
        location_lat: currentVineyard.latitude,
        location_lng: currentVineyard.longitude,
        location_accuracy: null,
        location_name: `🍇 ${currentVineyard.name}`
      }));
      setLocationError('');
    }
  };

  const clearLocation = () => {
    setActivityForm(prev => ({
      ...prev,
      location_lat: null,
      location_lng: null,
      location_accuracy: null,
      location_name: ''
    }));
    setLocationError('');
  };

  // Save new activity
  const saveActivity = async () => {
    if (!vineyardId || !activityForm.activity_type || !activityForm.start_date) {
      alert('Please fill in activity type and start date');
      return;
    }

    setIsSavingActivity(true);
    try {
      // Import the save function
      const { savePhenologyEvent } = await import('../lib/supabase');

      await savePhenologyEvent(
        vineyardId,
        activityForm.activity_type.toLowerCase().replace(' ', '_'),
        activityForm.start_date,
        activityForm.notes,
        activityForm.end_date || undefined,
        activityForm.harvest_block || undefined,
        selectedBlockIds,
        { latitude: currentVineyard?.latitude || 0, longitude: currentVineyard?.longitude || 0, locationName: currentVineyard?.name || '' },
        // Add all event-specific data based on type
        activityForm.activity_type === 'Spray Application' && activityForm.spray_product ? {
          product: activityForm.spray_product,
          quantity: activityForm.spray_quantity,
          unit: activityForm.spray_unit,
          target: activityForm.spray_target,
          conditions: activityForm.spray_conditions,
          equipment: activityForm.spray_equipment
        } : undefined,
        activityForm.activity_type === 'Irrigation' ? {
          amount: activityForm.irrigation_amount,
          unit: activityForm.irrigation_unit,
          method: activityForm.irrigation_method,
          duration: activityForm.irrigation_duration
        } : undefined,
        activityForm.activity_type === 'Fertilization' ? {
          type: activityForm.fertilizer_type,
          npk: activityForm.fertilizer_npk,
          rate: activityForm.fertilizer_rate,
          unit: activityForm.fertilizer_unit,
          method: activityForm.fertilizer_method
        } : undefined,
        activityForm.activity_type === 'Harvest' ? {
          yield: activityForm.harvest_yield,
          unit: activityForm.harvest_unit,
          brix: activityForm.harvest_brix,
          ph: activityForm.harvest_ph,
          ta: activityForm.harvest_ta,
          block: activityForm.harvest_block
        } : undefined,
        activityForm.activity_type === 'Canopy Management' ? {
          activity: activityForm.canopy_activity,
          intensity: activityForm.canopy_intensity,
          side: activityForm.canopy_side,
          stage: activityForm.canopy_stage
        } : undefined,
        (activityForm.activity_type === 'Scouting' || activityForm.activity_type === 'Pest') ? {
          focus: activityForm.scout_focus,
          severity: activityForm.scout_severity,
          distribution: activityForm.scout_distribution,
          action: activityForm.scout_action
        } : undefined
      );

      // Reset form
      setActivityForm({
        activity_type: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: '',
        location_lat: null,
        location_lng: null,
        location_name: '',
        location_accuracy: null,
        spray_product: '',
        spray_quantity: '',
        spray_unit: 'oz/acre',
        spray_target: '',
        spray_conditions: '',
        spray_equipment: '',
        irrigation_amount: '',
        irrigation_unit: 'inches',
        irrigation_method: '',
        irrigation_duration: '',
        fertilizer_type: '',
        fertilizer_npk: '',
        fertilizer_rate: '',
        fertilizer_unit: 'lbs/acre',
        fertilizer_method: '',
        harvest_yield: '',
        harvest_unit: 'tons/acre',
        harvest_brix: '',
        harvest_ph: '',
        harvest_ta: '',
        harvest_block: '',
        canopy_activity: '',
        canopy_intensity: '',
        canopy_side: '',
        canopy_stage: '',
        scout_focus: '',
        scout_severity: '',
        scout_distribution: '',
        scout_action: ''
      });
      onSelectedBlockIdsChange([]);
      setShowActivityForm(false);

      // Reload activities
      onActivitiesChange();

      // Trigger chart refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('phenologyEventsChanged', {
          detail: { vineyardId }
        }));
      }

    } catch (error) {
      console.error('Failed to save activity:', error);
      alert('Failed to save activity: ' + (error as Error).message);
    } finally {
      setIsSavingActivity(false);
    }
  };

  // Delete activity
  const deleteActivity = async (activityId: string, activityType: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${activityType} event?`)) {
      return;
    }

    try {
      const { deletePhenologyEvent } = await import('../lib/supabase');
      await deletePhenologyEvent(activityId);
      onActivitiesChange();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('phenologyEventsChanged', {
          detail: { vineyardId }
        }));
      }

    } catch (error) {
      console.error('Failed to delete activity:', error);
      alert('Failed to delete activity: ' + (error as Error).message);
    }
  };

  // Get event style
  const getEventStyle = (eventType: string) => {
    const eventStyles: { [key: string]: { color: string, label: string, emoji: string } } = {
      bud_break: { color: "#22c55e", label: "Bud Break", emoji: "🌱" },
      bloom: { color: "#f59e0b", label: "Bloom", emoji: "🌸" },
      veraison: { color: "#8b5cf6", label: "Veraison", emoji: "🍇" },
      harvest: { color: "#ef4444", label: "Harvest", emoji: "🍷" },
      pruning: { color: "#6366f1", label: "Pruning", emoji: "✂️" },
      irrigation: { color: "#06b6d4", label: "Irrigation", emoji: "💧" },
      spray_application: { color: "#f97316", label: "Spray Application", emoji: "🌿" },
      fertilization: { color: "#84cc16", label: "Fertilization", emoji: "🌱" },
      canopy_management: { color: "#10b981", label: "Canopy Management", emoji: "🍃" },
      soil_work: { color: "#8b5cf6", label: "Soil Work", emoji: "📝" },
      equipment_maintenance: { color: "#6b7280", label: "Equipment Maintenance", emoji: "🔧" },
      fruit_set: { color: "#f59e0b", label: "Fruit Set", emoji: "🫐" },
      pest: { color: "#dc2626", label: "Pest Observation", emoji: "🐞" },
      scouting: { color: "#059669", label: "Scouting", emoji: "🔍" },
      other: { color: "#9ca3af", label: "Other", emoji: "📝" },
    };

    let normalizedEventType = eventType?.toLowerCase().replace(/\s+/g, '_') || 'other';
    if (normalizedEventType === 'pest_observation') normalizedEventType = 'pest';
    if (normalizedEventType === 'scouting_activity') normalizedEventType = 'scouting';

    return eventStyles[normalizedEventType] || eventStyles.other;
  };

  // Filter activities
  const filteredActivities = activities.filter(activity => {
    if (eventFilterTypes.length === 0) return true;
    const eventType = activity.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';
    return eventFilterTypes.includes(eventType);
  });

  // Calculate location statistics
  const eventsWithLocation = activities.filter(activity =>
    activity.location_lat && activity.location_lng
  );

  return (
    <div style={{ padding: '12px' }}>
      {/* Mobile-optimized Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ 
              margin: '0 0 6px 0', 
              fontSize: '18px', 
              color: '#374151', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              lineHeight: '1.3'
            }}>
              🌱 Event Log
            </h3>
            {activities.length > 0 && (
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <span>{activities.length} total</span>
                <span>•</span>
                <span style={{ color: '#059669' }}>{eventsWithLocation.length} with location</span>
              </div>
            )}
          </div>
          
          {/* Filter Button - Mobile friendly */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setShowEventFilterDropdown(!showEventFilterDropdown)}
              style={{
                padding: "8px 12px",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                minHeight: '40px'
              }}
            >
              🔍 {eventFilterTypes.length > 0 ? `${eventFilterTypes.length}` : 'All'}
            </button>

            {showEventFilterDropdown && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: "0",
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 1000,
                minWidth: "240px",
                maxHeight: "280px",
                overflowY: "auto"
              }}>
                <div style={{ padding: "12px", borderBottom: "1px solid #eee", fontWeight: "600", fontSize: "13px" }}>
                  Filter by Event Type
                </div>
                <div style={{ padding: "8px" }}>
                  <button
                    onClick={() => setEventFilterTypes([])}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      backgroundColor: eventFilterTypes.length === 0 ? "#e0f2fe" : "transparent",
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "13px",
                      borderRadius: "6px",
                      marginBottom: "4px"
                    }}
                  >
                    Show All Events
                  </button>
                  {activityTypes.map((type) => {
                    const eventType = type.toLowerCase().replace(' ', '_');
                    const style = getEventStyle(eventType);
                    const isSelected = eventFilterTypes.includes(eventType);
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          if (isSelected) {
                            setEventFilterTypes(prev => prev.filter(t => t !== eventType));
                          } else {
                            setEventFilterTypes(prev => [...prev, eventType]);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          backgroundColor: isSelected ? "#e0f2fe" : "transparent",
                          border: "none",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          borderRadius: "6px",
                          marginBottom: "2px"
                        }}
                      >
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            backgroundColor: style.color,
                            borderRadius: "50%",
                            flexShrink: 0
                          }}
                        ></div>
                        <span style={{ fontSize: '14px', marginRight: '4px' }}>{style.emoji}</span>
                        <span style={{ flex: 1 }}>{style.label}</span>
                        {isSelected && <span style={{ color: "#22c55e", fontSize: '14px' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Action Buttons Row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
          gap: '8px',
          marginTop: '12px'
        }}>
          {/* Route Button */}
          {(() => {
            const eventsWithLocationFiltered = filteredActivities.filter(activity =>
              activity.location_lat && activity.location_lng
            );

            if (eventsWithLocationFiltered.length > 0) {
              const sortedEvents = eventsWithLocationFiltered.sort((a, b) =>
                new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
              );

              return (
                <a
                  href={(() => {
                    if (sortedEvents.length === 1) {
                      const event = sortedEvents[0];
                      return `https://www.google.com/maps?q=${event.location_lat},${event.location_lng}&z=18`;
                    } else {
                      const waypoints = sortedEvents.slice(1, -1).map(event =>
                        `${event.location_lat},${event.location_lng}`
                      ).join('|');

                      const origin = `${sortedEvents[0].location_lat},${sortedEvents[0].location_lng}`;
                      const destination = `${sortedEvents[sortedEvents.length - 1].location_lat},${sortedEvents[sortedEvents.length - 1].location_lng}`;

                      return waypoints.length > 0
                        ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}`
                        : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
                    }
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: '500',
                    textAlign: 'center',
                    minHeight: '44px'
                  }}
                >
                  🗺️ Route ({sortedEvents.length})
                </a>
              );
            }
            return null;
          })()}

          {/* Reports Button */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('switchToTab', {
                  detail: { tabId: 'reports' }
                }));
              }
            }}
            disabled={!currentVineyard || activities.length === 0}
            style={{
              padding: '10px 12px',
              backgroundColor: !currentVineyard || activities.length === 0 ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: !currentVineyard || activities.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: '500',
              minHeight: '44px'
            }}
          >
            <FileText size={14} />
            📊 Reports
          </button>
        </div>
      </div>

      {/* Mobile-optimized Add Event Button */}
      {!showActivityForm && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setShowActivityForm(true)}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)',
              minHeight: '52px'
            }}
          >
            ➕ Add New Event
          </button>
        </div>
      )}

      {/* Mobile-optimized Activity Form */}
      {showActivityForm && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          border: '2px solid #22c55e',
          borderRadius: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: '0', color: '#059669', fontSize: '18px', fontWeight: '700' }}>
              ➕ Add New Event
            </h4>
            <button
              onClick={() => setShowActivityForm(false)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>

          {/* Mobile-first stacked form layout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '15px', color: '#374151' }}>
                Event Type *
              </label>
              <select
                value={activityForm.activity_type}
                onChange={(e) => setActivityForm(prev => ({ ...prev, activity_type: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  fontSize: '16px',
                  minHeight: '48px'
                }}
                required
              >
                <option value="">Select event type...</option>
                {activityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '15px', color: '#374151' }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={activityForm.start_date}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, start_date: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px',
                    minHeight: '48px'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '15px', color: '#374151' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={activityForm.end_date}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, end_date: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px',
                    minHeight: '48px'
                  }}
                  min={activityForm.start_date}
                />
              </div>
            </div>
          </div>

          {/* Block Selection */}
          {selectedProperty && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                  Select Blocks (Optional)
                </label>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                  Choose which vineyard blocks this event applies to, or leave empty for vineyard-wide events.
                </div>
              </div>
              <BlockSelector
                propertyId={selectedProperty.id}
                selectedBlockIds={selectedBlockIds}
                onBlocksChange={onSelectedBlockIdsChange}
                disabled={isSavingActivity}
              />
            </div>
          )}

          {/* Mobile-optimized Location Section */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#fefce8',
            border: '2px solid #fde68a',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>📍</span>
              <label style={{ fontWeight: '600', fontSize: '16px', color: '#a16207' }}>
                Location (Optional)
              </label>
            </div>

            {activityForm.location_lat && activityForm.location_lng ? (
              <div style={{
                padding: '12px',
                backgroundColor: '#f0fdf4',
                border: '2px solid #bbf7d0',
                borderRadius: '8px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ fontSize: '14px', color: '#065f46', flex: 1, minWidth: 0 }}>
                  📍 {activityForm.location_name || 'Location set'}
                </div>
                <button
                  onClick={clearLocation}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    flexShrink: 0
                  }}
                >
                  Clear
                </button>
              </div>
            ) : (
              <div style={{
                padding: '12px',
                backgroundColor: '#f8fafc',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '12px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', color: '#92400e' }}>
                  No location set for this event
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: isGettingLocation ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: '600',
                  minHeight: '48px'
                }}
              >
                {isGettingLocation ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Getting Location...
                  </>
                ) : (
                  '📍 Check In at Current Location'
                )}
              </button>

              {currentVineyard && (
                <button
                  type="button"
                  onClick={useVineyardLocation}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: '600',
                    minHeight: '48px'
                  }}
                >
                  🍇 Use Vineyard Location
                </button>
              )}
            </div>

            {locationError && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#fef2f2',
                border: '2px solid #fecaca',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#991b1b'
              }}>
                {locationError}
              </div>
            )}
          </div>

          {/* Mobile-optimized Notes */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '15px', color: '#374151' }}>
              Notes (Optional)
            </label>
            <textarea
              value={activityForm.notes}
              onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any details about this event..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                minHeight: '80px',
                resize: 'vertical',
                fontSize: '16px'
              }}
            />
          </div>

          {/* Mobile-optimized Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={saveActivity}
              disabled={isSavingActivity || !activityForm.activity_type || !activityForm.start_date}
              style={{
                width: '100%',
                padding: '16px 20px',
                backgroundColor: isSavingActivity || !activityForm.activity_type || !activityForm.start_date ? '#9ca3af' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isSavingActivity || !activityForm.activity_type || !activityForm.start_date ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: '600',
                minHeight: '52px'
              }}
            >
              {isSavingActivity ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : '💾'}
              {isSavingActivity ? 'Saving Event...' : 'Save Event'}
            </button>

            <button
              onClick={() => setShowActivityForm(false)}
              style={{
                width: '100%',
                padding: '12px 20px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minHeight: '44px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Activity List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: '0', fontSize: '16px', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📅 Event History ({filteredActivities.length} total)
          </h4>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Total: {activities.length} events
            </span>
            <button
              onClick={onActivitiesChange}
              disabled={isLoadingActivities}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} style={{ animation: isLoadingActivities ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>

        {filteredActivities.length === 0 ? (
          <div style={{
            padding: '32px 24px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
            <h4 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '18px' }}>
              {activities.length === 0 ? 'No Events Logged' : 'No Events Match Filter'}
            </h4>
            <p style={{ 
              margin: '0', 
              color: '#6b7280', 
              fontSize: '15px',
              lineHeight: '1.5',
              maxWidth: '280px',
              margin: '0 auto'
            }}>
              {activities.length === 0
                ? 'Start logging your vineyard events to track phenology and activities throughout the season.'
                : `${activities.length} events total, but none match the current filter. Clear the filter to see all events.`
              }
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {filteredActivities.map((activity, index) => {
              const style = getEventStyle(activity.event_type);
              const blockNames = activity.blocks && Array.isArray(activity.blocks)
                ? activity.blocks.map((block: any) => block.name).join(', ')
                : '';

              return (
                <div
                  key={activity.id || index}
                  style={{
                    padding: '16px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* Header with event type and actions */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start', 
                    marginBottom: '12px',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: style.color,
                          borderRadius: '50%',
                          flexShrink: 0
                        }}
                      ></div>
                      <span style={{ fontSize: '20px', flexShrink: 0 }}>{style.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: '600',
                          fontSize: '16px',
                          color: '#374151',
                          marginBottom: '4px'
                        }}>
                          {style.label}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          {new Date(activity.event_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          {activity.end_date && activity.end_date !== activity.event_date && (
                            <span> → {new Date(activity.end_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile-optimized action buttons */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      {activity.location_lat && activity.location_lng && (
                        <a
                          href={`https://www.google.com/maps?q=${activity.location_lat},${activity.location_lng}&z=18`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '8px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '40px',
                            minHeight: '40px'
                          }}
                        >
                          <MapPin size={16} />
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Edit activity:', activity.id);
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '40px',
                          minHeight: '40px'
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteActivity(activity.id, style.label);
                        }}
                        style={{
                          padding: '8px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '40px',
                          minHeight: '40px'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Block Information */}
                  {blockNames && (
                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}>
                      <span>🏷️ Blocks:</span>
                      <span style={{
                        backgroundColor: '#e0f2fe',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '12px'
                      }}>
                        {blockNames}
                      </span>
                    </div>
                  )}

                  {/* Notes and location */}
                  {(activity.notes || activity.location_name) && (
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {activity.notes && (
                        <div style={{
                          marginBottom: '6px',
                          lineHeight: '1.4',
                          backgroundColor: '#f8fafc',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          💬 {activity.notes}
                        </div>
                      )}
                      {activity.location_name && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexWrap: 'wrap'
                        }}>
                          <span>📍 {activity.location_name}</span>
                          {activity.location_accuracy && (
                            <span style={{ 
                              fontSize: '11px', 
                              color: '#9ca3af',
                              backgroundColor: '#f3f4f6',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              ±{Math.round(activity.location_accuracy)}m
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reports Modal */}
      {showReportsModal && currentVineyard && (
        <ReportsModal
          isOpen={showReportsModal}
          onClose={() => setShowReportsModal(false)}
          vineyard={currentVineyard}
          activities={activities}
        />
      )}
    </div>
  );
}
