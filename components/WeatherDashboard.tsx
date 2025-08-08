// components/WeatherDashboard.tsx - COMPLETE Fixed Version with All Features

import React, { useState, useEffect, useCallback } from 'react';
import { useWeather, useWeatherConnection } from '../hooks/useWeather';
import { EnhancedGDDChart } from './EnhancedGDDChart';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';
import { supabase } from '../lib/supabase';
import { AlertCircle, RefreshCw, MapPin, Calendar, Thermometer, CloudRain, TrendingUp, Search, FileText } from 'lucide-react';
import { TabNavigation } from './TabNavigation';
import { MobileBottomTabs } from './MobileBottomTabs';
import { MobileRefresh } from './MobileRefresh';
import { ActivitiesTab } from './ActivitiesTab';
import { InsightsTab } from './InsightsTab';
import { VineyardsTab } from './VineyardsTab';
import { ReportsTab } from './ReportsTab';
import { Organization, Property, Block } from '../lib/supabase';
import BlockSelector from './BlockSelector';
// Using existing useWeather hook instead of direct weatherService import

// Placeholder for ReportsModal component if it's defined elsewhere
const ReportsModal = ({ isOpen, onClose, vineyard, activities }: any) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        width: '80%',
        maxWidth: '700px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#1f2937' }}>
            📋 Vineyard Reports for {vineyard?.name}
          </h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#6b7280'
          }}>
            &times;
          </button>
        </div>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Report generation features will be implemented here.</p>
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px',
            backgroundColor: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            marginRight: '10px'
          }}>
            Close
          </button>
          <button style={{
            padding: '10px 20px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}>
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
};


interface WeatherDashboardProps {
  vineyardId?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  locationName?: string;
}

export function WeatherDashboard({
  vineyardId: propVineyardId,
  initialLatitude = 37.3272, // La Honda, CA fallback
  initialLongitude = -122.2813,
  locationName = "La Honda, CA"
}: WeatherDashboardProps) {
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [customLocation, setCustomLocation] = useState(locationName);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [dateRangeMode, setDateRangeMode] = useState<'current' | 'previous' | 'custom'>('current');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [savedLocations, setSavedLocations] = useState<GeocodeResult[]>([]);

  // NEW: Auto-generated vineyard ID state
  const [vineyardId, setVineyardId] = useState<string>(propVineyardId || '');

  // Tab navigation state
  const [activeTab, setActiveTab] = useState('dashboard');

  // Multi-vineyard management state
  const [userVineyards, setUserVineyards] = useState<any[]>([]);
  const [currentVineyard, setCurrentVineyard] = useState<any | null>(null);

  // Spray safety database - common agricultural chemicals with safety intervals
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

  // Safety alerts state
  const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]);
  const [isLoadingVineyards, setIsLoadingVineyards] = useState(true);
  const [showCreateVineyard, setShowCreateVineyard] = useState(false);
  const [editingVineyardId, setEditingVineyardId] = useState<string | null>(null);
  const [editingVineyardName, setEditingVineyardName] = useState('');
  const [editingVineyardLocation, setEditingVineyardLocation] = useState(false);



  // Activity Log state
  const [activities, setActivities] = useState<any[]>([]);
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
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Edit activity state
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  // Reports modal state
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [editActivityForm, setEditActivityForm] = useState({
    activity_type: '',
    start_date: '',
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
  const [isUpdatingActivity, setIsUpdatingActivity] = useState(false);

  // Organization/Property/Block state
  const [organizations, setOrganizations] = useState<(Organization & { role: string })[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [showCreateOrganization, setShowCreateOrganization] = useState(false);
  const [showCreateProperty, setShowCreateProperty] = useState(false);

  // Progressive loading state
  const [progressiveLoading, setProgressiveLoading] = useState({
    weather: false,
    activities: false,
    vineyards: false,
    insights: false
  });

  // Use existing setData and setLoading from useWeather hook instead of local state

  // Load organizations on mount
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const orgs = await getUserOrganizations();
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setSelectedOrganization(orgs[0]);
          const props = await getOrganizationProperties(orgs[0].id);
          setProperties(props);
          if (props.length > 0) {
            setSelectedProperty(props[0]);
          }
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        // If tables don't exist yet, just continue without block management
        if (error.code === 'PGRST200') {
          console.log('Block management tables not yet created - please run the SQL migration');
        }
      }
    };
    loadOrganizations();
  }, []);

  // Location services functions
  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    setLocationError('');

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const position = await new Promise<GeolocationGeolocationPosition>((resolve, reject) => {
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

      // Update the form with current location
      setActivityForm(prev => ({
        ...prev,
        location_lat: latitude,
        location_lng: longitude,
        location_accuracy: accuracy,
        location_name: `📍 Current Location (±${Math.round(accuracy)}m)`
      }));

      console.log('📍 Got current location:', { latitude, longitude, accuracy });

    } catch (error: any) {
      console.error('❌ Location error:', error);
      let errorMessage = 'Failed to get location';

      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location permissions.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please try again.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      } else {
        errorMessage = error.message || 'Unknown location error';
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
      console.log('🍇 Using vineyard location:', currentVineyard.name);
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
    console.log('🗑️ Cleared location');
  };

  // Event filtering for Events section
  const [eventFilterTypes, setEventFilterTypes] = useState<string[]>([]);
  const [showEventFilterDropdown, setShowEventFilterDropdown] = useState(false);

  // Location visualization state
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [selectedMapEvent, setSelectedMapEvent] = useState<any | null>(null);

  const { isConnected, testing, testConnection } = useWeatherConnection();

  const weatherOptions = {
    latitude,
    longitude,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    autoFetch: false
  };

  // Modified useWeather hook to include caching functionality
  const { data, loading, error, lastUpdated, refetch, retry, clearError, refetchWithCache } = useWeather(weatherOptions);

  // Load user's vineyards on component mount
  useEffect(() => {
    const loadUserVineyards = async () => {
      setIsLoadingVineyards(true);
      setProgressiveLoading(prev => ({ ...prev, vineyards: true }));

      try {
        console.log('🔍 Loading user vineyards...');

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('👤 No authenticated user, using demo mode');
          setIsLoadingVineyards(false);
          setProgressiveLoading(prev => ({ ...prev, vineyards: false }));
          return;
        }

        // Load user's vineyards
        const { getUserVineyards } = await import('../lib/supabase');
        const vineyards = await getUserVineyards();

        console.log('🍇 Loaded user vineyards:', vineyards.length);
        setUserVineyards(vineyards);

        // Set current vineyard (use stored preference or first vineyard)
        const storedVineyardId = localStorage.getItem('currentVineyardId');
        let selectedVineyard = null;

        if (storedVineyardId) {
          selectedVineyard = vineyards.find(v => v.id === storedVineyardId);
        }

        if (!selectedVineyard && vineyards.length > 0) {
          selectedVineyard = vineyards[0];
        }

        if (selectedVineyard) {
          setCurrentVineyard(selectedVineyard);
          setVineyardId(selectedVineyard.id);
          setLatitude(selectedVineyard.latitude);
          setLongitude(selectedVineyard.longitude);
          setCustomLocation(selectedVineyard.name);
          localStorage.setItem('currentVineyardId', selectedVineyard.id);
          console.log('✅ Current vineyard set:', selectedVineyard.name);
        } else {
          console.log('🆕 No existing vineyards, user can create one');
          setShowCreateVineyard(true);
        }

      } catch (error) {
        console.error('❌ Error loading vineyards:', error);
      } finally {
        setIsLoadingVineyards(false);
        setProgressiveLoading(prev => ({ ...prev, vineyards: false }));
      }
    };

    loadUserVineyards();
  }, []);

  // Create a new vineyard
  const createNewVineyard = async () => {
    try {
      console.log('🆕 Creating new vineyard:', { customLocation, latitude, longitude });

      const { createVineyard } = await import('../lib/supabase');
      const newVineyard = await createVineyard(
        customLocation || 'New Vineyard',
        customLocation || 'Unknown Location',
        latitude,
        longitude
      );

      console.log('✅ Created new vineyard:', newVineyard);

      // Update state
      setUserVineyards(prev => [newVineyard, ...prev]);
      setCurrentVineyard(newVineyard);
      setVineyardId(newVineyard.id);
      localStorage.setItem('currentVineyardId', newVineyard.id);
      setShowCreateVineyard(false);

      // Refresh weather data for new vineyard
      if (isInitialized && dateRange.start && dateRange.end) {
        refetchWithCache();
      }

    } catch (error) {
      console.error('❌ Error creating vineyard:', error);
      alert('Failed to create vineyard: ' + (error as Error).message);
    }
  };

  // Switch to a different vineyard
  const switchVineyard = async (vineyard: any) => {
    try {
      console.log('🔄 Switching to vineyard:', vineyard.name, 'ID:', vineyard.id);

      setCurrentVineyard(vineyard);
      setVineyardId(vineyard.id);
      setLatitude(vineyard.latitude);
      setLongitude(vineyard.longitude);
      setCustomLocation(vineyard.name);
      localStorage.setItem('currentVineyardId', vineyard.id);



      // Clear and reload activities immediately
      setActivities([]);

      // Force reload activities after a short delay
      setTimeout(() => {
        console.log('🔄 Force reloading activities for vineyard:', vineyard.id);
        loadActivities();
      }, 500);

      // Refresh weather data for new vineyard
      if (isInitialized && dateRange.start && dateRange.end) {
        refetchWithCache();
      }

    } catch (error) {
      console.error('❌ Error switching vineyard:', error);
    }
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
    // Set the form values to the current vineyard's location
    setLatitude(vineyard.latitude);
    setLongitude(vineyard.longitude);
    setCustomLocation(vineyard.name);
    setLocationSearch('');
    setShowSearchResults(false);
  };

  // Cancel editing a vineyard
  const cancelEditingVineyard = () => {
    setEditingVineyardId(null);
    setEditingVineyardName('');
    setEditingVineyardLocation(false);
    // Reset location form back to current vineyard
    if (currentVineyard) {
      setLatitude(currentVineyard.latitude);
      setLongitude(currentVineyard.longitude);
      setCustomLocation(currentVineyard.name);
    }
  };

  // Save the new vineyard name
  const saveVineyardName = async (vineyardId: string) => {
    if (!editingVineyardName.trim()) {
      alert('Vineyard name cannot be empty');
      return;
    }

    try {
      console.log('✏️ Renaming vineyard:', { vineyardId, newName: editingVineyardName });

      // Find the vineyard to get its coordinates
      const vineyard = userVineyards.find(v => v.id === vineyardId);
      if (!vineyard) {
        throw new Error('Vineyard not found');
      }

      const { saveVineyardLocation } = await import('../lib/supabase');
      const updatedVineyard = await saveVineyardLocation(
        vineyardId,
        vineyard.latitude,
        vineyard.longitude,
        editingVineyardName.trim()
      );

      // Update the vineyard in our local state
      setUserVineyards(prev => prev.map(v => v.id === vineyardId ? updatedVineyard : v));

      // If this is the current vineyard, update it too
      if (currentVineyard?.id === vineyardId) {
        setCurrentVineyard(updatedVineyard);
        setCustomLocation(updatedVineyard.name);
      }

      // Clear editing state
      setEditingVineyardId(null);
      setEditingVineyardName('');

      console.log('✅ Vineyard renamed successfully:', updatedVineyard.name);

    } catch (error) {
      console.error('❌ Error renaming vineyard:', error);
      alert('Failed to rename vineyard: ' + (error as Error).message);
    }
  };

  // Save the new vineyard location
  const saveVineyardLocation = async (vineyardId: string) => {
    if (!customLocation.trim()) {
      alert('Vineyard name cannot be empty');
      return;
    }

    try {
      console.log('📍 Updating vineyard location:', { vineyardId, name: customLocation, latitude, longitude });

      const { saveVineyardLocation } = await import('../lib/supabase');
      const updatedVineyard = await saveVineyardLocation(
        vineyardId,
        latitude,
        longitude,
        customLocation.trim()
      );

      // Update the vineyard in our local state
      setUserVineyards(prev => prev.map(v => v.id === vineyardId ? updatedVineyard : v));

      // If this is the current vineyard, update it too
      if (currentVineyard?.id === vineyardId) {
        setCurrentVineyard(updatedVineyard);
      }

      // Clear editing state
      setEditingVineyardId(null);
      setEditingVineyardLocation(false);

      // Refresh weather data with new location
      clearError();
      if (isInitialized && dateRange.start && dateRange.end) {
        refetchWithCache();
      }

      console.log('✅ Vineyard location updated successfully:', updatedVineyard.name);

    } catch (error) {
      console.error('❌ Error updating vineyard location:', error);
      alert('Failed to update vineyard location: ' + (error as Error).message);
    }
  };

  // Load saved locations from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('saved_vineyard_locations');
    if (stored) {
      try {
        setSavedLocations(JSON.parse(stored));
      } catch (error) {
        console.warn('Error loading saved locations:', error);
      }
    }
  }, []);

  // Initialize date range - start from April 1st (growing season)
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    // For current year: April 1 to today (growing season), but never in the future
    const startDate = `${currentYear}-04-01`;
    const aprilFirst = new Date(currentYear, 3, 1); // April 1st

    // If we're before April 1st of current year, use previous year's full growing season
    let actualStartDate: string;
    let actualEndDate: string;

    if (now < aprilFirst) {
      // Use previous year's growing season (April 1 to October 31)
      actualStartDate = `${currentYear - 1}-04-01`;
      actualEndDate = `${currentYear - 1}-10-31`;
    } else {
      // Use current year from April 1 to today
      actualStartDate = startDate;
      actualEndDate = today;
    }

    console.log('📅 Setting growing season date range:', {
      actualStartDate,
      actualEndDate,
      year: currentYear,
      note: 'Growing season data - never extends beyond today'
    });

    setDateRange({
      start: actualStartDate,
      end: actualEndDate
    });

    setDateRangeMode('current');
    setIsInitialized(true);
  }, []);

  // Auto-fetch weather data once dates are initialized
  useEffect(() => {
    if (isInitialized && dateRange.start && dateRange.end && latitude && longitude) {
      console.log('🌤️ Auto-fetching weather data with:', {
        latitude,
        longitude,
        dateRange
      });
      refetchWithCache();
    }
  }, [isInitialized, dateRange.start, dateRange.end, latitude, longitude, refetchWithCache]);

  // Remove auto-generation of AI insights - only generate when button is clicked

  // Load activities for current vineyard
  const loadActivities = useCallback(async () => {
    if (!vineyardId) return;

    setIsLoadingActivities(true);
    setProgressiveLoading(prev => ({ ...prev, activities: true }));

    try {
      console.log('📋 Loading activities for vineyard:', vineyardId);

      // Load all events first
      let { data, error } = await supabase
        .from('phenology_events')
        .select('*')
        .eq('vineyard_id', vineyardId)
        .order('event_date', { ascending: false });

      if (error) {
        console.error('❌ Error loading activities:', error);
        setActivities([]);
        return;
      }

      console.log('✅ Loaded activities from database:', data?.length || 0, data);

      // Now try to load block associations for each event (optional)
      const processedActivities = [];

      for (const activity of data || []) {
        try {
          const { data: blockData } = await supabase
            .from('event_blocks')
            .select(`
              blocks(*)
            `)
            .eq('event_id', activity.id);

          activity.blocks = blockData?.map((eb: any) => eb.blocks).filter(Boolean) || [];
        } catch (blockError) {
          console.log('⚠️ Could not load blocks for event:', activity.id, blockError);
          activity.blocks = [];
        }

        processedActivities.push(activity);
      }

      console.log('✅ Final processed activities:', processedActivities.length, processedActivities);
      setActivities(processedActivities);
    } catch (error) {
      console.error('❌ Failed to load activities:', error);
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
      setProgressiveLoading(prev => ({ ...prev, activities: false }));
    }
  }, []);

  // Auto-load activities when vineyard changes
  useEffect(() => {
    if (vineyardId) {
      console.log('🔄 Vineyard changed, loading activities immediately:', vineyardId);
      loadActivities();
    } else {
      console.log('⚠️ No vineyard ID available');
    }
  }, [vineyardId]);

  // Force load activities when component mounts
  useEffect(() => {
    if (currentVineyard && currentVineyard.id) {
      console.log('🚀 Component mounted, forcing activity load for:', currentVineyard.id);
      setVineyardId(currentVineyard.id);
      setTimeout(() => {
        loadActivities();
      }, 1000); // Small delay to ensure vineyard ID is set
    }
  }, [currentVineyard]);

  // Calculate safety alerts when activities change
  useEffect(() => {
    if (currentVineyard) {
      const vineyardActivities = activities.filter(activity => activity.vineyard_id === currentVineyard.id);
      calculateSafetyAlerts(vineyardActivities);
    } else {
      setSafetyAlerts([]);
    }
  }, [activities, currentVineyard]);

  // Open reports modal with current vineyard data
  const openReportsModal = () => {
    if (!currentVineyard) {
      alert('Please select a vineyard first to generate reports.');
      return;
    }

    setShowReportsModal(true);
  };

  // Calculate safety alerts for spray applications
  const calculateSafetyAlerts = (vineyardSpecificActivities = activities) => {
    const alerts: any[] = [];
    const today = new Date();

    // Check recent spray applications for re-entry and pre-harvest intervals
    const sprayApplications = vineyardSpecificActivities.filter(activity =>
      activity.event_type === 'spray_application' &&
      activity.spray_product &&
      sprayDatabase[activity.spray_product as keyof typeof sprayDatabase]
    );

    sprayApplications.forEach(spray => {
      const sprayDate = new Date(spray.event_date);
      const productInfo = sprayDatabase[spray.spray_product as keyof typeof sprayDatabase];

      if (!productInfo) return;

      // Calculate days since spray
      const daysSinceSpray = Math.floor((today.getTime() - sprayDate.getTime()) / (1000 * 60 * 60 * 24));
      const hoursSinceSpray = Math.floor((today.getTime() - sprayDate.getTime()) / (1000 * 60 * 60));

      // Re-entry interval check
      if (hoursSinceSpray < productInfo.reentryHours) {
        const hoursRemaining = productInfo.reentryHours - hoursSinceSpray;
        alerts.push({
          id: `reentry-${spray.id}`,
          type: 'reentry',
          severity: 'high',
          title: '🚫 Re-Entry Restriction Active',
          message: `Block treated with ${spray.spray_product} on ${spray.event_date} - ${hoursRemaining} hours remaining until safe re-entry`,
          location: spray.location_name || 'Unknown location',
          productInfo,
          sprayDate: spray.event_date,
          hoursRemaining
        });
      }

      // Pre-harvest interval check (if harvest events exist)
      const harvestEvents = vineyardSpecificActivities.filter(activity => activity.event_type === 'harvest');
      harvestEvents.forEach(harvest => {
        const harvestDate = new Date(harvest.event_date);
        const daysFromSprayToHarvest = Math.floor((harvestDate.getTime() - sprayDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysFromSprayToHarvest >= 0 && daysFromSprayToHarvest < productInfo.preharvestDays) {
          alerts.push({
            id: `preharvest-${spray.id}-${harvest.id}`,
            type: 'preharvest',
            severity: 'critical',
            title: '⚠️ Pre-Harvest Interval Violation',
            message: `${spray.spray_product} applied ${daysFromSprayToHarvest} days before harvest on ${harvest.event_date}. Required interval: ${productInfo.preharvestDays} days`,
            location: spray.location_name || 'Unknown location',
            productInfo,
            sprayDate: spray.event_date,
            harvestDate: harvest.event_date,
            daysShort: productInfo.preharvestDays - daysFromSprayToHarvest
          });
        }
      });

      // Upcoming harvest warning (within 30 days)
      if (productInfo.preharvestDays > 0) {
        const upcomingHarvestCutoff = new Date(sprayDate);
        upcomingHarvestCutoff.setDate(upcomingHarvestCutoff.getDate() + productInfo.preharvestDays);

        const daysUntilSafeHarvest = Math.floor((upcomingHarvestCutoff.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilSafeHarvest > 0 && daysUntilSafeHarvest <= 30) {
          alerts.push({
            id: `harvest-warning-${spray.id}`,
            type: 'harvest_warning',
            severity: 'medium',
            title: '📅 Harvest Timing Notice',
            message: `${spray.spray_product} applied on ${spray.event_date} - safe to harvest after ${upcomingHarvestCutoff.toLocaleDateString()}`,
            location: spray.location_name || 'Unknown location',
            productInfo,
            sprayDate: spray.event_date,
            safeHarvestDate: upcomingHarvestCutoff.toLocaleDateString(),
            daysRemaining: daysUntilSafeHarvest
          });
        }
      }
    });

    setSafetyAlerts(alerts);
  };

  // Listen for tab switching events
  useEffect(() => {
    const handleTabSwitch = (event: CustomEvent) => {
      const { tabId } = event.detail;
      setActiveTab(tabId);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('switchToTab', handleTabSwitch as EventListener);

      return () => {
        window.removeEventListener('switchToTab', handleTabSwitch as EventListener);
      };
    }
  }, []);

  // Save new activity
  const saveActivity = async () => {
    if (!vineyardId || !activityForm.activity_type || !activityForm.start_date) {
      alert('Please fill in activity type and start date');
      return;
    }
    // Block selection is now optional for all event types
    // No validation required - blocks can be empty


    setIsSavingActivity(true);
    try {
      console.log('💾 Saving activity:', activityForm);

      // Prepare event type specific data
      let sprayData = undefined;
      let irrigationData = undefined;
      let fertilizationData = undefined;
      let harvestData = undefined;
      let canopyData = undefined;
      let scoutData = undefined;

      if (activityForm.activity_type === 'Spray Application' && activityForm.spray_product) {
        sprayData = {
          product: activityForm.spray_product,
          quantity: activityForm.spray_quantity,
          unit: activityForm.spray_unit,
          target: activityForm.spray_target,
          conditions: activityForm.spray_conditions,
          equipment: activityForm.spray_equipment
        };
      }

      if (activityForm.activity_type === 'Irrigation') {
        irrigationData = {
          amount: activityForm.irrigation_amount,
          unit: activityForm.irrigation_unit,
          method: activityForm.irrigation_method,
          duration: activityForm.irrigation_duration
        };
      }

      if (activityForm.activity_type === 'Fertilization') {
        fertilizationData = {
          type: activityForm.fertilizer_type,
          npk: activityForm.fertilizer_npk,
          rate: activityForm.fertilizer_rate,
          unit: activityForm.fertilizer_unit,
          method: activityForm.fertilizer_method
        };
      }

      if (activityForm.activity_type === 'Harvest') {
        harvestData = {
          yield: activityForm.harvest_yield,
          unit: activityForm.harvest_unit,
          brix: activityForm.harvest_brix,
          ph: activityForm.harvest_ph,
          ta: activityForm.harvest_ta,
          block: activityForm.harvest_block // This field is now handled by selectedBlockIds
        };
      }

      if (activityForm.activity_type === 'Canopy Management') {
        canopyData = {
          activity: activityForm.canopy_activity,
          intensity: activityForm.canopy_intensity,
          side: activityForm.canopy_side,
          stage: activityForm.canopy_stage
        };
      }

      if (activityForm.activity_type === 'Scouting' || activityForm.activity_type === 'Pest') {
        scoutData = {
          focus: activityForm.scout_focus,
          severity: activityForm.scout_severity,
          distribution: activityForm.scout_distribution,
          action: activityForm.scout_action
        };
      }

      await savePhenologyEvent(
        vineyardId!,
        activityForm.activity_type.toLowerCase().replace(' ', '_'),
        activityForm.start_date,
        activityForm.notes,
        activityForm.end_date || undefined,
        activityForm.harvest_block || undefined, // This field might be redundant now with selectedBlockIds
        selectedBlockIds, // Add selected blocks
        { latitude: latitude, longitude: longitude, locationName: customLocation },
        sprayData,
        irrigationData,
        fertilizationData,
        harvestData,
        canopyData,
        scoutData
      );

      // Reset form and state
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
        harvest_block: '', // Reset to empty
        canopy_activity: '',
        canopy_intensity: '',
        canopy_side: '',
        canopy_stage: '',
        scout_focus: '',
        scout_severity: '',
        scout_distribution: '',
        scout_action: ''
      });
      setSelectedBlockIds([]); // Reset selected blocks
      setShowActivityForm(false);

      // Reload activities
      await loadActivities();

      // Force the chart to refresh its events by triggering the onEventsChange callback
      // This will cause the EnhancedGDDChart component to reload its phenology events
      if (typeof window !== 'undefined') {
        // Set a flag that the chart component can listen for
        window.dispatchEvent(new CustomEvent('phenologyEventsChanged', {
          detail: { vineyardId }
        }));
      }

      console.log('✅ Activity saved successfully');
    } catch (error) {
      console.error('❌ Failed to save activity:', error);
      alert('Failed to save activity: ' + (error as Error).message);
    } finally {
      setIsSavingActivity(false);
    }
  };

  // Start editing an activity
  const startEditingActivity = (activity: any) => {
    console.log('✏️ Starting to edit activity:', activity);

    // Map database event_type back to display format
    const mapEventTypeToDisplay = (dbEventType: string): string => {
      const eventTypeMapping: { [key: string]: string } = {
        'bud_break': 'Bud Break',
        'bloom': 'Bloom',
        'fruit_set': 'Fruit Set',
        'veraison': 'Veraison',
        'harvest': 'Harvest',
        'pruning': 'Pruning',
        'irrigation': 'Irrigation',
        'spray_application': 'Spray Application',
        'fertilization': 'Fertilization',
        'canopy_management': 'Canopy Management',
        'soil_work': 'Soil Work',
        'equipment_maintenance': 'Equipment Maintenance',
        'pest': 'Pest',
        'scouting': 'Scouting',
        'other': 'Other'
      };

      // Handle the normalized event type from database
      const normalizedType = dbEventType?.toLowerCase().replace(/\s+/g, '_') || 'other';
      return eventTypeMapping[normalizedType] || 'Other';
    };

    const displayEventType = mapEventTypeToDisplay(activity.event_type);
    console.log('✏️ Mapped event type:', { original: activity.event_type, display: displayEventType });

    setEditingActivityId(activity.id);
    setEditActivityForm({
      activity_type: displayEventType,
      start_date: activity.event_date || '',
      end_date: activity.end_date || '',
      notes: activity.notes || '',
      location_lat: activity.location_lat || null,
      location_lng: activity.location_lng || null,
      location_name: activity.location_name || '',
      location_accuracy: activity.location_accuracy || null,
      // Spray application specific fields
      spray_product: activity.spray_product || '',
      spray_quantity: activity.spray_quantity || '',
      spray_unit: activity.spray_unit || 'oz/acre',
      spray_target: activity.spray_target || '',
      spray_conditions: activity.spray_conditions || '',
      spray_equipment: activity.spray_equipment || '',
      // Irrigation specific fields
      irrigation_amount: activity.irrigation_amount || '',
      irrigation_unit: activity.irrigation_unit || 'inches',
      irrigation_method: activity.irrigation_method || '',
      irrigation_duration: activity.irrigation_duration || '',
      // Fertilization specific fields
      fertilizer_type: activity.fertilizer_type || '',
      fertilizer_npk: activity.fertilizer_npk || '',
      fertilizer_rate: activity.fertilizer_rate || '',
      fertilizer_unit: activity.fertilizer_unit || 'lbs/acre',
      fertilizer_method: activity.fertilizer_method || '',
      // Harvest specific fields
      harvest_yield: activity.harvest_yield || '',
      harvest_unit: activity.harvest_unit || 'tons/acre',
      harvest_brix: activity.harvest_brix || '',
      harvest_ph: activity.harvest_ph || '',
      harvest_ta: activity.harvest_ta || '',
      harvest_block: activity.harvest_block || '',
      // Canopy management specific fields
      canopy_activity: activity.canopy_activity || '',
      canopy_intensity: activity.canopy_intensity || '',
      canopy_side: activity.canopy_side || '',
      canopy_stage: activity.canopy_stage || '',
      // Scouting/Pest specific fields
      scout_focus: activity.scout_focus || '',
      scout_severity: activity.scout_severity || '',
      scout_distribution: activity.scout_distribution || '',
      scout_action: activity.scout_action || ''
    });

    // Pre-select the blocks for any event type
    if (activity.blocks && Array.isArray(activity.blocks)) {
      setSelectedBlockIds(activity.blocks);
    } else {
      setSelectedBlockIds([]); // Clear block selection if no blocks are associated
    }

    console.log('✏️ Edit form populated with values:', {
      activity_type: displayEventType,
      start_date: activity.event_date,
      spray_product: activity.spray_product,
      irrigation_amount: activity.irrigation_amount,
      irrigation_method: activity.irrigation_method
    });
  };

  // Cancel editing activity
  const cancelEditingActivity = () => {
    setEditingActivityId(null);
    setEditActivityForm({
      activity_type: '',
      start_date: '',
      end_date: '',
      notes: '',
      location_lat: null,
      location_lng: null,
      location_name: '',
      location_accuracy: null,
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
    setSelectedBlockIds([]); // Clear selected blocks when cancelling edit
  };

  // Update an activity
  const updateActivity = async (activityId: string) => {
    if (!vineyardId || !editActivityForm.activity_type || !editActivityForm.start_date) {
      alert('Please fill in activity type and start date');
      return;
    }
    // Block selection is now optional for all event types
    // No validation required - blocks can be empty

    setIsUpdatingActivity(true);
    try {
      console.log('✏️ Updating activity:', { activityId, form: editActivityForm });

      // Use the updatePhenologyEvent function instead of delete/recreate
      const { updatePhenologyEvent } = await import('../lib/supabase');

      // Map display event type back to database format
      const mapDisplayToEventType = (displayType: string): string => {
        const displayMapping: { [key: string]: string } = {
          'Bud Break': 'bud_break',
          'Bloom': 'bloom',
          'Fruit Set': 'fruit_set',
          'Veraison': 'veraison',
          'Harvest': 'harvest',
          'Pruning': 'pruning',
          'Irrigation': 'irrigation',
          'Spray Application': 'spray_application',
          'Fertilization': 'fertilization',
          'Canopy Management': 'canopy_management',
          'Soil Work': 'soil_work',
          'Equipment Maintenance': 'equipment_maintenance',
          'Pest': 'pest',
          'Scouting': 'scouting',
          'Other': 'other'
        };

        return displayMapping[displayType] || 'other';
      };

      const dbEventType = mapDisplayToEventType(editActivityForm.activity_type);
      console.log('💾 Mapped event type for update:', { display: editActivityForm.activity_type, db: dbEventType });

      // Prepare update data with all fields
      const updateData: any = {
        event_type: dbEventType,
        event_date: editActivityForm.start_date,
        notes: editActivityForm.notes || '',
        end_date: editActivityForm.end_date || null,
        // harvest_block: editActivityForm.harvest_block || null // This field might be redundant now with selectedBlockIds
      };

      // Add location data if provided
      if (editActivityForm.location_lat && editActivityForm.location_lng) {
        updateData.location_lat = editActivityForm.location_lat;
        updateData.location_lng = editActivityForm.location_lng;
        updateData.location_name = editActivityForm.location_name;
        updateData.location_accuracy = editActivityForm.location_accuracy;
      } else {
        // Ensure location fields are cleared if not provided
        updateData.location_lat = null;
        updateData.location_lng = null;
        updateData.location_name = '';
        updateData.location_accuracy = null;
      }

      // Add event-type specific data
      if (editActivityForm.activity_type === 'Spray Application') {
        updateData.spray_product = editActivityForm.spray_product || null;
        updateData.spray_quantity = editActivityForm.spray_quantity || null;
        updateData.spray_unit = editActivityForm.spray_unit || null;
        updateData.spray_target = editActivityForm.spray_target || null;
        updateData.spray_conditions = editActivityForm.spray_conditions || null;
        updateData.spray_equipment = editActivityForm.spray_equipment || null;
      } else {
        // Clear spray fields if not applicable
        updateData.spray_product = null;
        updateData.spray_quantity = null;
        updateData.spray_unit = null;
        updateData.spray_target = null;
        updateData.spray_conditions = null;
        updateData.spray_equipment = null;
      }

      if (editActivityForm.activity_type === 'Irrigation') {
        updateData.irrigation_amount = editActivityForm.irrigation_amount || null;
        updateData.irrigation_unit = editActivityForm.irrigation_unit || null;
        updateData.irrigation_method = editActivityForm.irrigation_method || null;
        updateData.irrigation_duration = editActivityForm.irrigation_duration || null;
      } else {
        updateData.irrigation_amount = null;
        updateData.irrigation_unit = null;
        updateData.irrigation_method = null;
        updateData.irrigation_duration = null;
      }

      if (editActivityForm.activity_type === 'Fertilization') {
        updateData.fertilizer_type = editActivityForm.fertilizer_type || null;
        updateData.fertilizer_npk = editActivityForm.fertilizer_npk || null;
        updateData.fertilizer_rate = editActivityForm.fertilizer_rate || null;
        updateData.fertilizer_unit = editActivityForm.fertilizer_unit || null;
        updateData.fertilizer_method = editActivityForm.fertilizer_method || null;
      } else {
        updateData.fertilizer_type = null;
        updateData.fertilizer_npk = null;
        updateData.fertilizer_rate = null;
        updateData.fertilizer_unit = null;
        updateData.fertilizer_method = null;
      }

      if (editActivityForm.activity_type === 'Harvest') {
        updateData.harvest_yield = editActivityForm.harvest_yield || null;
        updateData.harvest_unit = editActivityForm.harvest_unit || null;
        updateData.harvest_brix = editActivityForm.harvest_brix || null;
        updateData.harvest_ph = editActivityForm.harvest_ph || null;
        updateData.harvest_ta = editActivityForm.harvest_ta || null;
        // updateData.harvest_block = editActivityForm.harvest_block || null; // This field might be redundant now with selectedBlockIds
      } else {
        updateData.harvest_yield = null;
        updateData.harvest_unit = null;
        updateData.harvest_brix = null;
        updateData.harvest_ph = null;
        updateData.harvest_ta = null;
        // updateData.harvest_block = null;
      }

      if (editActivityForm.activity_type === 'Canopy Management') {
        updateData.canopy_activity = editActivityForm.canopy_activity || null;
        updateData.canopy_intensity = editActivityForm.canopy_intensity || null;
        updateData.canopy_side = editActivityForm.canopy_side || null;
        updateData.canopy_stage = editActivityForm.canopy_stage || null;
      } else {
        updateData.canopy_activity = null;
        updateData.canopy_intensity = null;
        updateData.canopy_side = null;
        updateData.canopy_stage = null;
      }

      if (editActivityForm.activity_type === 'Scouting' || editActivityForm.activity_type === 'Pest') {
        updateData.scout_focus = editActivityForm.scout_focus || null;
        updateData.scout_severity = editActivityForm.scout_severity || null;
        updateData.scout_distribution = editActivityForm.scout_distribution || null;
        updateData.scout_action = editActivityForm.scout_action || null;
      } else {
        updateData.scout_focus = null;
        updateData.scout_severity = null;
        updateData.scout_distribution = null;
        updateData.scout_action = null;
      }

      // Update the blocks association
      updateData.blocks = selectedBlockIds.length > 0 ? selectedBlockIds : null;

      await updatePhenologyEvent(activityId, updateData);

      // Clear editing state
      cancelEditingActivity();

      // Reload activities
      await loadActivities();

      // Force the chart to refresh its events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('phenologyEventsChanged', {
          detail: { vineyardId }
        }));
      }

      console.log('✅ Activity updated successfully');
    } catch (error) {
      console.error('❌ Failed to update activity:', error);
      alert('Failed to update activity: ' + (error as Error).message);
    } finally {
      setIsUpdatingActivity(false);
    }
  };

  // Delete an activity
  const deleteActivity = async (activityId: string, activityType: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${activityType} event?`)) {
      return;
    }

    try {
      console.log('🗑️ Deleting activity:', activityId);

      const { deletePhenologyEvent } = await import('../lib/supabase');
      await deletePhenologyEvent(activityId);

      // Reload activities to update the Event Log
      await loadActivities();

      // Force the chart to refresh its events by triggering the onEventsChange callback
      // This will cause the EnhancedGDDChart component to reload its phenology events
      if (typeof window !== 'undefined') {
        // Set a flag that the chart component can listen for
        window.dispatchEvent(new CustomEvent('phenologyEventsChanged', {
          detail: { vineyardId }
        }));
      }

      console.log('✅ Activity deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete activity:', error);
      alert('Failed to delete activity: ' + (error as Error).message);
    }
  };

  // Delete a vineyard and all associated data
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
      console.log('🗑️ Deleting vineyard and all associated data:', vineyard.name);

      // Delete all weather data for this vineyard
      try {
        const { data: weatherData, error: weatherError } = await supabase
          .from('weather_data')
          .delete()
          .eq('vineyard_id', vineyard.id);

        if (weatherError) {
          // Try the old table name
          await supabase
            .from('daily_weather')
            .delete()
            .eq('vineyard_id', vineyard.id);
        }

        console.log('✅ Deleted weather data for vineyard');
      } catch (error) {
        console.warn('⚠️ Could not delete weather data:', error);
      }

      // Delete all phenology events for this vineyard
      try {
        await supabase
          .from('phenology_events')
          .delete()
          .eq('vineyard_id', vineyard.id);

        console.log('✅ Deleted phenology events for vineyard');
      } catch (error) {
        console.warn('⚠️ Could not delete phenology events:', error);
      }

      // Delete the vineyard itself
      const { error: vineyardError } = await supabase
        .from('vineyards')
        .delete()
        .eq('id', vineyard.id);

      if (vineyardError) {
        throw new Error(vineyardError.message);
      }

      // Update local state
      const updatedVineyards = userVineyards.filter(v => v.id !== vineyard.id);
      setUserVineyards(updatedVineyards);

      // If this was the current vineyard, switch to another one or show create form
      if (currentVineyard?.id === vineyard.id) {
        if (updatedVineyards.length > 0) {
          switchVineyard(updatedVineyards[0]);
        } else {
          setCurrentVineyard(null);
          setVineyardId('');
          setShowCreateVineyard(true);
          localStorage.removeItem('currentVineyardId');
        }
      }

      console.log('✅ Vineyard deleted successfully:', vineyard.name);
      alert(`✅ Vineyard "${vineyard.name}" and all associated data has been deleted.`);

    } catch (error) {
      console.error('❌ Failed to delete vineyard:', error);
      alert('Failed to delete vineyard: ' + (error as Error).message);
    }
  };

  // Activity type options
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
    setLatitude(location.latitude);
    setLongitude(location.longitude);
    setCustomLocation(location.name);
    setShowSearchResults(false);
    setLocationSearch('');

    // Save to local storage (keep recent 10 locations)
    const newSavedLocations = [location, ...savedLocations.filter(l => l.placeId !== location.placeId)].slice(0, 10);
    setSavedLocations(newSavedLocations);
    localStorage.setItem('saved_vineyard_locations', JSON.stringify(newSavedLocations));

    console.log('📍 Selected location:', location);

    // Clear error and refetch if dates are ready
    clearError();
    if (isInitialized && dateRange.start && dateRange.end) {
      refetchWithCache();
    }
  };



  // Date range button handlers
  const setCurrentYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];
    const aprilFirst = new Date(currentYear, 3, 1); // April 1st

    let newDateRange;

    if (now < aprilFirst) {
      // Use previous year's growing season if we're before April 1st
      newDateRange = {
        start: `${currentYear - 1}-04-01`,
        end: `${currentYear - 1}-10-31`
      };
    } else {
      // Use current year from April 1st to today
      newDateRange = {
        start: `${currentYear}-04-01`,
        end: today
      };
    }

    console.log('📅 Setting current year growing season:', newDateRange);
    setDateRange(newDateRange);
    setDateRangeMode('current');
    setShowCustomRange(false);
  };

  const setPreviousYear = () => {
    const previousYear = new Date().getFullYear() - 1;
    const newDateRange = {
      start: `${previousYear}-04-01`, // Start from April 1st
      end: `${previousYear}-10-31` // End of growing season (October 31)
    };

    console.log('📅 Setting previous year growing season (April 1 to October 31):', newDateRange);
    setDateRange(newDateRange);
    setDateRangeMode('previous');
    setShowCustomRange(false);
  };

  const setCustomDateRange = () => {
    setDateRangeMode('custom');
    setShowCustomRange(true);
  };

  const handleCustomDateRangeUpdate = () => {
    console.log('📅 Updating custom date range:', dateRange);
    clearError();
    if (dateRange.start && dateRange.end) {
      refetchWithCache();
    }
  };

  // Fetch weather data using existing refetchWithCache function
  const fetchWeatherData = useCallback(async () => {
    if (!isInitialized || !dateRange.start || !dateRange.end) return;

    console.log('🌤️ Fetching weather data:', { latitude, longitude, dateRange });

    try {
      await refetchWithCache();
      console.log('✅ Weather data refreshed');
    } catch (err) {
      console.error('❌ Error fetching weather data:', err);
    }
  }, [isInitialized, dateRange, latitude, longitude, refetchWithCache]);

  // Re-fetch weather data if initialization or date range changes
  useEffect(() => {
    if (isInitialized && dateRange.start && dateRange.end && latitude && longitude) {
      console.log('🌤️ Fetching weather data due to initialization or date range change:', {
        latitude,
        longitude,
        dateRange
      });
      fetchWeatherData();
    }
  }, [isInitialized, dateRange.start, dateRange.end, latitude, longitude, fetchWeatherData]);

  // Statistics are now calculated inline using vineyard-specific data

  // Calculate location statistics
  const eventsWithLocation = activities.filter(activity =>
    activity.location_lat && activity.location_lng
  );
  const eventsWithoutLocation = activities.filter(activity =>
    !activity.location_lat || !activity.location_lng
  );
  const locationCoveragePercent = activities.length > 0
    ? Math.round((eventsWithLocation.length / activities.length) * 100)
    : 0;



  // Don't render until initialized
  if (!isInitialized) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{
          width: '30px',
          height: '30px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 10px'
        }}></div>
        <p>Initializing weather dashboard...</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Tab configuration
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
    { id: 'insights', label: 'Insights', emoji: '📈' },
    { id: 'activities', label: 'Activities', emoji: '🌱' },
    { id: 'vineyards', label: 'Vineyards', emoji: '🍇' },
    { id: 'reports', label: 'Reports', emoji: '📋' }
  ];

  // Tab content renderer
  const renderTabContent = () => {
    // Filter activities by current vineyard
    const vineyardActivities = currentVineyard
      ? activities.filter(activity => activity.vineyard_id === currentVineyard.id)
      : [];

    // Filter weather data by current vineyard coordinates
    const vineyardWeatherData = currentVineyard && data.length > 0 ? data : [];

    switch (activeTab) {
      case 'activities':
        return (
          <>
            {progressiveLoading.activities && (
              <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div className="spinner" style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #f3f3f3',
                  borderTop: '2px solid #22c55e',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ color: '#374151', fontWeight: '500' }}>Loading activities...</span>
              </div>
            )}
            <ActivitiesTab
              vineyardId={currentVineyard?.id || ''}
              currentVineyard={currentVineyard}
              activities={vineyardActivities}
              onActivitiesChange={loadActivities}
              selectedOrganization={selectedOrganization}
              selectedProperty={selectedProperty}
              selectedBlockIds={selectedBlockIds}
              onSelectedBlockIdsChange={setSelectedBlockIds}
            />
          </>
        );
      case 'insights':
        return (
          <>
            {progressiveLoading.insights && (
              <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div className="spinner" style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #f3f3f3',
                  borderTop: '2px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ color: '#374151', fontWeight: '500' }}>Loading insights...</span>
              </div>
            )}
            <InsightsTab
              data={vineyardWeatherData}
              loading={loading || progressiveLoading.weather}
              vineyardId={currentVineyard?.id || ''}
              currentVineyard={currentVineyard}
              customLocation={currentVineyard?.name || customLocation}
              activities={vineyardActivities}
              onActivitiesChange={loadActivities}
              dateRange={dateRange}
              fetchData={fetchWeatherData}
            />
          </>
        );
      case 'vineyards':
        return (
          <>
            {progressiveLoading.vineyards && (
              <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div className="spinner" style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #f3f3f3',
                  borderTop: '2px solid #8b5cf6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ color: '#374151', fontWeight: '500' }}>Loading vineyards...</span>
              </div>
            )}
            <VineyardsTab
              userVineyards={userVineyards || []}
              currentVineyard={currentVineyard}
              onVineyardChange={switchVineyard}
              onVineyardsUpdate={() => {
                // Reload vineyards after updates
                const loadUserVineyards = async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    const { getUserVineyards } = await import('../lib/supabase');
                    const vineyards = await getUserVineyards();
                    setUserVineyards(vineyards);
                  } catch (error) {
                    console.error('❌ Error reloading vineyards:', error);
                  }
                };
                loadUserVineyards();
              }}
            />
          </>
        );
      case 'reports':
        return (
          <ReportsTab
            currentVineyard={currentVineyard}
            activities={vineyardActivities}
            weatherData={vineyardWeatherData}
          />
        );
      default: // dashboard
        return (
          <div className="mobile-touch-spacing" style={{ padding: '12px' }}>
            {/* Current vineyard display - Mobile optimized */}
            {currentVineyard && (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '12px',
                fontSize: '14px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '4px' 
                }}>
                  <span style={{ fontWeight: '600', color: '#0369a1' }}>
                    📍 {currentVineyard.name}
                  </span>
                  <span style={{ fontSize: '12px', color: '#0284c7' }}>
                    {currentVineyard.latitude.toFixed(3)}, {currentVineyard.longitude.toFixed(3)}
                  </span>
                </div>
              </div>
            )}

            {/* Weather Summary Stats - Mobile optimized single column */}
            {vineyardWeatherData.length > 0 && currentVineyard && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <TrendingUp size={18} style={{ color: '#059669' }} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Total GDD</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>
                    {Math.round(vineyardWeatherData.reduce((sum, day) => sum + day.gdd, 0))} GDDs
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    {vineyardWeatherData.length} days
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <CloudRain size={18} style={{ color: '#3b82f6' }} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Total Rainfall</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
                    {vineyardWeatherData.reduce((sum, day) => sum + day.rainfall, 0).toFixed(2)}"
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    Precipitation
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Thermometer size={18} style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>Avg High Temp</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                    {vineyardWeatherData.length > 0 ? (vineyardWeatherData.reduce((sum, day) => sum + day.temp_high, 0) / vineyardWeatherData.length).toFixed(1) : '0.0'}°F
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    Daily average
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions - Mobile optimized full width buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <button
                onClick={() => setActiveTab('activities')}
                style={{
                  padding: '16px',
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
                  width: '100%',
                  minHeight: '52px'
                }}
              >
                🌱 Add Event
              </button>

              <button
                onClick={() => setActiveTab('insights')}
                style={{
                  padding: '16px',
                  backgroundColor: '#3b82f6',
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
                  width: '100%',
                  minHeight: '52px'
                }}
              >
                📈 View Growth Curve
              </button>
            </div>

            {/* Recent Activities Preview - Mobile optimized */}
            {vineyardActivities.length > 0 && currentVineyard && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <h3 style={{ 
                    margin: '0', 
                    fontSize: '16px', 
                    color: '#374151',
                    lineHeight: '1.3'
                  }}>
                    Recent Activities
                  </h3>
                  <button
                    onClick={() => setActiveTab('activities')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      minHeight: '32px'
                    }}
                  >
                    View All
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {vineyardActivities.slice(0, 3).map((activity, index) => {
                    const eventStyles: { [key: string]: { color: string, emoji: string } } = {
                      bud_break: { color: "#22c55e", emoji: "🌱" },
                      bloom: { color: "#f59e0b", emoji: "🌸" },
                      veraison: { color: "#8b5cf6", emoji: "🍇" },
                      harvest: { color: "#ef4444", emoji: "🍷" },
                      pruning: { color: "#6366f1", emoji: "✂️" },
                      irrigation: { color: "#06b6d4", emoji: "💧" },
                      spray_application: { color: "#f97316", emoji: "🌿" },
                      fertilization: { color: "#84cc16", emoji: "🌱" },
                      canopy_management: { color: "#10b981", emoji: "🍃" },
                      soil_work: { color: "#8b5cf6", emoji: "📝" },
                      equipment_maintenance: { color: "#6b7280", emoji: "🔧" },
                      fruit_set: { color: "#f59e0b", emoji: "🫐" },
                      pest: { color: "#dc2626", emoji: "🐞" },
                      scouting: { color: "#059669", emoji: "🔍" },
                      other: { color: "#9ca3af", emoji: "📝" }
                    };

                    const eventType = activity.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';
                    const style = eventStyles[eventType] || eventStyles.other;

                    return (
                      <div
                        key={activity.id || index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          minHeight: '48px'
                        }}
                      >
                        <span style={{ fontSize: '18px', minWidth: '18px' }}>{style.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#374151',
                            lineHeight: '1.3',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {activity.event_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            {new Date(activity.event_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: style.color,
                            borderRadius: '50%',
                            flexShrink: 0
                          }}
                        ></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No vineyard state - Mobile optimized */}
            {!currentVineyard && (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '2px dashed #cbd5e1'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🍇</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '16px' }}>Welcome to Vigneron.AI</h3>
                <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
                  Create your first vineyard to get started
                </p>
                <button
                  onClick={() => setActiveTab('vineyards')}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Create Vineyard
                </button>
              </div>
            )}
          </div>
        );
    }
  };

  const handleRefresh = async () => {
    if (isInitialized && dateRange.start && dateRange.end) {
      await refetchWithCache();
    }
  };

  return (
    <MobileRefresh onRefresh={handleRefresh}>
      <div className="container section-spacing" style={{ padding: '1rem', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Safety Alerts */}
        {safetyAlerts.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            {safetyAlerts.map(alert => (
              <div
                key={alert.id}
                style={{
                  padding: '15px 20px',
                  backgroundColor: alert.severity === 'critical' ? '#fef2f2' :
                                  alert.severity === 'high' ? '#fffbeb' : '#f0f9ff',
                  border: `2px solid ${alert.severity === 'critical' ? '#ef4444' :
                                     alert.severity === 'high' ? '#f59e0b' : '#3b82f6'}`,
                  borderRadius: '8px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div style={{
                  fontSize: '20px',
                  marginTop: '2px',
                  color: alert.severity === 'critical' ? '#ef4444' :
                         alert.severity === 'high' ? '#f59e0b' : '#3b82f6'
                }}>
                  {alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '🚫' : '📅'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '700',
                    fontSize: '16px',
                    marginBottom: '4px',
                    color: alert.severity === 'critical' ? '#991b1b' :
                           alert.severity === 'high' ? '#92400e' : '#1e40af'
                  }}>
                    {alert.title}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    marginBottom: '6px',
                    color: alert.severity === 'critical' ? '#7f1d1d' :
                           alert.severity === 'high' ? '#78350f' : '#1e3a8a'
                  }}>
                    {alert.message}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span>📍 {alert.location}</span>
                    <span>•</span>
                    <span>{alert.productInfo.category} - {alert.productInfo.signal} Signal Word</span>
                    {alert.type === 'reentry' && (
                      <>
                        <span>•</span>
                        <span style={{ fontWeight: '600', color: '#ef4444' }}>
                          Safe re-entry: {new Date(Date.now() + alert.hoursRemaining * 60 * 60 * 1000).toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        {/* Removed the title and subtitle as per the request */}

        {/* Tab Navigation */}
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content */}
        {/* Wrap tab content in MobileRefresh for pull-to-refresh */}
        <MobileRefresh
          onRefresh={async () => {
            console.log('🔄 Triggering pull-to-refresh...');
            // Reload weather data and activities
            fetchWeatherData();
            await loadActivities();
            console.log('🔄 Pull-to-refresh complete.');
          }}
          style={{ flexGrow: 1, overflowY: 'auto' }} // Allow scrolling within the refreshable area
        >
          {renderTabContent()}
        </MobileRefresh>

        {/* Loading State */}
        {loading && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1',
            marginBottom: '20px'
          }}>
            <RefreshCw size={32} style={{ color: '#64748b', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#475569' }}>Loading Weather Data</h3>
            <p style={{ margin: '0', color: '#64748b' }}>
              Fetching weather data for {customLocation}...
            </p>
          </div>
        )}

        {/* Data Status Footer */}
        {lastUpdated && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f1f5f9',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            fontSize: '14px',
            color: '#64748b',
            marginTop: '20px'
          }}>
            <span>Last updated: {lastUpdated.toLocaleString()}</span>
            <span style={{ margin: '0 12px', color: '#cbd5e1' }}>•</span>
            <span>{data.length} data points loaded</span>
            {dateRange.start && dateRange.end && (
              <>
                <span style={{ margin: '0 12px', color: '#cbd5e1' }}>•</span>
                <span>Period: {dateRange.start} to {dateRange.end}</span>
              </>
            )}
          </div>
        )}



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
    </MobileRefresh>
  );
}

// Import the missing savePhenologyEvent function that's used in the component
async function savePhenologyEvent(
  vineyardId: string,
  eventType: string,
  date: string,
  notes: string,
  endDate?: string,
  harvestBlock?: string,
  selectedBlockIds?: string[],
  location?: { latitude: number; longitude: number; locationName: string },
  sprayData?: any,
  irrigationData?: any,
  fertilizationData?: any,
  harvestData?: any,
  canopyData?: any,
  scoutData?: any
) {
  const { savePhenologyEvent: saveEvent } = await import('../lib/supabase');
  return saveEvent(
    vineyardId,
    eventType,
    date,
    notes,
    endDate,
    harvestBlock,
    selectedBlockIds,
    location,
    sprayData,
    irrigationData,
    fertilizationData,
    harvestData,
    canopyData,
    scoutData
  );
}

// Placeholder for getUserOrganizations (assuming it's defined elsewhere or in supabase module)
async function getUserOrganizations() {
  // Replace with actual implementation if not already imported or available globally
  console.warn('getUserOrganizations placeholder called. Implement actual function.');
  return [];
}

// Placeholder for getOrganizationProperties (assuming it's defined elsewhere or in supabase module)
async function getOrganizationProperties(orgId: string) {
  // Replace with actual implementation if not already imported or available globally
  console.log(`getOrganizationProperties called for ${orgId} placeholder. Implement actual function.`);
  return [];
}