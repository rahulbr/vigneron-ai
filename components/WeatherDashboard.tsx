// components/WeatherDashboard.tsx - COMPLETE Fixed Version with All Features

import React, { useState, useEffect } from 'react';
import { useWeather, useWeatherConnection } from '../hooks/useWeather';
import { EnhancedGDDChart } from './EnhancedGDDChart';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';
import { openaiService, VineyardContext, AIInsight } from '../lib/openaiService';
import { supabase } from '../lib/supabase'; // Added for user authentication
import { AlertCircle, RefreshCw, MapPin, Calendar, Thermometer, CloudRain, TrendingUp, Search, Brain, Lightbulb, AlertTriangle, CheckCircle, Info, FileText } from 'lucide-react';
import { ReportsModal } from './ReportsModal';
import { savePhenologyEvent, PhenologyEvent, saveWeatherData, getWeatherData, getUserOrganizations, getOrganizationProperties, getPropertyBlocks, createOrganization, createProperty, Organization, Property, Block } from '../lib/supabase';
import BlockSelector from './BlockSelector';

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

  // AI-related state
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [weatherAnalysis, setWeatherAnalysis] = useState<string>('');
  const [phenologyAnalysis, setPhenologyAnalysis] = useState<string>('');
  const [showAIPanel, setShowAIPanel] = useState(false);

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
      try {
        setIsLoadingVineyards(true);
        console.log('🔍 Loading user vineyards...');

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('👤 No authenticated user, using demo mode');
          setIsLoadingVineyards(false);
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
      console.log('🔄 Switching to vineyard:', vineyard.name);

      setCurrentVineyard(vineyard);
      setVineyardId(vineyard.id);
      setLatitude(vineyard.latitude);
      setLongitude(vineyard.longitude);
      setCustomLocation(vineyard.name);
      localStorage.setItem('currentVineyardId', vineyard.id);

      // Clear AI insights when switching vineyards
      setAiInsights([]);
      setWeatherAnalysis('');
      setPhenologyAnalysis('');
      setShowAIPanel(false);

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
  const loadActivities = async () => {
    if (!vineyardId) return;

    setIsLoadingActivities(true);
    try {
      console.log('📋 Loading activities for vineyard:', vineyardId);

      const { data, error } = await supabase
        .from('phenology_events')
        .select(`
          *,
          blocks:event_blocks.block(*)
        `)
        .eq('vineyard_id', vineyardId)
        .order('event_date', { ascending: false });

      if (error) {
        console.error('❌ Error loading activities:', error);
        return;
      }

      console.log('✅ Loaded activities:', data?.length || 0);
      setActivities(data || []);
    } catch (error) {
      console.error('❌ Failed to load activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Auto-load activities when vineyard changes
  useEffect(() => {
    if (vineyardId) {
      loadActivities();
    }
  }, [vineyardId]);

  // Calculate safety alerts when activities change
  useEffect(() => {
    calculateSafetyAlerts();
  }, [activities]);

  // Open reports modal with current vineyard data
  const openReportsModal = () => {
    if (!currentVineyard) {
      alert('Please select a vineyard first to generate reports.');
      return;
    }

    setShowReportsModal(true);
  };

  // Calculate safety alerts for spray applications
  const calculateSafetyAlerts = () => {
    const alerts: any[] = [];
    const today = new Date();

    // Check recent spray applications for re-entry and pre-harvest intervals
    const sprayApplications = activities.filter(activity =>
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
      const harvestEvents = activities.filter(activity => activity.event_type === 'harvest');
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

  // Listen for chart date clicks to pre-populate form
  useEffect(() => {
    const handleChartDateClicked = (event: CustomEvent) => {
      const clickedDate = event.detail?.date;
      if (clickedDate) {
        console.log('📅 Pre-populating form with clicked date:', clickedDate);
        setActivityForm(prev => ({
          ...prev,
          start_date: clickedDate
        }));
      }
    };

    window.addEventListener('chartDateClicked', handleChartDateClicked as EventListener);
    return () => {
      window.removeEventListener('chartDateClicked', handleChartDateClicked as EventListener);
    };
  }, []);

  // Save new activity
  const saveActivity = async () => {
    if (!vineyardId || !activityForm.activity_type || !activityForm.start_date) {
      alert('Please fill in activity type and start date');
      return;
    }
    if (activityForm.activity_type === 'Harvest' && selectedBlockIds.length === 0) {
      alert('Please select at least one block for Harvest events.');
      return;
    }


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
          block: activityForm.harvest_block // This is now handled by selectedBlockIds
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

    // If it's a harvest event, pre-select the blocks
    if (activity.event_type === 'harvest' && activity.blocks && Array.isArray(activity.blocks)) {
      setSelectedBlockIds(activity.blocks.map((block: any) => block.id));
    } else {
      setSelectedBlockIds([]); // Clear block selection if not a harvest event or no blocks are associated
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
    if (editActivityForm.activity_type === 'Harvest' && selectedBlockIds.length === 0) {
      alert('Please select at least one block for Harvest events.');
      return;
    }

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

  // Generate AI insights based on current vineyard data
  const generateAIInsights = async () => {
    if (!data || data.length === 0) {
      alert('⚠️ No weather data available. Please ensure weather data is loaded before generating AI insights.');
      return;
    }

    // Check if OpenAI API key is available
    const hasApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY && process.env.NEXT_PUBLIC_OPENAI_API_KEY.length > 0;
    if (!hasApiKey) {
      alert('❌ OpenAI API Key Missing\n\nTo use AI insights, you need to:\n1. Get an OpenAI API key from https://platform.openai.com/api-keys\n2. Add it to your environment variables as NEXT_PUBLIC_OPENAI_API_KEY\n3. Restart your application');
      return;
    }

    setIsGeneratingInsights(true);
    try {
      console.log('🤖 Generating AI insights...');

      // Get phenology events from database
      let phenologyEvents = [];
      try {
        if (vineyardId) {
          console.log('🔍 Loading phenology events from database for AI analysis:', vineyardId);
          const { getPhenologyEvents } = await import('../lib/supabase');
          const dbEvents = await getPhenologyEvents(vineyardId);
          phenologyEvents = dbEvents || [];
          console.log('📅 Loaded phenology events for AI:', phenologyEvents.length);
        }
      } catch (error) {
        console.warn('Error loading phenology events for AI:', error);
        phenologyEvents = [];
      }

      // Calculate summary statistics
      const totalGDD = data.reduce((sum, day) => sum + day.gdd, 0);
      const totalRainfall = data.reduce((sum, day) => sum + day.rainfall, 0);
      const avgTempHigh = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_high, 0) / data.length : 0;
      const avgTempLow = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_low, 0) / data.length : 0;

      const context: VineyardContext = {
        locationName: customLocation,
        latitude,
        longitude,
        currentGDD: totalGDD,
        totalRainfall,
        avgTempHigh,
        avgTempLow,
        dataPoints: data.length,
        dateRange,
        phenologyEvents: phenologyEvents.map((event: any) => ({
          event_type: event.event_type,
          event_date: event.event_date,
          notes: event.notes
        }))
      };

      console.log('🔍 AI Context:', {
        location: context.locationName,
        gdd: context.currentGDD,
        rainfall: context.totalRainfall,
        phenologyEventsCount: context.phenologyEvents.length
      });

      // Generate recommendations
      const insights = await openaiService.generateVineyardRecommendations(context);
      setAiInsights(insights);

      // Generate weather analysis
      const weatherAnalysisText = await openaiService.analyzeWeatherPatterns(context);
      setWeatherAnalysis(weatherAnalysisText);

      // Generate phenology analysis
      const phenologyAnalysisText = await openaiService.analyzePhenologyEvents(context);
      setPhenologyAnalysis(phenologyAnalysisText);

      setShowAIPanel(true);
      console.log('✅ AI insights generated successfully');

    } catch (error) {
      console.error('❌ Failed to generate AI insights:', error);

      // Show more user-friendly error message
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('quota exceeded')) {
        alert('❌ OpenAI API Quota Exceeded\n\nYour OpenAI account has exceeded its usage quota. Please:\n1. Check your OpenAI billing dashboard\n2. Add credits to your account\n3. Try again after adding credits\n\nVisit: https://platform.openai.com/account/billing');
      } else if (errorMessage.includes('rate limit')) {
        alert('❌ OpenAI API Rate Limit\n\nToo many requests to OpenAI API. Please wait a moment and try again.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        alert('❌ Network Error\n\nPlease check your internet connection and try again.');
      } else {
        alert('❌ Failed to generate AI insights\n\nPlease try again in a moment. If the problem persists, contact support.');
      }
    } finally {
      setIsGeneratingInsights(false);
    }
  };

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

  // Calculate summary statistics
  const totalGDD = data.reduce((sum, day) => sum + day.gdd, 0);
  const totalRainfall = data.reduce((sum, day) => sum + day.rainfall, 0);
  const avgTempHigh = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_high, 0) / data.length : 0;
  const avgTempLow = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_low, 0) / data.length : 0;

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

  // Get icon for insight type (harvest-focused)
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'harvest_timing': return <span style={{ fontSize: '16px' }}>🍇</span>;
      case 'action_required': return <AlertTriangle size={16} style={{ color: '#dc2626' }} />;
      case 'monitor': return <span style={{ fontSize: '16px' }}>👁️</span>;
      case 'opportunity': return <span style={{ fontSize: '16px' }}>⭐</span>;
      default: return <Info size={16} style={{ color: '#6b7280' }} />;
    }
  };

  // Get color for insight type (harvest-focused)
  const getInsightColor = (type: string) => {
    switch (type) {
      case 'harvest_timing': return { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' };
      case 'action_required': return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
      case 'monitor': return { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' };
      case 'opportunity': return { bg: '#f0fdf4', border: '#bbf7d0', text: '#065f46' };
      default: return { bg: '#f8fafc', border: '#e2e8f0', text: '#374151' };
    }
  };

  // Get urgency styling
  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case 'high': return {
        badge: { backgroundColor: '#dc2626', color: 'white' },
        border: '2px solid #dc2626'
      };
      case 'medium': return {
        badge: { backgroundColor: '#f59e0b', color: 'white' },
        border: '1px solid #f59e0b'
      };
      case 'low': return {
        badge: { backgroundColor: '#6b7280', color: 'white' },
        border: '1px solid #e5e7eb'
      };
      default: return {
        badge: { backgroundColor: '#6b7280', color: 'white' },
        border: '1px solid #e5e7eb'
      };
    }
  };

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

  return (
    <div className="container section-spacing" style={{ padding: '1rem' }}>
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
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#1f2937' }}>
          🌱 Vineyard Analytics
        </h1>
        <p style={{ color: '#6b7280', margin: '0', fontSize: '1rem' }}>
          Advanced weather tracking and phenology management for your vineyards
        </p>

        {/* Current Vineyard Display */}
        {currentVineyard && (
          <div style={{
            marginTop: '15px',
            padding: '12px 16px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1' }}>
                📍 Currently Viewing: {currentVineyard.name}
              </span>
              <span style={{ fontSize: '12px', color: '#0284c7', marginLeft: '10px' }}>
                ({currentVineyard.latitude.toFixed(4)}, {currentVineyard.longitude.toFixed(4)})
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              ID: {vineyardId?.slice(0, 8)}...
            </span>
          </div>
        )}
      </div>

      {/* How to Use This Dashboard */}
      <div style={{ marginBottom: '25px' }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '15px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📖 How to Use This Dashboard
        </h3>
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#475569'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <strong>🍇 Track Your Vineyard Season:</strong>
            <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
              <li><strong>Weather & GDD:</strong> Automatically tracks growing degree days for your vineyard location</li>
              <li><strong>Add Events:</strong> Click the GDD chart or "Add Event" button to log phenology stages and vineyard work</li>
              <li><strong>Event Management:</strong> Edit notes, dates, or delete events in the Event Log section below</li>
              <li><strong>Predictions:</strong> See predicted dates for upcoming phenology stages based on GDD accumulation</li>
            </ul>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>🎯 Event Types You Can Track:</strong>
            <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
              <li>🌱 <strong>Phenology:</strong> Bud break, bloom, veraison, harvest</li>
              <li>🌿 <strong>Vineyard Work:</strong> Pruning, irrigation, spray applications, canopy management</li>
              <li>🔍 <strong>Monitoring:</strong> Scouting notes, pest observations, soil work</li>
              <li>🔧 <strong>Operations:</strong> Equipment maintenance, fertilization</li>
            </ul>
          </div>

          <div style={{
            backgroundColor: '#e0f7fa',
            padding: '12px',
            borderRadius: '6px',
            marginTop: '15px'
          }}>
            <strong>🚀 Upcoming Features:</strong>
            <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '0' }}>
              <li>📱 Mobile interface for use in the field</li>
              <li>🤖 More relevant AI vineyard insights and recommendations</li>
              <li>📊 Advanced analytics and seasonal comparisons</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Vineyard Management Panel */}
      {!isLoadingVineyards && (
        <div className="card section-spacing">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: '0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🍇 My Vineyards
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowCreateVineyard(!showCreateVineyard)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '500'
                }}
              >
                ➕ Add Vineyard
              </button>
            </div>
          </div>

          {/* Show create vineyard form */}
          {showCreateVineyard && (
            <div style={{
              padding: '20px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#065f46', fontSize: '16px' }}>
                    🆕 Add New Vineyard
                  </h4>
                  <p style={{ margin: '0', fontSize: '14px', color: '#047857' }}>
                    Enter location details to create a new vineyard.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateVineyard(false)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Location Search for new vineyard */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#065f46' }}>
                  Search for Location (Google Maps):
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
                    placeholder="e.g., Napa Valley CA, Bordeaux France, Tuscany Italy..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #a7f3d0',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={handleLocationSearch}
                    disabled={isSearching || !locationSearch.trim()}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: isSearching ? '#9ca3af' : '#4285f4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isSearching || !locationSearch.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isSearching ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                    Search
                  </button>
                </div>
              </div>

              {/* Search Results for new vineyard */}
              {showSearchResults && searchResults.length > 0 && (
                <div style={{
                  marginBottom: '15px',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #bbf7d0', fontWeight: '500', fontSize: '14px', backgroundColor: '#f0fdf4', color: '#065f46' }}>
                    Select Location:
                  </div>
                  {searchResults.map((result, index) => (
                    <div
                      key={result.placeId}
                      onClick={() => selectLocation(result)}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: '500', marginBottom: '2px' }}>{result.name}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '2px' }}>
                        {result.formattedAddress}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Saved Locations for new vineyard */}
              {savedLocations.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#065f46' }}>
                    Recent Locations:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {savedLocations.slice(0, 5).map((location, index) => (
                      <button
                        key={location.placeId}
                        onClick={() => selectLocation(location)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          border: '1px solid #7dd3fc',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {location.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#065f46' }}>
                  Vineyard Name:
                </label>
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="e.g., Napa Valley Estate, Bordeaux Vineyard..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #a7f3d0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#065f46' }}>
                    Latitude:
                  </label>
                  <input
                    type="number"
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                    step="0.0001"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #a7f3d0',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="37.3272"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#065f46' }}>
                    Longitude:
                  </label>
                  <input
                    type="number"
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                    step="0.0001"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #a7f3d0',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="-122.2813"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={createNewVineyard}
                  disabled={!customLocation.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: !customLocation.trim() ? '#9ca3af' : '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: !customLocation.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✨ Create Vineyard
                </button>
                <button
                  onClick={() => setShowCreateVineyard(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
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

          {/* Show edit vineyard location form */}
          {editingVineyardId && editingVineyardLocation && (
            <div style={{
              padding: '20px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#1e40af', fontSize: '16px' }}>
                    📍 Edit Vineyard Location
                  </h4>
                  <p style={{ margin: '0', fontSize: '14px', color: '#1e3a8a' }}>
                    Update the location details for this vineyard.
                  </p>
                </div>
                <button
                  onClick={cancelEditingVineyard}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Location Search for editing */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#1e40af' }}>
                  Search for New Location (Google Maps):
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
                    placeholder="e.g., Napa Valley CA, Bordeaux France, Tuscany Italy..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={handleLocationSearch}
                    disabled={isSearching || !locationSearch.trim()}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: isSearching ? '#9ca3af' : '#4285f4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isSearching || !locationSearch.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isSearching ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                    Search
                  </button>
                </div>
              </div>

              {/* Search Results for editing */}
              {showSearchResults && searchResults.length > 0 && (
                <div style={{
                  marginBottom: '15px',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #dbeafe', fontWeight: '500', fontSize: '14px', backgroundColor: '#eff6ff', color: '#1e40af' }}>
                    Select New Location:
                  </div>
                  {searchResults.map((result, index) => (
                    <div
                      key={result.placeId}
                      onClick={() => selectLocation(result)}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: '500', marginBottom: '2px' }}>{result.name}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '2px' }}>
                        {result.formattedAddress}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#1e40af' }}>
                  Vineyard Name:
                </label>
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="e.g., Napa Valley Estate, Bordeaux Vineyard..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#1e40af' }}>
                    Latitude:
                  </label>
                  <input
                    type="number"
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                    step="0.0001"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="37.3272"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px', color: '#1e40af' }}>
                    Longitude:
                  </label>
                  <input
                    type="number"
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                    step="0.0001"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    placeholder="-122.2813"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => saveVineyardLocation(editingVineyardId)}
                  disabled={!customLocation.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: !customLocation.trim() ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: !customLocation.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📍 Update Location
                </button>
                <button
                  onClick={cancelEditingVineyard}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
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
          {userVineyards.length > 0 ? (
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {userVineyards.map((vineyard) => (
                  <div
                    key={vineyard.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      backgroundColor: currentVineyard?.id === vineyard.id ? '#f0f9ff' : '#f8fafc',
                      border: `2px solid ${currentVineyard?.id === vineyard.id ? '#0ea5e9' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Vineyard name or edit input */}
                    {editingVineyardId === vineyard.id ? (
                      <input
                        type="text"
                        value={editingVineyardName}
                        onChange={(e) => setEditingVineyardName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            saveVineyardName(vineyard.id);
                          } else if (e.key === 'Escape') {
                            cancelEditingVineyard();
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          border: '2px solid #3b82f6',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => switchVineyard(vineyard)}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '6px 10px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '15px',
                          fontWeight: currentVineyard?.id === vineyard.id ? '600' : '500',
                          color: currentVineyard?.id === vineyard.id ? '#0369a1' : '#374151'
                        }}
                      >
                        {currentVineyard?.id === vineyard.id ? '📍 ' : '🍇 '}{vineyard.name}
                      </button>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {editingVineyardId === vineyard.id && !editingVineyardLocation ? (
                        <>
                          <button
                            onClick={() => saveVineyardName(vineyard.id)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#22c55e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                            title="Save name"
                          >
                            ✓ Save
                          </button>
                          <button
                            onClick={cancelEditingVineyard}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                            title="Cancel editing"
                          >
                            ✕ Cancel
                          </button>
                        </>
                      ) : editingVineyardId !== vineyard.id ? (
                        <>
                          <button
                            onClick={() => startEditingVineyard(vineyard)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                            title="Rename vineyard"
                          >
                            ✏️ Rename
                          </button>
                          <button
                            onClick={() => startEditingVineyardLocation(vineyard)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                            title="Edit vineyard location"
                          >
                            📍 Location
                          </button>
                          <button
                            onClick={() => deleteVineyard(vineyard)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                            title="Delete vineyard and all data"
                          >
                            🗑️ Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '30px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '2px dashed #cbd5e1',
              marginBottom: '15px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🍇</div>
              <h4 style={{ margin: '0 0 10px 0', color: '#374151', fontSize: '18px' }}>No Vineyards Yet</h4>
              <p style={{ margin: '0 0 15px 0', color: '#6b7280', fontSize: '14px' }}>
                Create your first vineyard to start tracking weather data and phenology events.
              </p>
              <button
                onClick={() => setShowCreateVineyard(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  margin: '0 auto'
                }}
              >
                ➕ Create First Vineyard
              </button>
            </div>
          )}

          {/* Show vineyard count */}
          <div style={{
            fontSize: '13px',
            color: '#6b7280',
            padding: '10px',
            backgroundColor: '#f1f5f9',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            📊 {userVineyards.length === 0 ? 'No vineyards configured' :
                 `${userVineyards.length} vineyard${userVineyards.length !== 1 ? 's' : ''} configured`}
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className={`status-indicator section-spacing ${
        isConnected === true ? 'status-success' :
        isConnected === false ? 'status-error' :
        'status-warning'
      }`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {testing ? (
          <>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Testing weather API connection...</span>
          </>
        ) : isConnected === true ? (
          <>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
            <span style={{ color: '#065f46' }}>Weather API Connected</span>
          </>
        ) : isConnected === false ? (
          <>
            <AlertCircle size={16} style={{ color: '#dc2626' }} />
            <span style={{ color: '#991b1b' }}>Weather API Connection Failed</span>
            <button
              onClick={testConnection}
              style={{
                marginLeft: 'auto',
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry Connection
            </button>
          </>
        ) : (
          <>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308' }}></div>
            <span style={{ color: '#92400e' }}>Checking connection...</span>
          </>
        )}
      </div>





      {/* Date Range Controls - 3 Buttons */}
      <div style={{
        marginBottom: '20px',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} />
          Date Range Settings
        </h3>

        {/* Three Date Range Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button
            onClick={setCurrentYear}
            style={{
              padding: '8px 16px',
              backgroundColor: dateRangeMode === 'current' ? '#22c55e' : '#f3f4f6',
              color: dateRangeMode === 'current' ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: dateRangeMode === 'current' ? '600' : '400'
            }}
          >
            {currentYear} Growing Season (Apr 1 - Today)
          </button>

          <button
            onClick={setPreviousYear}
            style={{
              padding: '8px 16px',
              backgroundColor: dateRangeMode === 'previous' ? '#22c55e' : '#f3f4f6',
              color: dateRangeMode === 'previous' ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: dateRangeMode === 'previous' ? '600' : '400'
            }}
          >
            {previousYear} Growing Season (Apr 1 - Oct 31)
          </button>

          <button
            onClick={setCustomDateRange}
            style={{
              padding: '8px 16px',
              backgroundColor: dateRangeMode === 'custom' ? '#22c55e' : '#f3f4f6',
              color: dateRangeMode === 'custom' ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: dateRangeMode === 'custom' ? '600' : '400'
            }}
          >
            Custom Date Range
          </button>
        </div>

        {/* Custom Date Range Inputs */}
        {showCustomRange && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Start Date:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>End Date:</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                onClick={handleCustomDateRangeUpdate}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Calendar size={16} />}
                Update Range
              </button>
            </div>
          </div>
        )}

        {/* Show current date range */}
        <div style={{
          padding: '10px',
          backgroundColor: '#e0f2fe',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#0369a1'
        }}>
          <strong>Current Range:</strong> {dateRange.start} to {dateRange.end}
          {dateRange.start && dateRange.end && (
            <span style={{ marginLeft: '10px' }}>
              ({Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24))} days)
            </span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertCircle size={20} style={{ color: '#dc2626', marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#991b1b', fontSize: '16px' }}>
              Weather Data Error ({error.code})
            </h4>
            <p style={{ margin: '0 0 12px 0', color: '#7f1d1d' }}>
              {error.message}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={retry}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Retry
              </button>
              <button
                onClick={clearError}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#dc2626',
                  border: '1px solid #dc2626',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weather Summary Stats */}
      {data.length > 0 && (
        <div className="responsive-grid section-spacing">
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={20} style={{ color: '#059669' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Total GDD</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#059669' }}>
              {Math.round(totalGDD)} GDDs
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
              {data.length} days
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CloudRain size={20} style={{ color: '#3b82f6' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Total Rainfall</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#3b82f6' }}>
              {totalRainfall.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
              Precipitation
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Thermometer size={20} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Avg High Temp</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ef4444' }}>
              {avgTempHigh.toFixed(1)}°F
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
              Daily average
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Thermometer size={20} style={{ color: '#8b5cf6' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Avg Low Temp</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#8b5cf6' }}>
              {avgTempLow.toFixed(1)}°F
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
              Daily average
            </div>
          </div>
        </div>
      )}

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

      {/* Enhanced GDD Chart - FIXED WITH VINEYARD ID */}
      {data.length > 0 && !loading && vineyardId && (
        <div style={{ marginBottom: '20px' }}>
          <EnhancedGDDChart
            weatherData={data}
            locationName={customLocation}
            vineyardId={vineyardId}
            onEventsChange={loadActivities}
          />
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
          color: '#64748b'
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



      {/* Streamlined Event Log Section */}
      {currentVineyard && (
        <div className="card section-spacing" data-event-log-section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🌱 Event Log
              </h3>
              {activities.length > 0 && (
                <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>{activities.length} total events</span>
                  <span>•</span>
                  <span style={{ color: '#059669' }}>{eventsWithLocation.length} with location</span>
                  <span>•</span>
                  <span style={{ color: eventsWithoutLocation.length > 0 ? '#dc2626' : '#6b7280' }}>
                    {eventsWithoutLocation.length} missing location
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Quick Location Actions */}
              {(() => {
                // Filter events by type first, then check for location
                const filteredEventsWithLocation = activities.filter(activity => {
                  // Apply event type filter
                  if (eventFilterTypes.length > 0) {
                    const eventType = activity.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';
                    if (!eventFilterTypes.includes(eventType)) return false;
                  }
                  // Then check for location
                  return activity.location_lat && activity.location_lng;
                });

                // Show button if there are any filtered events with locations
                return filteredEventsWithLocation.length > 0 && (
                  <a
                    href={(() => {
                      if (filteredEventsWithLocation.length === 1) {
                        // For single location, just open the map at that location
                        const event = filteredEventsWithLocation[0];
                        return `https://www.google.com/maps?q=${event.location_lat},${event.location_lng}&z=18`;
                      } else {
                        // For multiple locations, create a route
                        const waypoints = filteredEventsWithLocation.slice(1, -1).map(event =>
                          `${event.location_lat},${event.location_lng}`
                        ).join('|');

                        const origin = `${filteredEventsWithLocation[0].location_lat},${filteredEventsWithLocation[0].location_lng}`;
                        const destination = `${filteredEventsWithLocation[filteredEventsWithLocation.length - 1].location_lat},${filteredEventsWithLocation[filteredEventsWithLocation.length - 1].location_lng}`;

                        return waypoints.length > 0
                          ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}`
                          : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
                      }
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: '500'
                    }}
                    title={filteredEventsWithLocation.length === 1
                      ? 'View event location on map'
                      : `Route through ${filteredEventsWithLocation.length} filtered event locations`
                    }
                  >
                    🗺️ {filteredEventsWithLocation.length === 1 ? 'View' : 'Route All'} ({filteredEventsWithLocation.length})
                  </a>
                );
              })()}

              {/* Reports Button */}
              <button
                onClick={openReportsModal}
                disabled={!currentVineyard || activities.length === 0}
                style={{
                  padding: '6px 12px',
                  backgroundColor: !currentVineyard || activities.length === 0 ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: !currentVineyard || activities.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '500'
                }}
                title={!currentVineyard ? 'Select a vineyard first' : activities.length === 0 ? 'No events to report' : 'Generate vineyard reports'}
              >
                <FileText size={12} />
                📊 Reports
              </button>

              {/* Filter Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowEventFilterDropdown(!showEventFilterDropdown)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  🔍 {eventFilterTypes.length > 0 ? `${eventFilterTypes.length} filtered` : 'All'}
                </button>

                {showEventFilterDropdown && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    right: "0",
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                    zIndex: 1000,
                    minWidth: "200px",
                    maxHeight: "300px",
                    overflowY: "auto"
                  }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: "bold", fontSize: "12px" }}>
                      Filter events by type:
                    </div>
                    <div style={{ padding: "4px" }}>
                      <button
                        onClick={() => setEventFilterTypes([])}
                        style={{
                          width: "100%",
                          padding: "6px 12px",
                          backgroundColor: eventFilterTypes.length === 0 ? "#e0f2fe" : "transparent",
                          border: "none",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        Show All Events
                      </button>
                      {activityTypes.map((type) => {
                        const eventType = type.toLowerCase().replace(' ', '_');
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
                          soil_work: { color: "#8b5cf6", label: "Soil Work", emoji: "🌍" },
                          equipment_maintenance: { color: "#6b7280", label: "Equipment Maintenance", emoji: "🔧" },
                          fruit_set: { color: "#f59e0b", label: "Fruit Set", emoji: "🫐" },
                          pest: { color: "#dc2626", label: "Pest Observation", emoji: "🐞" },
                          scouting: { color: "#059669", label: "Scouting", emoji: "🔍" },
                          other: { color: "#9ca3af", label: "Other", emoji: "📝" },
                        };
                        const style = eventStyles[eventType] || eventStyles.other;
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
                              padding: "6px 12px",
                              backgroundColor: isSelected ? "#e0f2fe" : "transparent",
                              border: "none",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px"
                            }}
                          >
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                backgroundColor: style.color,
                                borderRadius: "50%"
                              }}
                            ></div>
                            {style.emoji} {style.label}
                            {isSelected && <span style={{ marginLeft: "auto", color: "#22c55e" }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Simplified Add Event Button */}
          {!showActivityForm && (
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => setShowActivityForm(true)}
                data-event-log-add-button
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#16a34a';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#22c55e';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                ➕ Add Event
              </button>
            </div>
          )}

          {/* Simplified Event Form */}
          {showActivityForm && (
            <div style={{
              padding: '20px',
              backgroundColor: '#f8fafc',
              border: '2px solid #22c55e',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: '0', color: '#059669', fontSize: '18px', fontWeight: '700' }}>
                  ➕ Add New Event
                </h4>
                <button
                  onClick={() => setShowActivityForm(false)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                    Event Type *
                  </label>
                  <select
                    value={activityForm.activity_type}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, activity_type: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: 'white'
                    }}
                    required
                  >
                    <option value="">Select event type...</option>
                    {activityTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={activityForm.start_date}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, start_date: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={activityForm.end_date}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, end_date: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                    min={activityForm.start_date}
                  />
                </div>
              </div>

              {/* Block Selection - Required for certain event types */}
              {selectedProperty && (activityForm.activity_type === 'Harvest' || activityForm.activity_type === 'Spray Application' || activityForm.activity_type === 'Canopy Management' || activityForm.activity_type === 'Irrigation' || activityForm.activity_type === 'Fertilization') && (
                <div style={{ marginBottom: '16px' }}>
                  <BlockSelector
                    propertyId={selectedProperty.id}
                    selectedBlockIds={selectedBlockIds}
                    onBlocksChange={setSelectedBlockIds}
                    disabled={isSavingActivity}
                  />
                </div>
              )}

              {/* Event Type Specific Details */}

              {/* Irrigation Details */}
              {activityForm.activity_type === 'Irrigation' && (
                <div style={{
                  marginBottom: '16px',
                  padding: '16px',
                  backgroundColor: '#e0f7fa',
                  border: '2px solid #26c6da',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px' }}>💧</span>
                    <h5 style={{ margin: '0', color: '#00695c', fontSize: '16px', fontWeight: '700' }}>
                      Irrigation Details
                    </h5>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#00695c' }}>
                        Water Amount
                      </label>
                      <input
                        type="text"
                        value={activityForm.irrigation_amount || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_amount: e.target.value }))}
                        placeholder="e.g. 1.5"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #26c6da',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#00695c' }}>
                        Unit
                      </label>
                      <select
                        value={activityForm.irrigation_unit || 'inches'}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_unit: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #26c6da',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="inches">inches</option>
                        <option value="gallons/acre">gallons/acre</option>
                        <option value="hours">hours</option>
                        <option value="mm">mm</option>
                        <option value="liters/hectare">liters/hectare</option>
                        <option value="minutes">minutes</option>
                        <option value="total gallons">total gallons</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#00695c' }}>
                        Method
                      </label>
                      <select
                        value={activityForm.irrigation_method || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_method: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #26c6da',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select method...</option>
                        <option value="drip">Drip irrigation</option>
                        <option value="sprinkler">Sprinkler system</option>
                        <option value="flood">Flood irrigation</option>
                        <option value="micro-sprinkler">Micro-sprinkler</option>
                        <option value="furrow">Furrow irrigation</option>
                        <option value="overhead">Overhead irrigation</option>
                        <option value="hand watering">Hand watering</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#00695c' }}>
                        Duration
                      </label>
                      <input
                        type="text"
                        value={activityForm.irrigation_duration || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_duration: e.target.value }))}
                        placeholder="e.g. 2 hours, 30 minutes"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #26c6da',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Fertilization Details */}
              {activityForm.activity_type === 'Fertilization' && (
                <div style={{
                  marginBottom: '16px',
                  padding: '16px',
                  backgroundColor: '#f0fdf4',
                  border: '2px solid #84cc16',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px' }}>🌱</span>
                    <h5 style={{ margin: '0', color: '#365314', fontSize: '16px', fontWeight: '700' }}>
                      Fertilization Details
                    </h5>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#365314' }}>
                        Fertilizer Type
                      </label>
                      <select
                        value={activityForm.fertilizer_type || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_type: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #84cc16',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select type...</option>
                        <option value="granular NPK">Granular N-P-K</option>
                        <option value="liquid fertilizer">Liquid fertilizer</option>
                        <option value="compost">Compost</option>
                        <option value="manure">Manure</option>
                        <option value="bone meal">Bone meal</option>
                        <option value="fish emulsion">Fish emulsion</option>
                        <option value="calcium sulfate">Calcium sulfate</option>
                        <option value="potassium sulfate">Potassium sulfate</option>
                        <option value="urea">Urea</option>
                        <option value="ammonium sulfate">Ammonium sulfate</option>
                        <option value="organic blend">Organic blend</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#365314' }}>
                        N-P-K Ratio
                      </label>
                      <input
                        type="text"
                        value={activityForm.fertilizer_npk || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_npk: e.target.value }))}
                        placeholder="e.g. 10-10-10, 20-5-5"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #84cc16',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#365314' }}>
                        Application Rate
                      </label>
                      <input
                        type="text"
                        value={activityForm.fertilizer_rate || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_rate: e.target.value }))}
                        placeholder="e.g. 50"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #84cc16',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#365314' }}>
                        Unit
                      </label>
                      <select
                        value={activityForm.fertilizer_unit || 'lbs/acre'}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_unit: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #84cc16',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="lbs/acre">lbs/acre</option>
                        <option value="kg/hectare">kg/hectare</option>
                        <option value="tons/acre">tons/acre</option>
                        <option value="gal/acre">gal/acre</option>
                        <option value="L/hectare">L/hectare</option>
                        <option value="cubic yards">cubic yards</option>
                        <option value="total lbs">total lbs</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#365314' }}>
                        Application Method
                      </label>
                      <select
                        value={activityForm.fertilizer_method || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_method: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #84cc16',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select method...</option>
                        <option value="broadcast">Broadcast</option>
                        <option value="banded">Banded application</option>
                        <option value="foliar">Foliar spray</option>
                        <option value="fertigation">Fertigation</option>
                        <option value="side-dress">Side-dress</option>
                        <option value="topdress">Topdress</option>
                        <option value="incorporation">Soil incorporation</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Harvest Details */}
              {activityForm.activity_type === 'Harvest' && (
                <div style={{
                  marginBottom: '16px',
                  padding: '16px',
                  backgroundColor: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px' }}>🍷</span>
                    <h5 style={{ margin: '0', color: '#991b1b', fontSize: '16px', fontWeight: '700' }}>
                      Harvest Details
                    </h5>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>
                        Yield
                      </label>
                      <input
                        type="text"
                        value={activityForm.harvest_yield || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_yield: e.target.value }))}
                        placeholder="e.g. 4.5"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>
                        Unit
                      </label>
                      <select
                        value={activityForm.harvest_unit || 'tons/acre'}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_unit: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="tons/acre">tons/acre</option>
                        <option value="tonnes/hectare">tonnes/hectare</option>
                        <option value="lbs/vine">lbs/vine</option>
                        <option value="kg/vine">kg/vine</option>
                        <option value="total tons">total tons</option>
                        <option value="total lbs">total lbs</option>
                        <option value="bins">bins</option>
                        <option value="cases">cases</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>
                        Brix (°Bx)
                      </label>
                      <input
                        type="text"
                        value={activityForm.harvest_brix || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_brix: e.target.value }))}
                        placeholder="e.g. 24.5"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>
                        pH
                      </label>
                      <input
                        type="text"
                        value={activityForm.harvest_ph || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_ph: e.target.value }))}
                        placeholder="e.g. 3.4"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>
                        TA (g/L)
                      </label>
                      <input
                        type="text"
                        value={activityForm.harvest_ta || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_ta: e.target.value }))}
                        placeholder="e.g. 6.8"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>
                        Block/Variety
                      </label>
                      <input
                        type="text"
                        value={activityForm.harvest_block || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_block: e.target.value }))}
                        placeholder="e.g. Block 5 Chardonnay"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Canopy Management Details */}
              {activityForm.activity_type === 'Canopy Management' && (
                <div style={{
                  marginBottom: '16px',
                  padding: '16px',
                  backgroundColor: '#f0fdf4',
                  border: '2px solid #10b981',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px' }}>🍃</span>
                    <h5 style={{ margin: '0', color: '#065f46', fontSize: '16px', fontWeight: '700' }}>
                      Canopy Management Details
                    </h5>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#065f46' }}>
                        Activity Type
                      </label>
                      <select
                        value={activityForm.canopy_activity || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_activity: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #10b981',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select activity...</option>
                        <option value="shoot thinning">Shoot thinning</option>
                        <option value="leaf removal">Leaf removal</option>
                        <option value="cluster thinning">Cluster thinning</option>
                        <option value="hedging">Hedging</option>
                        <option value="positioning">Shoot positioning</option>
                        <option value="topping">Topping</option>
                        <option value="suckering">Suckering</option>
                        <option value="lateral removal">Lateral removal</option>
                        <option value="tying">Cane tying</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#065f46' }}>
                        Intensity
                      </label>
                      <select
                        value={activityForm.canopy_intensity || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_intensity: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #10b981',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select intensity...</option>
                        <option value="light">Light (10-25%)</option>
                        <option value="moderate">Moderate (25-50%)</option>
                        <option value="heavy">Heavy (50%+)</option>
                        <option value="selective">Selective</option>
                        <option value="complete">Complete removal</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#065f46' }}>
                        Side/Location
                      </label>
                      <select
                        value={activityForm.canopy_side || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_side: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #10b981',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select side...</option>
                        <option value="both sides">Both sides</option>
                        <option value="east side">East side</option>
                        <option value="west side">West side</option>
                        <option value="morning sun">Morning sun side</option>
                        <option value="afternoon sun">Afternoon sun side</option>
                        <option value="fruit zone">Fruit zone</option>
                        <option value="upper canopy">Upper canopy</option>
                        <option value="basal leaves">Basal leaves</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#065f46' }}>
                        Growth Stage
                      </label>
                      <select
                        value={activityForm.canopy_stage || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_stage: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #10b981',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select stage...</option>
                        <option value="pre-bloom">Pre-bloom</option>
                        <option value="bloom">Bloom</option>
                        <option value="post-bloom">Post-bloom</option>
                        <option value="fruit set">Fruit set</option>
                        <option value="lag phase">Lag phase</option>
                        <option value="veraison">Veraison</option>
                        <option value="pre-harvest">Pre-harvest</option>
                        <option value="post-harvest">Post-harvest</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Scouting/Pest Details */}
              {(activityForm.activity_type === 'Scouting' || activityForm.activity_type === 'Pest') && (
                <div style={{
                  marginBottom: '16px',
                  padding: '16px',
                  backgroundColor: '#f0f9ff',
                  border: '2px solid #059669',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{activityForm.activity_type === 'Pest' ? '🐞' : '🔍'}</span>
                    <h5 style={{ margin: '0', color: '#064e3b', fontSize: '16px', fontWeight: '700' }}>
                      {activityForm.activity_type === 'Pest' ? 'Pest Observation' : 'Scouting'} Details
                    </h5>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#064e3b' }}>
                        Focus/Pest Type
                      </label>
                      <select
                        value={activityForm.scout_focus || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, scout_focus: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #059669',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select focus...</option>
                        <optgroup label="Diseases">
                          <option value="powdery mildew">Powdery mildew</option>
                          <option value="downy mildew">Downy mildew</option>
                          <option value="botrytis">Botrytis (Gray mold)</option>
                          <option value="black rot">Black rot</option>
                          <option value="phomopsis">Phomopsis</option>
                          <option value="crown gall">Crown gall</option>
                          <option value="esca">Esca</option>
                          <option value="eutypa">Eutypa</option>
                          <option value="other disease">Other</option>
                        </optgroup>
                        <optgroup label="Insect Pests">
                          <option value="spider mites">Spider mites</option>
                          <option value="thrips">Thrips</option>
                          <option value="leafhoppers">Leafhoppers</option>
                          <option value="aphids">Aphids</option>
                          <option value="mealybugs">Mealybugs</option>
                          <option value="grape berry moth">Grape berry moth</option>
                          <option value="scale insects">Scale insects</option>
                          <option value="cutworms">Cutworms</option>
                          <option value="japanese beetles">Japanese beetles</option>
                          <option value="other insect">Other</option>
                        </optgroup>
                        <optgroup label="General Scouting">
                          <option value="general health">General plant health</option>
                          <option value="nutrient deficiency">Nutrient deficiency</option>
                          <option value="water stress">Water stress</option>
                          <option value="frost damage">Frost damage</option>
                          <option value="wind damage">Wind damage</option>
                          <option value="bird damage">Bird damage</option>
                          <option value="wildlife damage">Wildlife damage</option>
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#064e3b' }}>
                        Severity Level
                      </label>
                      <select
                        value={activityForm.scout_severity || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, scout_severity: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #059669',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select severity...</option>
                        <option value="none">None (0%)</option>
                        <option value="trace">Trace (&lt;5%)</option>
                        <option value="light">Light (5-15%)</option>
                        <option value="moderate">Moderate (15-30%)</option>
                        <option value="heavy">Heavy (30-50%)</option>
                        <option value="severe">Severe (&gt;50%)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#064e3b' }}>
                        Distribution
                      </label>
                      <select
                        value={activityForm.scout_distribution || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, scout_distribution: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #059669',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select distribution...</option>
                        <option value="isolated">Isolated (few spots)</option>
                        <option value="scattered">Scattered patches</option>
                        <option value="widespread">Widespread</option>
                        <option value="uniform">Uniform throughout</option>
                        <option value="edge rows">Edge rows only</option>
                        <option value="wet areas">Wet/low areas</option>
                        <option value="hilltops">Hilltops/exposed areas</option>
                        <option value="specific block">Specific block only</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#064e3b' }}>
                        Action Needed
                      </label>
                      <select
                        value={activityForm.scout_action || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, scout_action: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #059669',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Select action...</option>
                        <option value="none">None - continue monitoring</option>
                        <option value="monitor weekly">Monitor weekly</option>
                        <option value="monitor bi-weekly">Monitor bi-weekly</option>
                        <option value="treatment required">Treatment required</option>
                        <option value="spray scheduled">Spray scheduled</option>
                        <option value="cultural practices">Cultural practices needed</option>
                        <option value="consult advisor">Consult advisor</option>
                        <option value="lab analysis">Send for lab analysis</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Spray Application Specific Fields */}
              {activityForm.activity_type === 'Spray Application' && (
                <div style={{
                  marginBottom: '16px',
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px' }}>🌿</span>
                    <h5 style={{ margin: '0', color: '#92400e', fontSize: '16px', fontWeight: '700' }}>
                      Spray Application Details
                    </h5>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                        Product Name *
                      </label>
                      <select
                        value={activityForm.spray_product}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, spray_product: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #f59e0b',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                        required
                      >
                        <option value="">Select product...</option>
                        <optgroup label="Fungicides">
                          <option value="Captan">Captan</option>
                          <option value="Copper Sulfate">Copper Sulfate</option>
                          <option value="Sulfur">Sulfur</option>
                          <option value="Mancozeb">Mancozeb</option>
                          <option value="Chlorothalonil">Chlorothalonil</option>
                          <option value="Propiconazole">Propiconazole</option>
                          <option value="Myclobutanil">Myclobutanil</option>
                          <option value="Tebuconazole">Tebuconazole</option>
                        </optgroup>
                        <optgroup label="Insecticides">
                          <option value="Imidacloprid">Imidacloprid</option>
                          <option value="Spinosad">Spinosad</option>
                          <option value="Carbaryl">Carbaryl</option>
                          <option value="Malathion">Malathion</option>
                          <option value="Bt (Bacillus thuringiensis)">Bt (Bacillus thuringiensis)</option>
                        </optgroup>
                        <optgroup label="Herbicides">
                          <option value="Glyphosate">Glyphosate</option>
                          <option value="Roundup">Roundup</option>
                          <option value="2,4-D">2,4-D</option>
                          <option value="Dicamba">Dicamba</option>
                          <option value="Paraquat">Paraquat</option>
                        </optgroup>
                        <optgroup label="Organic/Biological">
                          <option value="Neem Oil">Neem Oil</option>
                          <option value="Horticultural Oil">Horticultural Oil</option>
                          <option value="Kaolin Clay">Kaolin Clay</option>
                        </optgroup>
                        <option value="Other">Other (specify in notes)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                        Quantity
                      </label>
                      <input
                        type="text"
                        value={activityForm.spray_quantity}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, spray_quantity: e.target.value }))}
                        placeholder="e.g. 2.5"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #f59e0b',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                        Unit
                      </label>
                      <select
                        value={activityForm.spray_unit}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, spray_unit: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #f59e0b',
                          borderRadius: '6px',
                          backgroundColor: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="oz/acre">oz/acre</option>
                        <option value="lb/acre">lb/acre</option>
                        <option value="gal/acre">gal/acre</option>
                        <option value="ml/acre">ml/acre</option>
                        <option value="kg/ha">kg/ha</option>
                        <option value="L/ha">L/ha</option>
                        <option value="total gallons">total gallons</option>
                        <option value="total liters">total liters</option>
                      </select>
                    </div>
                  </div>

                  {/* Safety Information Display */}
                  {activityForm.spray_product && sprayDatabase[activityForm.spray_product as keyof typeof sprayDatabase] && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#fef2f2',
                      border: '2px solid #f87171',
                      borderRadius: '6px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '16px' }}>⚠️</span>
                        <span style={{ fontWeight: '700', color: '#991b1b', fontSize: '14px' }}>
                          SAFETY INFORMATION
                        </span>
                      </div>
                      {(() => {
                        const productInfo = sprayDatabase[activityForm.spray_product as keyof typeof sprayDatabase];
                        return (
                          <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                            <div style={{ marginBottom: '4px' }}>
                              <strong>Re-entry Interval:</strong> {productInfo.reentryHours} hours
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              <strong>Pre-harvest Interval:</strong> {productInfo.preharvestDays} days
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              <strong>Category:</strong> {productInfo.category} | <strong>Signal Word:</strong> {productInfo.signal}
                            </div>
                            <div style={{ fontStyle: 'italic', marginTop: '6px' }}>
                              Always follow label instructions and local regulations
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                        Target Pest/Disease
                      </label>
                      <input
                        type="text"
                        value={activityForm.spray_target}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, spray_target: e.target.value }))}
                        placeholder="e.g. Powdery mildew, Spider mites"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #f59e0b',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                        Equipment Used
                      </label>
                      <input
                        type="text"
                        value={activityForm.spray_equipment}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, spray_equipment: e.target.value }))}
                        placeholder="e.g. Airblast sprayer, Backpack"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #f59e0b',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                      Weather Conditions
                    </label>
                    <input
                      type="text"
                      value={activityForm.spray_conditions}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, spray_conditions: e.target.value }))}
                      placeholder="e.g. Wind: 5mph SW, Temp: 72°F, Humidity: 65%"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  {/* Database Source Information */}
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#475569',
                    marginTop: '8px'
                  }}>
                    <strong>Safety Data Sources:</strong> EPA pesticide labels, University extension publications, industry standard practices.
                    Always verify with current product labels and local regulations before application.
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={activityForm.activity_type === 'Spray Application' ?
                    "Additional notes about application conditions, coverage, any issues encountered..." :
                    "Add any details about this event..."
                  }
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Simplified Location Section */}
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#fefce8',
                border: '1px solid #fde68a',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📍</span>
                  <label style={{ fontWeight: '600', fontSize: '14px', color: '#a16207' }}>
                    Location (Optional)
                  </label>
                </div>

                {activityForm.location_lat && activityForm.location_lng ? (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ fontSize: '13px', color: '#065f46' }}>
                      📍 {activityForm.location_name || 'Location set'}
                    </div>
                    <button
                      onClick={clearLocation}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '12px', color: '#92400e' }}>
                      No location set for this event
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: isGettingLocation ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      fontWeight: '500'
                    }}
                  >
                    {isGettingLocation ? (
                      <>
                        <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        Getting...
                      </>
                    ) : (
                      '📍 Check In Here'
                    )}
                  </button>

                  {currentVineyard && (
                    <button
                      type="button"
                      onClick={useVineyardLocation}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontWeight: '500'
                      }}
                    >
                      🍇 Vineyard Location
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={saveActivity}
                  disabled={isSavingActivity || !activityForm.activity_type || !activityForm.start_date}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: isSavingActivity || !activityForm.activity_type || !activityForm.start_date ? '#9ca3af' : '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingActivity || !activityForm.activity_type || !activityForm.start_date ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: '600'
                  }}
                >
                  {isSavingActivity ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '💾'}
                  {isSavingActivity ? 'Saving...' : 'Save Event'}
                </button>

                <button
                  onClick={() => setShowActivityForm(false)}
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

          {/* Unified Event List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: '0', fontSize: '16px', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📅 Event History
              </h4>
              <button
                onClick={loadActivities}
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

            {isLoadingActivities ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                <div>Loading events...</div>
              </div>
            ) : activities.length === 0 ? (
              <div style={{
                padding: '30px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '2px dashed #cbd5e1'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📅</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Events Logged</h4>
                <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
                  Start logging your vineyard events to track phenology and activities throughout the season.
                </p>
              </div>
            ) : (
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: 'white'
              }}>
                {activities.filter(activity => {
                  // Apply event type filter
                  if (eventFilterTypes.length === 0) return true;
                  const eventType = activity.event_type?.toLowerCase().replace(' ', '_') || 'other';
                  return eventFilterTypes.includes(eventType);
                }).map((activity, index) => {
                  // Get event style with icon and color
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
                    soil_work: { color: "#8b5cf6", label: "Soil Work", emoji: "🌍" },
                    equipment_maintenance: { color: "#6b7280", label: "Equipment Maintenance", emoji: "🔧" },
                    fruit_set: { color: "#f59e0b", label: "Fruit Set", emoji: "🫐" },
                    pest: { color: "#dc2626", label: "Pest Observation", emoji: "🐞" },
                    scouting: { color: "#059669", label: "Scouting", emoji: "🔍" },
                    other: { color: "#9ca3af", label: "Other", emoji: "📝" },
                  };

                  // Normalize event type - ensure consistent mapping
                  let eventType = activity.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';

                  // Handle any legacy mapping issues
                  if (eventType === 'pest_observation') eventType = 'pest';
                  if (eventType === 'scouting_activity') eventType = 'scouting';

                  const style = eventStyles[eventType] || eventStyles.other;

                  // Calculate GDD at event date
                  const gddAtEvent = data.find(d => d.date === activity.event_date)?.gdd || 0;
                  const cumulativeGDD = data.filter(d => d.date <= activity.event_date).reduce((sum, d) => sum + d.gdd, 0);

                  // Check if this activity is being edited
                  const isBeingEdited = editingActivityId === activity.id;

                  // Get block names for display
                  const blockNames = activity.blocks && Array.isArray(activity.blocks)
                    ? activity.blocks.map((block: any) => block.name).join(', ')
                    : 'N/A';

                  return (
                    <div
                      key={activity.id || index}
                      style={{
                        padding: '15px',
                        borderBottom: index < activities.length - 1 ? '1px solid #f3f4f6' : 'none',
                        backgroundColor: isBeingEdited ? '#f0f9ff' : 'transparent',
                        border: isBeingEdited ? '2px solid #0ea5e9' : 'none',
                        borderRadius: isBeingEdited ? '8px' : '0'
                      }}
                    >
                      {isBeingEdited ? (
                        // Edit form
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h5 style={{ margin: '0', color: '#0369a1', fontSize: '14px', fontWeight: '600' }}>
                              ✏️ Editing {style.emoji} {style.label}
                            </h5>
                            <button
                              onClick={cancelEditingActivity}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              ✕
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '15px' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '12px', color: '#374151' }}>
                                Event Type *
                              </label>
                              <select
                                value={editActivityForm.activity_type}
                                onChange={(e) => setEditActivityForm(prev => ({ ...prev, activity_type: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  backgroundColor: 'white',
                                  fontSize: '13px'
                                }}
                                required
                              >
                                <option value="">Select event type...</option>
                                {activityTypes.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '12px', color: '#374151' }}>
                                Start Date *
                              </label>
                              <input
                                type="date"
                                value={editActivityForm.start_date}
                                onChange={(e) => setEditActivityForm(prev => ({ ...prev, start_date: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px'
                                }}
                                required
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '12px', color: '#374151' }}>
                                End Date (Optional)
                              </label>
                              <input
                                type="date"
                                value={editActivityForm.end_date}
                                onChange={(e) => setEditActivityForm(prev => ({ ...prev, end_date: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px'
                                }}
                                min={editActivityForm.start_date}
                              />
                            </div>
                          </div>

                          {/* Event Type Specific Details for Edit Form */}

                          {/* Spray Application Details */}
                          {editActivityForm.activity_type === 'Spray Application' && (
                            <div style={{
                              marginBottom: '15px',
                              padding: '14px',
                              backgroundColor: '#fef3c7',
                              border: '2px solid #fbbf24',
                              borderRadius: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '18px' }}>🌿</span>
                                <h5 style={{ margin: '0', color: '#92400e', fontSize: '14px', fontWeight: '700' }}>
                                  Spray Application Details
                                </h5>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#92400e' }}>
                                    Product Name *
                                  </label>
                                  <select
                                    value={editActivityForm.spray_product}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, spray_product: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #f59e0b',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                    required
                                  >
                                    <option value="">Select product...</option>
                                    <optgroup label="Fungicides">
                                      <option value="Captan">Captan</option>
                                      <option value="Copper Sulfate">Copper Sulfate</option>
                                      <option value="Sulfur">Sulfur</option>
                                      <option value="Mancozeb">Mancozeb</option>
                                      <option value="Chlorothalonil">Chlorothalonil</option>
                                      <option value="Propiconazole">Propiconazole</option>
                                      <option value="Myclobutanil">Myclobutanil</option>
                                      <option value="Tebuconazole">Tebuconazole</option>
                                    </optgroup>
                                    <optgroup label="Insecticides">
                                      <option value="Imidacloprid">Imidacloprid</option>
                                      <option value="Spinosad">Spinosad</option>
                                      <option value="Carbaryl">Carbaryl</option>
                                      <option value="Malathion">Malathion</option>
                                      <option value="Bt (Bacillus thuringiensis)">Bt (Bacillus thuringiensis)</option>
                                    </optgroup>
                                    <optgroup label="Herbicides">
                                      <option value="Glyphosate">Glyphosate</option>
                                      <option value="Roundup">Roundup</option>
                                      <option value="2,4-D">2,4-D</option>
                                      <option value="Dicamba">Dicamba</option>
                                      <option value="Paraquat">Paraquat</option>
                                    </optgroup>
                                    <optgroup label="Organic/Biological">
                                      <option value="Neem Oil">Neem Oil</option>
                                      <option value="Horticultural Oil">Horticultural Oil</option>
                                      <option value="Kaolin Clay">Kaolin Clay</option>
                                    </optgroup>
                                    <option value="Other">Other (specify in notes)</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#92400e' }}>
                                    Quantity
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.spray_quantity}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, spray_quantity: e.target.value }))}
                                    placeholder="e.g. 2.5"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #f59e0b',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#92400e' }}>
                                    Unit
                                  </label>
                                  <select
                                    value={editActivityForm.spray_unit}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, spray_unit: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #f59e0b',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="oz/acre">oz/acre</option>
                                    <option value="lb/acre">lb/acre</option>
                                    <option value="gal/acre">gal/acre</option>
                                    <option value="ml/acre">ml/acre</option>
                                    <option value="kg/ha">kg/ha</option>
                                    <option value="L/ha">L/ha</option>
                                    <option value="total gallons">total gallons</option>
                                    <option value="total liters">total liters</option>
                                  </select>
                                </div>
                                {/* ... other spray fields ... */}
                              </div>

                              {/* Safety Information Display for Edit */}
                              {editActivityForm.spray_product && sprayDatabase[editActivityForm.spray_product as keyof typeof sprayDatabase] && (
                                <div style={{
                                  padding: '10px',
                                  backgroundColor: '#fef2f2',
                                  border: '2px solid #f87171',
                                  borderRadius: '6px',
                                  marginBottom: '10px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '14px' }}>⚠️</span>
                                    <span style={{ fontWeight: '700', color: '#991b1b', fontSize: '12px' }}>
                                      SAFETY INFORMATION
                                    </span>
                                  </div>
                                  {(() => {
                                    const productInfo = sprayDatabase[editActivityForm.spray_product as keyof typeof sprayDatabase];
                                    if (productInfo) {
                                      const sprayDate = new Date(editActivityForm.start_date);
                                      const today = new Date();
                                      const hoursSinceSpray = Math.floor((today.getTime() - sprayDate.getTime()) / (1000 * 60 * 60));

                                      return (
                                        <div style={{ fontSize: '11px', color: '#7f1d1d' }}>
                                          <div style={{ marginBottom: '3px' }}>
                                            <strong>Re-entry Interval:</strong> {productInfo.reentryHours} hours
                                          </div>
                                          <div style={{ marginBottom: '3px' }}>
                                            <strong>Pre-harvest Interval:</strong> {productInfo.preharvestDays} days
                                          </div>
                                          <div style={{ marginBottom: '3px' }}>
                                            <strong>Category:</strong> {productInfo.category} | <strong>Signal Word:</strong> {productInfo.signal}
                                          </div>
                                          <div style={{ fontStyle: 'italic', marginTop: '4px' }}>
                                            Always follow label instructions and local regulations
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#92400e' }}>
                                    Target Pest/Disease
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.spray_target}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, spray_target: e.target.value }))}
                                    placeholder="e.g. Powdery mildew, Spider mites"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #f59e0b',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#92400e' }}>
                                    Equipment Used
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.spray_equipment}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, spray_equipment: e.target.value }))}
                                    placeholder="e.g. Airblast sprayer, Backpack"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #f59e0b',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Irrigation Details */}
                          {editActivityForm.activity_type === 'Irrigation' && (
                            <div style={{
                              marginBottom: '15px',
                              padding: '14px',
                              backgroundColor: '#e0f7fa',
                              border: '2px solid #26c6da',
                              borderRadius: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '18px' }}>💧</span>
                                <h5 style={{ margin: '0', color: '#00695c', fontSize: '14px', fontWeight: '700' }}>
                                  Irrigation Details
                                </h5>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#00695c' }}>
                                    Water Amount
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.irrigation_amount}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, irrigation_amount: e.target.value }))}
                                    placeholder="e.g. 1.5"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #26c6da',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#00695c' }}>
                                    Unit
                                  </label>
                                  <select
                                    value={editActivityForm.irrigation_unit}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, irrigation_unit: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #26c6da',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="inches">inches</option>
                                    <option value="gallons/acre">gallons/acre</option>
                                    <option value="hours">hours</option>
                                    <option value="mm">mm</option>
                                    <option value="liters/hectare">liters/hectare</option>
                                    <option value="minutes">minutes</option>
                                    <option value="total gallons">total gallons</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#00695c' }}>
                                    Method
                                  </label>
                                  <select
                                    value={editActivityForm.irrigation_method}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, irrigation_method: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #26c6da',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select method...</option>
                                    <option value="drip">Drip irrigation</option>
                                    <option value="sprinkler">Sprinkler system</option>
                                    <option value="flood">Flood irrigation</option>
                                    <option value="micro-sprinkler">Micro-sprinkler</option>
                                    <option value="furrow">Furrow irrigation</option>
                                    <option value="overhead">Overhead irrigation</option>
                                    <option value="hand watering">Hand watering</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#00695c' }}>
                                    Duration
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.irrigation_duration}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, irrigation_duration: e.target.value }))}
                                    placeholder="e.g. 2 hours, 30 minutes"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #26c6da',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Fertilization Details */}
                          {editActivityForm.activity_type === 'Fertilization' && (
                            <div style={{
                              marginBottom: '15px',
                              padding: '14px',
                              backgroundColor: '#f0fdf4',
                              border: '2px solid #84cc16',
                              borderRadius: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '18px' }}>🌱</span>
                                <h5 style={{ margin: '0', color: '#365314', fontSize: '14px', fontWeight: '700' }}>
                                  Fertilization Details
                                </h5>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#365314' }}>
                                    Fertilizer Type
                                  </label>
                                  <select
                                    value={editActivityForm.fertilizer_type}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, fertilizer_type: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #84cc16',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select type...</option>
                                    <option value="granular NPK">Granular N-P-K</option>
                                    <option value="liquid fertilizer">Liquid fertilizer</option>
                                    <option value="compost">Compost</option>
                                    <option value="manure">Manure</option>
                                    <option value="bone meal">Bone meal</option>
                                    <option value="fish emulsion">Fish emulsion</option>
                                    <option value="calcium sulfate">Calcium sulfate</option>
                                    <option value="potassium sulfate">Potassium sulfate</option>
                                    <option value="urea">Urea</option>
                                    <option value="ammonium sulfate">Ammonium sulfate</option>
                                    <option value="organic blend">Organic blend</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#365314' }}>
                                    N-P-K Ratio
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.fertilizer_npk}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, fertilizer_npk: e.target.value }))}
                                    placeholder="e.g. 10-10-10, 20-5-5"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #84cc16',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#365314' }}>
                                    Application Rate
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.fertilizer_rate}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, fertilizer_rate: e.target.value }))}
                                    placeholder="e.g. 50"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #84cc16',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#365314' }}>
                                    Unit
                                  </label>
                                  <select
                                    value={editActivityForm.fertilizer_unit}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, fertilizer_unit: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #84cc16',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="lbs/acre">lbs/acre</option>
                                    <option value="kg/hectare">kg/hectare</option>
                                    <option value="tons/acre">tons/acre</option>
                                    <option value="gal/acre">gal/acre</option>
                                    <option value="L/hectare">L/hectare</option>
                                    <option value="cubic yards">cubic yards</option>
                                    <option value="total lbs">total lbs</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#365314' }}>
                                    Application Method
                                  </label>
                                  <select
                                    value={editActivityForm.fertilizer_method}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, fertilizer_method: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #84cc16',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select method...</option>
                                    <option value="broadcast">Broadcast</option>
                                    <option value="banded">Banded application</option>
                                    <option value="foliar">Foliar spray</option>
                                    <option value="fertigation">Fertigation</option>
                                    <option value="side-dress">Side-dress</option>
                                    <option value="topdress">Topdress</option>
                                    <option value="incorporation">Soil incorporation</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Harvest Details */}
                          {editActivityForm.activity_type === 'Harvest' && (
                            <div style={{
                              marginBottom: '15px',
                              padding: '14px',
                              backgroundColor: '#fef2f2',
                              border: '2px solid #ef4444',
                              borderRadius: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '18px' }}>🍷</span>
                                <h5 style={{ margin: '0', color: '#991b1b', fontSize: '14px', fontWeight: '700' }}>
                                  Harvest Details
                                </h5>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#991b1b' }}>
                                    Yield
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.harvest_yield}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, harvest_yield: e.target.value }))}
                                    placeholder="e.g. 4.5"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #ef4444',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#991b1b' }}>
                                    Unit
                                  </label>
                                  <select
                                    value={editActivityForm.harvest_unit}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, harvest_unit: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #ef4444',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="tons/acre">tons/acre</option>
                                    <option value="tonnes/hectare">tonnes/hectare</option>
                                    <option value="lbs/vine">lbs/vine</option>
                                    <option value="kg/vine">kg/vine</option>
                                    <option value="total tons">total tons</option>
                                    <option value="total lbs">total lbs</option>
                                    <option value="bins">bins</option>
                                    <option value="cases">cases</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#991b1b' }}>
                                    Brix (°Bx)
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.harvest_brix}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, harvest_brix: e.target.value }))}
                                    placeholder="e.g. 24.5"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #ef4444',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#991b1b' }}>
                                    pH
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.harvest_ph}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, harvest_ph: e.target.value }))}
                                    placeholder="e.g. 3.4"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #ef4444',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#991b1b' }}>
                                    TA (g/L)
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.harvest_ta}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, harvest_ta: e.target.value }))}
                                    placeholder="e.g. 6.8"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #ef4444',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#991b1b' }}>
                                    Block/Variety
                                  </label>
                                  <input
                                    type="text"
                                    value={editActivityForm.harvest_block}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, harvest_block: e.target.value }))}
                                    placeholder="e.g. Block 5 Chardonnay"
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #ef4444',
                                      borderRadius: '6px',
                                      fontSize: '11px'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Canopy Management Details */}
                          {editActivityForm.activity_type === 'Canopy Management' && (
                            <div style={{
                              marginBottom: '15px',
                              padding: '14px',
                              backgroundColor: '#f0fdf4',
                              border: '2px solid #10b981',
                              borderRadius: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '18px' }}>🍃</span>
                                <h5 style={{ margin: '0', color: '#065f46', fontSize: '14px', fontWeight: '700' }}>
                                  Canopy Management Details
                                </h5>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#065f46' }}>
                                    Activity Type
                                  </label>
                                  <select
                                    value={editActivityForm.canopy_activity}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, canopy_activity: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #10b981',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select activity...</option>
                                    <option value="shoot thinning">Shoot thinning</option>
                                    <option value="leaf removal">Leaf removal</option>
                                    <option value="cluster thinning">Cluster thinning</option>
                                    <option value="hedging">Hedging</option>
                                    <option value="positioning">Shoot positioning</option>
                                    <option value="topping">Topping</option>
                                    <option value="suckering">Suckering</option>
                                    <option value="lateral removal">Lateral removal</option>
                                    <option value="tying">Cane tying</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#065f46' }}>
                                    Intensity
                                  </label>
                                  <select
                                    value={editActivityForm.canopy_intensity}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, canopy_intensity: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #10b981',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select intensity...</option>
                                    <option value="light">Light (10-25%)</option>
                                    <option value="moderate">Moderate (25-50%)</option>
                                    <option value="heavy">Heavy (50%+)</option>
                                    <option value="selective">Selective</option>
                                    <option value="complete">Complete removal</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#065f46' }}>
                                    Side/Location
                                  </label>
                                  <select
                                    value={editActivityForm.canopy_side}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, canopy_side: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #10b981',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select side...</option>
                                    <option value="both sides">Both sides</option>
                                    <option value="east side">East side</option>
                                    <option value="west side">West side</option>
                                    <option value="morning sun">Morning sun side</option>
                                    <option value="afternoon sun">Afternoon sun side</option>
                                    <option value="fruit zone">Fruit zone</option>
                                    <option value="upper canopy">Upper canopy</option>
                                    <option value="basal leaves">Basal leaves</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#065f46' }}>
                                    Growth Stage
                                  </label>
                                  <select
                                    value={editActivityForm.canopy_stage}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, canopy_stage: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #10b981',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select stage...</option>
                                    <option value="pre-bloom">Pre-bloom</option>
                                    <option value="bloom">Bloom</option>
                                    <option value="post-bloom">Post-bloom</option>
                                    <option value="fruit set">Fruit set</option>
                                    <option value="lag phase">Lag phase</option>
                                    <option value="veraison">Veraison</option>
                                    <option value="pre-harvest">Pre-harvest</option>
                                    <option value="post-harvest">Post-harvest</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Scouting/Pest Details */}
                          {(editActivityForm.activity_type === 'Scouting' || editActivityForm.activity_type === 'Pest') && (
                            <div style={{
                              marginBottom: '15px',
                              padding: '14px',
                              backgroundColor: '#f0f9ff',
                              border: '2px solid #059669',
                              borderRadius: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '18px' }}>{editActivityForm.activity_type === 'Pest' ? '🐞' : '🔍'}</span>
                                <h5 style={{ margin: '0', color: '#064e3b', fontSize: '14px', fontWeight: '700' }}>
                                  {editActivityForm.activity_type === 'Pest' ? 'Pest Observation' : 'Scouting'} Details
                                </h5>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#064e3b' }}>
                                    Focus/Pest Type
                                  </label>
                                  <select
                                    value={editActivityForm.scout_focus}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, scout_focus: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #059669',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select focus...</option>
                                    <optgroup label="Diseases">
                                      <option value="powdery mildew">Powdery mildew</option>
                                      <option value="downy mildew">Downy mildew</option>
                                      <option value="botrytis">Botrytis (Gray mold)</option>
                                      <option value="black rot">Black rot</option>
                                      <option value="phomopsis">Phomopsis</option>
                                      <option value="crown gall">Crown gall</option>
                                      <option value="esca">Esca</option>
                                      <option value="eutypa">Eutypa</option>
                                      <option value="other disease">Other</option>
                                    </optgroup>
                                    <optgroup label="Insect Pests">
                                      <option value="spider mites">Spider mites</option>
                                      <option value="thrips">Thrips</option>
                                      <option value="leafhoppers">Leafhoppers</option>
                                      <option value="aphids">Aphids</option>
                                      <option value="mealybugs">Mealybugs</option>
                                      <option value="grape berry moth">Grape berry moth</option>
                                      <option value="scale insects">Scale insects</option>
                                      <option value="cutworms">Cutworms</option>
                                      <option value="japanese beetles">Japanese beetles</option>
                                      <option value="other insect">Other</option>
                                    </optgroup>
                                    <optgroup label="General Scouting">
                                      <option value="general health">General plant health</option>
                                      <option value="nutrient deficiency">Nutrient deficiency</option>
                                      <option value="water stress">Water stress</option>
                                      <option value="frost damage">Frost damage</option>
                                      <option value="wind damage">Wind damage</option>
                                      <option value="bird damage">Bird damage</option>
                                      <option value="wildlife damage">Wildlife damage</option>
                                    </optgroup>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#064e3b' }}>
                                    Severity Level
                                  </label>
                                  <select
                                    value={editActivityForm.scout_severity}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, scout_severity: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #059669',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select severity...</option>
                                    <option value="none">None (0%)</option>
                                    <option value="trace">Trace (&lt;5%)</option>
                                    <option value="light">Light (5-15%)</option>
                                    <option value="moderate">Moderate (15-30%)</option>
                                    <option value="heavy">Heavy (30-50%)</option>
                                    <option value="severe">Severe (&gt;50%)</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#064e3b' }}>
                                    Distribution
                                  </label>
                                  <select
                                    value={editActivityForm.scout_distribution}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, scout_distribution: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #059669',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select distribution...</option>
                                    <option value="isolated">Isolated (few spots)</option>
                                    <option value="scattered">Scattered patches</option>
                                    <option value="widespread">Widespread</option>
                                    <option value="uniform">Uniform throughout</option>
                                    <option value="edge rows">Edge rows only</option>
                                    <option value="wet areas">Wet/low areas</option>
                                    <option value="hilltops">Hilltops/exposed areas</option>
                                    <option value="specific block">Specific block only</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', fontSize: '11px', color: '#064e3b' }}>
                                    Action Needed
                                  </label>
                                  <select
                                    value={editActivityForm.scout_action}
                                    onChange={(e) => setEditActivityForm(prev => ({ ...prev, scout_action: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      border: '1px solid #059669',
                                      borderRadius: '6px',
                                      backgroundColor: 'white',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <option value="">Select action...</option>
                                    <option value="none">None - continue monitoring</option>
                                    <option value="monitor weekly">Monitor weekly</option>
                                    <option value="monitor bi-weekly">Monitor bi-weekly</option>
                                    <option value="treatment required">Treatment required</option>
                                    <option value="spray scheduled">Spray scheduled</option>
                                    <option value="cultural practices">Cultural practices needed</option>
                                    <option value="consult advisor">Consult advisor</option>
                                    <option value="lab analysis">Send for lab analysis</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Location Edit Section */}
                          <div style={{
                            marginBottom: '15px',
                            padding: '12px',
                            backgroundColor: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                              <span style={{ fontSize: '16px' }}>📍</span>
                              <label style={{ fontWeight: '600', fontSize: '14px', color: '#a16207' }}>
                                Event Location
                              </label>
                              <span style={{
                                padding: '1px 6px',
                                backgroundColor: '#fbbf24',
                                color: '#92400e',
                                borderRadius: '10px',
                                fontSize: '10px',
                                fontWeight: '600',
                                textTransform: 'uppercase'
                              }}>
                                Optional
                              </span>
                            </div>

                            {/* Current Location Status */}
                            {editActivityForm.location_lat && editActivityForm.location_lng ? (
                              <div style={{
                                padding: '8px 10px',
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                marginBottom: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}>
                                <div>
                                  <div style={{ fontWeight: '500', color: '#065f46', fontSize: '12px', marginBottom: '1px' }}>
                                    {editActivityForm.location_name || 'Location Set'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#059669' }}>
                                    {editActivityForm.location_lat.toFixed(6)}, {editActivityForm.location_lng.toFixed(6)}
                                    {editActivityForm.location_accuracy && (
                                      <span style={{ marginLeft: '6px' }}>
                                        (±{Math.round(editActivityForm.location_accuracy)}m)
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => setEditActivityForm(prev => ({
                                    ...prev,
                                    location_lat: null,
                                    location_lng: null,
                                    location_accuracy: null,
                                    location_name: ''
                                  }))}
                                  style={{
                                    padding: '3px 6px',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontSize: '10px'
                                  }}
                                >
                                  ✕ Clear
                                </button>
                              </div>
                            ) : (
                              <div style={{
                                padding: '8px 10px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                marginBottom: '8px',
                                textAlign: 'center'
                              }}>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  No location set for this event
                                </div>
                              </div>
                            )}

                            {/* Google Maps Location Search for Edit */}
                            <div style={{ marginBottom: '8px' }}>
                              <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', fontSize: '11px', color: '#374151' }}>
                                🗺️ Search Location (Google Maps):
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  type="text"
                                  value={locationSearch}
                                  onChange={(e) => setLocationSearch(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
                                  placeholder="e.g., Block 5 North, Chardonnay Section..."
                                  style={{
                                    flex: 1,
                                    padding: '5px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '11px'
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={handleLocationSearch}
                                  disabled={isSearching || !locationSearch.trim()}
                                  style={{
                                    padding: '5px 8px',
                                    backgroundColor: isSearching ? '#9ca3af' : '#4285f4',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: isSearching || !locationSearch.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  {isSearching ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={10} />}
                                  Search
                                </button>
                              </div>
                            </div>

                            {/* Search Results for Edit */}
                            {showSearchResults && searchResults.length > 0 && (
                              <div style={{
                                marginBottom: '8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                backgroundColor: 'white',
                                maxHeight: '120px',
                                overflowY: 'auto'
                              }}>
                                <div style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: '500', fontSize: '10px', backgroundColor: '#f9fafb', color: '#374151' }}>
                                  Select Location:
                                </div>
                                {searchResults.map((result, index) => (
                                  <div
                                    key={result.placeId}
                                    onClick={() => {
                                      setEditActivityForm(prev => ({
                                        ...prev,
                                        location_lat: result.latitude,
                                        location_lng: result.longitude,
                                        location_name: result.name,
                                        location_accuracy: null
                                      }));
                                      setLocationSearch('');
                                      setShowSearchResults(false);
                                      setLocationError('');
                                    }}
                                    style={{
                                      padding: '6px 8px',
                                      cursor: 'pointer',
                                      borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                                      fontSize: '10px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                  >
                                    <div style={{ fontWeight: '500', marginBottom: '1px' }}>{result.name}</div>
                                    <div style={{ fontSize: '9px', color: '#6b7280', marginBottom: '1px' }}>
                                      {result.formattedAddress}
                                    </div>
                                    <div style={{ fontSize: '8px', color: '#9ca3af' }}>
                                      {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Location Error Display for Edit */}
                            {locationError && (
                              <div style={{
                                padding: '6px 8px',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '4px',
                                fontSize: '10px',
                                color: '#991b1b',
                                marginBottom: '8px'
                              }}>
                                {locationError}
                              </div>
                            )}

                            {/* Location Action Buttons for Edit */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={async () => {
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

                                    setEditActivityForm(prev => ({
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
                                }}
                                disabled={isGettingLocation}
                                style={{
                                  padding: '8px 10px',
                                  backgroundColor: isGettingLocation ? '#9ca3af' : '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  fontWeight: '500'
                                }}
                              >
                                {isGettingLocation ? (
                                  <>
                                    <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                    Getting GPS...
                                  </>
                                ) : (
                                  <>
                                    📍 Check In Here
                                  </>
                                )}
                              </button>

                              {currentVineyard && (
                                <button
                                  type="button"
                                  onClick={() => setEditActivityForm(prev => ({
                                    ...prev,
                                    location_lat: currentVineyard.latitude,
                                    location_lng: currentVineyard.longitude,
                                    location_accuracy: null,
                                    location_name: `🍇 ${currentVineyard.name}`
                                  }))}
                                  style={{
                                    padding: '8px 10px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    fontWeight: '500'
                                  }}
                                >
                                  🍇 Vineyard Location
                                </button>
                              )}
                            </div>
                          </div>

                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '12px', color: '#374151' }}>
                              Notes (Optional)
                            </label>
                            <textarea
                              value={editActivityForm.notes}
                              onChange={(e) => setEditActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Add any additional details about this event..."
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                minHeight: '60px',
                                resize: 'vertical',
                                fontSize: '13px'
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => updateActivity(activity.id)}
                              disabled={isUpdatingActivity || !editActivityForm.activity_type || !editActivityForm.start_date}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: isUpdatingActivity || !editActivityForm.activity_type || !editActivityForm.start_date ? '#9ca3af' :'#22c55e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isUpdatingActivity || !editActivityForm.activity_type || !editActivityForm.start_date ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: '500'
                              }}
                            >
                              {isUpdatingActivity ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : '💾'}
                              {isUpdatingActivity ? 'Updating...' : 'Save Changes'}
                            </button>

                            <button
                              onClick={cancelEditingActivity}
                              disabled={isUpdatingActivity}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isUpdatingActivity ? 'not-allowed' : 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Normal display
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <div
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  backgroundColor: style.color,
                                  borderRadius: '50%'
                                }}
                              ></div>
                              <span style={{ fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                                {style.emoji} {style.label}
                              </span>
                              <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>
                                {new Date(activity.event_date).toLocaleDateString()}
                              </span>
                            </div>

                            {/* Block Information */}
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#374151',
                                backgroundColor: '#f3f4f6',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginRight: '6px'
                              }}>
                                📍 Blocks:
                              </span>
                              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                {blockNames}
                              </span>
                            </div>

                            {activity.end_date && (
                              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                                Duration: {activity.event_date} to {activity.end_date}
                              </div>
                            )}

                            {activity.harvest_block && (
                              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                                Block: {activity.harvest_block}
                              </div>
                            )}

                            {/* Location Status */}
                            {(activity.location_lat && activity.location_lng) ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <div style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  📍
                                  {activity.location_name ? (
                                    <span>{activity.location_name}</span>
                                  ) : (
                                    <span>{activity.location_lat.toFixed(4)}, {activity.location_lng.toFixed(4)}</span>
                                  )}
                                  {activity.location_accuracy && (
                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                      (±{Math.round(activity.location_accuracy)}m)
                                    </span>
                                  )}
                                </div>
                                <a
                                  href={`https://www.google.com/maps?q=${activity.location_lat},${activity.location_lng}&z=18`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '2px 6px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    fontWeight: '500'
                                  }}
                                  title="View location on Google Maps"
                                >
                                  🗺️ Map
                                </a>
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ⚠️ No location recorded
                              </div>
                            )}

                            {/* Spray Application Details */}
                            {activity.event_type === 'spray_application' && activity.spray_product && (
                              <div style={{
                                margin: '8px 0',
                                padding: '10px',
                                backgroundColor: '#fef3c7',
                                border: '1px solid #fbbf24',
                                borderRadius: '6px'
                              }}>
                                <div style={{
                                  fontWeight: '600',
                                  fontSize: '13px',
                                  color: '#92400e',
                                  marginBottom: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  🌿 Spray Application Details
                                  {(() => {
                                    const productInfo = sprayDatabase[activity.spray_product as keyof typeof sprayDatabase];
                                    if (productInfo) {
                                      const sprayDate = new Date(activity.event_date);
                                      const today = new Date();
                                      const hoursSinceSpray = Math.floor((today.getTime() - sprayDate.getTime()) / (1000 * 60 * 60));

                                      if (hoursSinceSpray < productInfo.reentryHours) {
                                        return (
                                          <span style={{
                                            padding: '2px 6px',
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            borderRadius: '10px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase'
                                          }}>
                                            RE-ENTRY ACTIVE
                                          </span>
                                        );
                                      }
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div style={{ fontSize: '12px', color: '#78350f' }}>
                                  <div style={{ marginBottom: '3px' }}>
                                    <strong>Product:</strong> {activity.spray_product}
                                    {activity.spray_quantity && activity.spray_unit && (
                                      <span> • <strong>Rate:</strong> {activity.spray_quantity} {activity.spray_unit}</span>
                                    )}
                                  </div>
                                  {activity.spray_target && (
                                    <div style={{ marginBottom: '3px' }}>
                                      <strong>Target:</strong> {activity.spray_target}
                                    </div>
                                  )}
                                  {activity.spray_equipment && (
                                    <div style={{ marginBottom: '3px' }}>
                                      <strong>Equipment:</strong> {activity.spray_equipment}
                                    </div>
                                  )}
                                  {(() => {
                                    const productInfo = sprayDatabase[activity.spray_product as keyof typeof sprayDatabase];
                                    if (productInfo) {
                                      return (
                                        <div style={{
                                          marginTop: '6px',
                                          padding: '4px 6px',
                                          backgroundColor: '#fecaca',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          color: '#991b1b'
                                        }}>
                                          <strong>Safety:</strong> {productInfo.reentryHours}h re-entry, {productInfo.preharvestDays}d pre-harvest
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            )}

                            {activity.notes && (
                              <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.4' }}>
                                {activity.notes}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '15px', gap: '6px' }}>
                            {activity.created_at && (
                              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                Logged: {new Date(activity.created_at).toLocaleDateString()}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '6px' }}>
                              {/* Edit button */}
                              <button
                                onClick={() => startEditingActivity(activity)}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#f59e0b',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s ease',
                                  fontWeight: '500'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
                                title={`Edit this ${style.label} event`}
                              >
                                ✏️ Edit
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => deleteActivity(activity.id, style.label)}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                                title={`Delete this ${style.label} event`}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Generate AI Insights Button */}
      {data.length > 0 && !isGeneratingInsights && (
        <div style={{
          marginTop: '30px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <button
            onClick={generateAIInsights}
            disabled={!process.env.NEXT_PUBLIC_OPENAI_API_KEY}
            style={{
              padding: '12px 24px',
              backgroundColor: !process.env.NEXT_PUBLIC_OPENAI_API_KEY ? '#9ca3af' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: !process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto'
            }}
          >
            <Brain size={20} />
            {!process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'AI Insights (API Key Required)' : 'AI Insights (BETA)'}
          </button>
          {!process.env.NEXT_PUBLIC_OPENAI_API_KEY && (
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
              Add NEXT_PUBLIC_OPENAI_API_KEY to enable AI features
            </p>
          )}
        </div>
      )}

      {/* AI Insights Panel - Moved to Bottom */}
      {showAIPanel && (
        <div style={{
          marginTop: '20px',
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: '#fefce8',
          borderRadius: '12px',
          border: '1px solid #fde68a'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: '0', fontSize: '18px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain size={20} />
              AI Vineyard Insights
            </h3>
            {isGeneratingInsights ? (
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: '#92400e' }} />
            ) : (
              <button
                onClick={generateAIInsights}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#eab308',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={12} />
                Refresh Insights
              </button>
            )}
          </div>

          {isGeneratingInsights ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ marginBottom: '10px' }}>🤖 AI is analyzing your vineyard data...</div>
              <div style={{ fontSize: '14px', color: '#92400e' }}>
                This may take a few seconds
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* AI Recommendations - Harvest Focused */}
              {aiInsights.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🍇 Recommendations
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {aiInsights
                      .sort((a, b) => {
                        // Sort by urgency, then by type priority
                        const urgencyOrder = { high: 3, medium: 2, low: 1 };
                        const typeOrder = { harvest_timing: 4, action_required: 3, opportunity: 2, monitor: 1 };

                        const urgencyDiff = (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 1) -
                                          (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 1);
                        if (urgencyDiff !== 0) return urgencyDiff;

                        return (typeOrder[b.type as keyof typeof typeOrder] || 1) -
                               (typeOrder[a.type as keyof typeof typeOrder] || 1);
                      })
                      .map((insight) => {
                        const colors = getInsightColor(insight.type);
                        const urgencyStyle = getUrgencyStyle(insight.urgency);

                        return (
                          <div
                            key={insight.id}
                            style={{
                              padding: '16px',
                              backgroundColor: colors.bg,
                              border: urgencyStyle.border,
                              borderRadius: '8px',
                              position: 'relative'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ marginTop: '2px' }}>
                                {getInsightIcon(insight.type)}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                  <div style={{ fontWeight: '600', fontSize: '15px', color: colors.text }}>
                                    {insight.title}
                                  </div>
                                  <div style={{
                                    ...urgencyStyle.badge,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    textTransform: 'uppercase'
                                  }}>
                                    {insight.urgency}
                                  </div>
                                  {insight.daysToAction && (
                                    <div style={{
                                      padding: '2px 8px',
                                      backgroundColor: '#f3f4f6',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      color: '#374151',
                                      fontWeight: '500'
                                    }}>
                                      {insight.daysToAction} days
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontSize: '14px', color: colors.text, lineHeight: '1.4', marginBottom: '6px' }}>
                                  {insight.message}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>📊 {(insight.confidence * 100).toFixed(0)}% confidence</span>
                                  <span>•</span>
                                  <span style={{ textTransform: 'capitalize' }}>{insight.category}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Additional Analysis Sections */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                {/* Weather Analysis */}
                {weatherAnalysis && (
                  <div>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🌤️ Weather Impact on Harvest
                    </h4>
                    <div style={{
                      padding: '14px',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: '#0c4a6e'
                    }}>
                      {weatherAnalysis}
                    </div>
                  </div>
                )}

                {/* Phenology Analysis */}
                {phenologyAnalysis && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📈 Development & Timing
                    </h4>
                    <div style={{
                      padding: '14px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: '#065f46'
                    }}>
                      {phenologyAnalysis}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reports Modal */}
      {showReportsModal && currentVineyard && (
        <ReportsModal
          isOpen={showReportsModal}
          onClose={() => setShowReportsModal(false)}
          reportData={{
            vineyard: currentVineyard,
            phenologyEvents: activities,
            weatherData: data,
            dateRange: dateRange
          }}
        />
      )}
    </div>
  );
}