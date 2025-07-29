// components/WeatherDashboard.tsx - COMPLETE Fixed Version with All Features

import React, { useState, useEffect } from 'react';
import { useWeather, useWeatherConnection } from '../hooks/useWeather';
import { EnhancedGDDChart } from './EnhancedGDDChart';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';
import { openaiService, VineyardContext, AIInsight } from '../lib/openaiService';
import { supabase } from '../lib/supabase'; // Added for user authentication
import { AlertCircle, RefreshCw, MapPin, Calendar, Thermometer, CloudRain, TrendingUp, Search, Brain, Lightbulb, AlertTriangle, CheckCircle, Info } from 'lucide-react';

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
  const [isSearching, setIsSearching] = useState(isSearching);
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

  const { data, loading, error, lastUpdated, refetch, retry, clearError } = useWeather(weatherOptions);

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
        refetch();
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
        refetch();
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
        refetch();
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
      refetch();
    }
  }, [isInitialized, dateRange.start, dateRange.end, latitude, longitude, refetch]);

  // Remove auto-generation of AI insights - only generate when button is clicked

  // Load activities for current vineyard
  const loadActivities = async () => {
    if (!vineyardId) return;

    setIsLoadingActivities(true);
    try {
      console.log('📋 Loading activities for vineyard:', vineyardId);

      const { data, error } = await supabase
        .from('phenology_events')
        .select('*')
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

    setIsSavingActivity(true);
    try {
      console.log('💾 Saving activity:', activityForm);

      const { savePhenologyEvent } = await import('../lib/supabase');

      const locationData = (activityForm.location_lat && activityForm.location_lng) ? {
        latitude: activityForm.location_lat,
        longitude: activityForm.location_lng,
        locationName: activityForm.location_name,
        accuracy: activityForm.location_accuracy || undefined
      } : undefined;

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
          block: activityForm.harvest_block
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
        vineyardId,
        activityForm.activity_type.toLowerCase().replace(' ', '_'),
        activityForm.start_date,
        activityForm.notes,
        activityForm.end_date || undefined,
        activityForm.harvest_block || undefined, // harvestBlock for harvest events
        locationData,
        sprayData,
        irrigationData,
        fertilizationData,
        harvestData,
        canopyData,
        scoutData
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
  };

  // Update an activity
  const updateActivity = async (activityId: string) => {
    if (!vineyardId || !editActivityForm.activity_type || !editActivityForm.start_date) {
      alert('Please fill in activity type and start date');
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
        harvest_block: editActivityForm.harvest_block || null
      };

      // Add location data if provided
      if (editActivityForm.location_lat && editActivityForm.location_lng) {
        updateData.location_lat = editActivityForm.location_lat;
        updateData.location_lng = editActivityForm.location_lng;
        updateData.location_name = editActivityForm.location_name;
        updateData.location_accuracy = editActivityForm.location_accuracy;
      }

      // Add event-type specific data
      if (editActivityForm.activity_type === 'Spray Application') {
        updateData.spray_product = editActivityForm.spray_product || null;
        updateData.spray_quantity = editActivityForm.spray_quantity || null;
        updateData.spray_unit = editActivityForm.spray_unit || null;
        updateData.spray_target = editActivityForm.spray_target || null;
        updateData.spray_conditions = editActivityForm.spray_conditions || null;
        updateData.spray_equipment = editActivityForm.spray_equipment || null;
      }

      if (editActivityForm.activity_type === 'Irrigation') {
        updateData.irrigation_amount = editActivityForm.irrigation_amount || null;
        updateData.irrigation_unit = editActivityForm.irrigation_unit || null;
        updateData.irrigation_method = editActivityForm.irrigation_method || null;
        updateData.irrigation_duration = editActivityForm.irrigation_duration || null;
      }

      if (editActivityForm.activity_type === 'Fertilization') {
        updateData.fertilizer_type = editActivityForm.fertilizer_type || null;
        updateData.fertilizer_npk = editActivityForm.fertilizer_npk || null;
        updateData.fertilizer_rate = editActivityForm.fertilizer_rate || null;
        updateData.fertilizer_unit = editActivityForm.fertilizer_unit || null;
        updateData.fertilizer_method = editActivityForm.fertilizer_method || null;
      }

      if (editActivityForm.activity_type === 'Harvest') {
        updateData.harvest_yield = editActivityForm.harvest_yield || null;
        updateData.harvest_unit = editActivityForm.harvest_unit || null;
        updateData.harvest_brix = editActivityForm.harvest_brix || null;
        updateData.harvest_ph = editActivityForm.harvest_ph || null;
        updateData.harvest_ta = editActivityForm.harvest_ta || null;
        updateData.harvest_block = editActivityForm.harvest_block || null;
      }

      if (editActivityForm.activity_type === 'Canopy Management') {
        updateData.canopy_activity = editActivityForm.canopy_activity || null;
        updateData.canopy_intensity = editActivityForm.canopy_intensity || null;
        updateData.canopy_side = editActivityForm.canopy_side || null;
        updateData.canopy_stage = editActivityForm.canopy_stage || null;
      }

      if (editActivityForm.activity_type === 'Scouting' || editActivityForm.activity_type === 'Pest') {
        updateData.scout_focus = editActivityForm.scout_focus || null;
        updateData.scout_severity = editActivityForm.scout_severity || null;
        updateData.scout_distribution = editActivityForm.scout_distribution || null;
        updateData.scout_action = editActivityForm.scout_action || null;
      }

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
      const avgTempHigh = data.reduce((sum, day) => sum + day.temp_high, 0) / data.length;
      const avgTempLow = data.reduce((sum, day) => sum + day.temp_low, 0) / data.length;

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
      refetch();
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
      refetch();
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
    
        
          
        
    
    <div 
        className="mobile-safe-area"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          padding: '1rem'
        }}>
      
      
        
          
            
                
                    
                
                
                    
                
            
        
      
        
        
          
            
              
                
                
                  
                    🍇 My Vineyards
                  
                
                
                  
                    ➕ Add Vineyard
                  
                
              
            
        

            
              
                
                  
                    
                      🆕 Add New Vineyard
                    
                    
                      Enter location details to create a new vineyard.
                    
                  
                  
                    ✕
                  
                

                
                  
                    Search for Location (Google Maps):
                  
                  
                    
                      
                        
                      
                      
                        Search
                      
                    
                  
                

                
                  
                    
                      Select Location:
                    
                    
                      
                        
                          
                            
                              {result.name}
                            
                            
                              {result.formattedAddress}
                            
                            
                              {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                            
                          
                        
                      
                    
                  
                

                
                  
                    Recent Locations:
                  
                  
                    
                      
                        {location.name}
                      
                    
                  
                

                
                  
                    Vineyard Name:
                  
                  
                

                
                  
                    
                      
                        
                          Latitude:
                        
                        
                      
                    
                    
                      
                        
                          Longitude:
                        
                        
                      
                    
                  
                

                
                  
                    
                      ✨ Create Vineyard
                    
                    Cancel
                  
                
              
            
        

        
              
                
                  
                    
                      📍 Edit Vineyard Location
                    
                    
                      Update the location details for this vineyard.
                    
                  
                  
                    ✕
                  
                

                
                  
                    Search for New Location (Google Maps):
                  
                  
                    
                      
                        
                      
                      
                        Search
                      
                    
                  
                

                
                  
                    
                      Select New Location:
                    
                    
                      
                        
                          
                            
                              {result.name}
                            
                            
                              {result.formattedAddress}
                            
                            
                              {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                            
                          
                        
                      
                    
                  
                

                
                  
                    Vineyard Name:
                  
                  
                

                
                  
                    
                      
                        
                          Latitude:
                        
                        
                      
                    
                    
                      
                        
                          Longitude:
                        
                        
                      
                    
                  
                

                
                  
                    
                      📍 Update Location
                    
                    Cancel
                  
                
              
            
        

        
          
            
              
                
                  
                    
                      
                        
                          
                            {editingVineyardId === vineyard.id ? (
                              
                                
                              
                            ) : (
                              
                                📍 {vineyard.name}
                              
                            )}

                            
                              
                                ✓ Save
                                ✕ Cancel
                              
                            ) : (
                              
                                ✏️ Rename
                                📍 Location
                                🗑️ Delete
                              
                            )}
                          
                        
                        
                    
                  
                
              
            
          
         : (
          
            
              
            
            
              No Vineyards Yet
            
            
              Create your first vineyard to start tracking weather data and phenology events.
            
            
              
                ➕ Create First Vineyard
              
            
          
        )}

        
          📊 {userVineyards.length === 0 ? 'No vineyards configured' : 
                 `${userVineyards.length} vineyard${userVineyards.length !== 1 ? 's' : ''} configured`}
        
      

      
        
          
            
              
                
                
                  
                
                
                  Weather API Connected
                
              
            
              
                
                
                  
                  Weather API Connection Failed
                  
                  Retry Connection
                
              
            
              
                
                
                  Checking connection...
                
              
            
          
        
      

      

      
        
          
            
              
                
                  
                    
                    
                      Date Range Settings
                    
                  
                

                
                  
                    
                      {currentYear} Growing Season (Apr 1 - Today)
                    
                  

                  
                    
                      {previousYear} Growing Season (Apr 1 - Oct 31)
                    
                  

                  
                    
                      Custom Date Range
                    
                  
                

                
                  
                    
                      
                        Start Date:
                      
                      
                    
                    
                      
                        End Date:
                      
                      
                    
                    
                      
                        
                          Update Range
                        
                      
                    
                  
                

                
                  
                    Current Range:
                     to {dateRange.end}
                     ({Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24))} days)
                  
                
              
            
        

        
          
            
              Weather Data Error ({error.code})
            
            
              {error.message}
            
            
              
                Retry
                Dismiss
              
            
          
        
      

      
        
          
            
              
                
                
                  
                    Total GDD
                  
                
                
                  {Math.round(totalGDD)} GDDs
                
                
                  {data.length} days
                
              
            
            
              
                
                
                  
                    Total Rainfall
                  
                
                
                  {totalRainfall.toFixed(2)}"
                
                
                  Precipitation
                
              
            
            
              
                
                
                  
                    Avg High Temp
                  
                
                
                  {avgTempHigh.toFixed(1)}°F
                
                
                  Daily average
                
              
            
            
              
                
                
                  
                    Avg Low Temp
                  
                
                
                  {avgTempLow.toFixed(1)}°F
                
                
                  Daily average
                
              
            
          
        

        
          
            
              
                Loading Weather Data
              
              
                Fetching weather data for {customLocation}...
              
            
          
        

        
          
        
      

      
        
          Last updated: {lastUpdated.toLocaleString()}
          
          {data.length} data points loaded
          
          
            
              Period: {dateRange.start} to {dateRange.end}
            
          
        
      

      

      
        
          
            
              
                🌱 Event Log
              
              
                {activities.length} total events
                 •
                 {eventsWithLocation.length} with location
                 •
                 {eventsWithoutLocation.length} missing location
              
            
            
              
                
                  
                    🗺️ {filteredEventsWithLocation.length === 1 ? 'View' : 'Route All'} ({filteredEventsWithLocation.length})
                  
                

                
                  
                    🔍 {eventFilterTypes.length > 0 ? `${eventFilterTypes.length} filtered` : 'All'}
                  
                

                
                  
                    
                      Filter events by type:
                    
                    
                      Show All Events
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
                          
                            
                              
                            
                            {style.emoji} {style.label}
                             ✓
                          
                        );
                      })}
                    
                  
                
              
            
          

          
            
              ➕ Add Event
            
          

          
            
              
                
                  
                    ➕ Add New Event
                  
                  
                    ✕
                  
                

                
                  
                    Event Type *
                  
                  
                    
                      Select event type...
                      {activityTypes.map(type => (
                        {type}
                      ))}
                    
                  
                

                
                  
                    Date *
                  
                  
                

                
                  
                    End Date (Optional)
                  
                  
                
              

              

              
                
                  
                    
                      💧
                      Irrigation Details
                    
                  

                  
                    
                      
                        
                          Water Amount
                        
                        
                      
                      
                        
                          Unit
                        
                        
                          inches
                          gallons/acre
                          hours
                          mm
                          liters/hectare
                          minutes
                          total gallons
                        
                      
                    
                    
                      
                        
                          Method
                        
                        
                          Select method...
                          drip
                          sprinkler
                          flood
                          micro-sprinkler
                          furrow
                          overhead
                          hand watering
                        
                      
                    
                    
                      
                        
                          Duration
                        
                        
                      
                    
                  
                
              

              
                
                  
                    
                      🌱
                      Fertilization Details
                    
                  

                  
                    
                      
                        
                          Fertilizer Type
                        
                        
                          Select type...
                          granular NPK
                          liquid fertilizer
                          compost
                          manure
                          bone meal
                          fish emulsion
                          calcium sulfate
                          potassium sulfate
                          urea
                          ammonium sulfate
                          organic blend
                        
                      
                    
                    
                      
                        
                          N-P-K Ratio
                        
                        
                      
                    
                    
                      
                        
                          Application Rate
                        
                        
                      
                    
                    
                      
                        
                          Unit
                        
                        
                          lbs/acre
                          kg/hectare
                          tons/acre
                          gal/acre
                          L/hectare
                          cubic yards
                          total lbs
                        
                      
                    
                    
                      
                        
                          Application Method
                        
                        
                          Select method...
                          broadcast
                          banded application
                          foliar spray
                          fertigation
                          side-dress
                          topdress
                          soil incorporation
                        
                      
                    
                  
                
              

              
                
                  
                    
                      🍷
                      Harvest Details
                    
                  

                  
                    
                      
                        
                          Yield
                        
                        
                      
                    
                    
                      
                        
                          Unit
                        
                        
                          tons/acre
                          tonnes/hectare
                          lbs/vine
                          kg/vine
                          total tons
                          total lbs
                          bins
                          cases
                        
                      
                    
                    
                      
                        
                          Brix (°Bx)
                        
                        
                      
                    
                    
                      
                        
                          pH
                        
                        
                      
                    
                    
                      
                        
                          TA (g/L)
                        
                        
                      
                    
                    
                      
                        
                          Block/Variety
                        
                        
                      
                    
                  
                
              

              
                
                  
                    
                      🍃
                      Canopy Management Details
                    
                  

                  
                    
                      
                        
                          Activity Type
                        
                        
                          Select activity...
                          shoot thinning
                          leaf removal
                          cluster thinning
                          hedging
                          positioning
                          topping
                          suckering
                          lateral removal
                          tying
                        
                      
                    
                    
                      
                        
                          Intensity
                        
                        
                          Select intensity...
                          light
                          moderate
                          heavy
                          selective
                          complete
                        
                      
                    
                    
                      
                        
                          Side/Location
                        
                        
                          Select side...
                          both sides
                          east side
                          west side
                          morning sun
                          afternoon sun
                          fruit zone
                          upper canopy
                          basal leaves
                        
                      
                    
                    
                      
                        
                          Growth Stage
                        
                        
                          Select stage...
                          pre-bloom
                          bloom
                          post-bloom
                          fruit set
                          lag phase
                          veraison
                          pre-harvest
                          post-harvest
                        
                      
                    
                  
                
              

              
                
                  
                    {activityForm.activity_type === 'Pest' ? '🐞' : '🔍'}
                    {activityForm.activity_type === 'Pest' ? 'Pest Observation' : 'Scouting'} Details
                  

                  
                    
                      
                        Focus/Pest Type
                        
                        
                          Select focus...
                          Diseases
                            powdery mildew
                            downy mildew
                            botrytis
                            black rot
                            phomopsis
                            crown gall
                            esca
                            eutypa
                            other disease
                          Insect Pests
                            spider mites
                            thrips
                            leafhoppers
                            aphids
                            mealybugs
                            grape berry moth
                            scale insects
                            cutworms
                            japanese beetles
                            other insect
                          General Scouting
                            general health
                            nutrient deficiency
                            water stress
                            frost damage
                            wind damage
                            bird damage
                            wildlife damage
                        
                      
                    
                    
                      
                        Severity Level
                        
                        
                          Select severity...
                          none
                          trace
                          light
                          moderate
                          heavy
                          severe
                        
                      
                    
                    
                      
                        Distribution
                        
                        
                          Select distribution...
                          isolated
                          scattered
                          widespread
                          uniform
                          edge rows
                          wet areas
                          hilltops
                          specific block
                        
                      
                    
                    
                      
                        Action Needed
                        
                        
                          Select action...
                          none
                          monitor weekly
                          monitor bi-weekly
                          treatment required
                          spray scheduled
                          cultural practices
                          consult advisor
                          lab analysis
                        
                      
                    
                  
                
              

              
                
                  
                    🌿
                    Spray Application Details
                  

                  
                    
                      
                        Product Name *
                        
                        
                          Select product...
                          Fungicides
                            Captan
                            Copper Sulfate
                            Sulfur
                            Mancozeb
                            Chlorothalonil
                            Propiconazole
                            Myclobutanil
                            Tebuconazole
                          Insecticides
                            Imidacloprid
                            Spinosad
                            Carbaryl
                            Malathion
                            Bt (Bacillus thuringiensis)
                          Herbicides
                            Glyphosate
                            Roundup
                            2,4-D
                            Dicamba
                            Paraquat
                          Organic/Biological
                            Neem Oil
                            Horticultural Oil
                            Kaolin Clay
                          Other
                      
                    
                    
                      
                        Quantity
                        
                        
                      
                    
                    
                      
                        Unit
                        
                        
                          oz/acre
                          lb/acre
                          gal/acre
                          ml/acre
                          kg/ha
                          L/ha
                          total gallons
                          total liters
                        
                      
                    
                  

                  
                    

                      ⚠️
                      SAFETY INFORMATION
                    

                    
                      
                        
                          Re-entry Interval:
                           hours
                        
                        
                          Pre-harvest Interval:
                           days
                        
                        
                          Category:
                           | Signal Word:
                        
                        
                          Always follow label instructions and local regulations
                        
                      
                    
                  

                  
                    
                      
                        Target Pest/Disease
                        
                        
                      
                    
                    
                      
                        Equipment Used
                        
                        
                      
                    
                  

                  
                    
                      Weather Conditions
                    
                    
                  

                  
                    
                      
                        Safety Data Sources:
                         EPA pesticide labels, University extension publications, industry standard practices. 
                        Always verify with current product labels and local regulations before application.
                      
                    
                  
                
              

              
                
                  
                    Notes (Optional)
                  
                  
                
              

              
                
                  
                    📍
                     Location (Optional)
                  

                  {activityForm.location_lat && activityForm.location_lng ? (
                    
                      
                        📍 {activityForm.location_name || 'Location set'}
                      
                      
                        Clear
                      
                    
                  ) : (
                    
                      No location set
                    
                  )}

                
                  
                    
                      
                        {isGettingLocation ? (
                          
                            
                              
                            
                            Getting...
                          
                        ) : (
                          
                            📍 Check In Here
                          
                        )}
                      

                      {currentVineyard && (
                        
                          🍇 Vineyard Location
                        
                      )}
                    
                  
                
              

              
                
                  
                    
                      {isSavingActivity ?   Saving...' : 'Save Event'}
                    
                    Cancel
                  
                
              
            
          

          
            
              
                
                  
                    📅 Event History
                  
                  
                    
                      
                        
                         Refresh
                      
                    
                  
                

                {isLoadingActivities ? (
                  
                    
                      
                    
                    
                      Loading events...
                    
                  
                ) : activities.length === 0 ? (
                  
                    
                      
                    
                    
                      No Events Logged
                    
                    
                      Start logging your vineyard events to track phenology and activities throughout the season.
                    
                  
                ) : (
                  
                    {activities.filter(activity => {
                      
                      if (eventFilterTypes.length === 0) return true;
                      const eventType = activity.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';
                      return eventFilterTypes.includes(eventType);
                    }).map((activity, index) => {
                      
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

                      
                      let eventType = activity.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';

                      
                      if (eventType === 'pest_observation') eventType = 'pest';
                      if (eventType === 'scouting_activity') eventType = 'scouting';

                      const style = eventStyles[eventType] || eventStyles.other;

                      
                      const gddAtEvent = data.find(d => d.date === activity.event_date)?.gdd || 0;
                      const cumulativeGDD = data.filter(d => d.date <= activity.event_date).reduce((sum, d) => sum + d.gdd, 0);

                      
                      const isBeingEdited = editingActivityId === activity.id;

                      return (
                        
                          {isBeingEdited ? (
                            
                              
                                
                                  
                                  
                                  
                                  ✕
                                
                              

                              
                                
                                  
                                  
                                  
                                  
                                    Select event type...
                                    {activityTypes.map(type => (
                                      {type}
                                    ))}
                                  
                                
                              

                              
                                
                                  
                                  
                                
                              

                              
                                
                                  
                                  
                                
                              
                            

                            

                            
                              
                                🌿
                                Spray Application Details
                              
                            

                            
                              
                                
                                  
                                    Product Name *
                                  
                                  
                                    Select product...
                                    
                                      Captan
                                      Copper Sulfate
                                      Sulfur
                                      Mancozeb
                                      Chlorothalonil
                                      Propiconazole
                                      Myclobutanil
                                      Tebuconazole
                                    
                                    
                                      Imidacloprid
                                      Spinosad
                                      Carbaryl
                                      Malathion
                                      Bt (Bacillus thuringiensis)
                                    
                                    
                                      Glyphosate
                                      Roundup
                                      2,4-D
                                      Dicamba
                                      Paraquat
                                    
                                    
                                      Neem Oil
                                      Horticultural Oil
                                      Kaolin Clay
                                    
                                    Other
                                  
                                

                                
                                  
                                    Quantity
                                  
                                  
                                

                                
                                  
                                    Unit
                                  
                                  
                                    oz/acre
                                    lb/acre
                                    gal/acre
                                    ml/acre
                                    kg/ha
                                    L/ha
                                    total gallons
                                    total liters
                                  
                                
                              

                              
                                

                                  
                                    ⚠️
                                    SAFETY INFORMATION
                                  
                                

                                
                                  
                                    
                                      Re-entry Interval:
                                       hours
                                    
                                    
                                      Pre-harvest Interval:
                                       days
                                    
                                    
                                      Category:
                                       | Signal Word:
                                    
                                    
                                      Always follow label instructions and local regulations
                                    
                                  
                                

                                
                                  
                                    Target Pest/Disease
                                  
                                  
                                

                                
                                  
                                    Equipment Used
                                  
                                  
                                

                                
                                  
                                    Weather Conditions
                                  
                                  
                                
                              
                            
                          

                          
                            
                              💧
                              Irrigation Details
                            
                          

                          
                            
                              
                                Water Amount
                              
                              
                            

                            
                              
                                Unit
                              
                              
                                inches
                                gallons/acre
                                hours
                                mm
                                liters/hectare
                                minutes
                                total gallons
                              
                            

                            
                              
                                Method
                              
                              
                                Select method...
                                drip
                                sprinkler
                                flood
                                micro-sprinkler
                                furrow
                                overhead
                                hand watering
                              
                            

                            
                              
                                Duration
                              
                              
                            
                          
                        
                      

                      
                        
                          🌱
                          Fertilization Details
                        
                      

                      
                        
                          
                            Fertilizer Type
                          
                          
                            Select type...
                            granular NPK
                            liquid fertilizer
                            compost
                            manure
                            bone meal
                            fish emulsion
                            calcium sulfate
                            potassium sulfate
                            urea
                            ammonium sulfate
                            organic blend
                          
                        
                      

                      
                        
                          N-P-K Ratio
                        
                        
                      

                      
                        
                          Application Rate
                        
                        
                      

                      
                        
                          Unit
                        
                        
                          lbs/acre
                          kg/hectare
                          tons/acre
                          gal/acre
                          L/hectare
                          cubic yards
                          total lbs
                        
                      

                      
                        
                          Application Method
                        
                        
                          Select method...
                          broadcast
                          banded application
                          foliar spray
                          fertigation
                          side-dress
                          topdress
                          soil incorporation
                        
                      
                    
                  

                  
                    
                      🍷
                      Harvest Details
                    
                  

                  
                    
                      
                        Yield
                        
                        
                      

                      
                        
                          Unit
                        
                        
                          tons/acre
                          tonnes/hectare
                          lbs/vine
                          kg/vine
                          total tons
                          total lbs
                          bins
                          cases
                        
                      

                      
                        
                          Brix (°Bx)
                        
                        
                      

                      
                        
                          pH
                        
                        
                      

                      
                        
                          TA (g/L)
                        
                        
                      

                      
                        
                          Block/Variety
                        
                        
                      
                    
                  

                  
                    
                      🍃
                      Canopy Management Details
                    
                  

                  
                    
                      
                        Activity Type
                        
                        
                          Select activity...
                          shoot thinning
                          leaf removal
                          cluster thinning
                          hedging
                          positioning
                          topping
                          suckering
                          lateral removal
                          tying
                        
                      
                    

                    
                      
                        Intensity
                        
                        
                          Select intensity...
                          light
                          moderate
                          heavy
                          selective
                          complete
                        
                      
                    

                    
                      
                        Side/Location
                        
                        
                          Select side...
                          both sides
                          east side
                          west side
                          morning sun
                          afternoon sun
                          fruit zone
                          upper canopy
                          basal leaves
                        
                      
                    

                    
                      
                        Growth Stage
                        
                        
                          Select stage...
                          pre-bloom
                          bloom
                          post-bloom
                          fruit set
                          lag phase
                          veraison
                          pre-harvest
                          post-harvest
                        
                      
                    
                  

                  
                    
                      {editActivityForm.activity_type === 'Pest' ? '🐞' : '🔍'}
                      {editActivityForm.activity_type === 'Pest' ? 'Pest Observation' : 'Scouting'} Details
                    
                  

                  
                    
                      
                        Focus/Pest Type
                        
                        
                          Select focus...
                          Diseases
                            powdery mildew
                            downy mildew
                            botrytis
                            black rot
                            phomopsis
                            crown gall
                            esca
                            eutypa
                            other disease
                          Insect Pests
                            spider mites
                            thrips
                            leafhoppers
                            aphids
                            mealybugs
                            grape berry moth
                            scale insects
                            cutworms
                            japanese beetles
                            other insect
                          General Scouting
                            general health
                            nutrient deficiency
                            water stress
                            frost damage
                            wind damage
                            bird damage
                            wildlife damage
                        
                      
                    
                    
                      
                        Severity Level
                        
                        
                          Select severity...
                          none
                          trace
                          light
                          moderate
                          heavy
                          severe
                        
                      
                    

                    
                      
                        Distribution
                        
                        
                          Select distribution...
                          isolated
                          scattered
                          widespread
                          uniform
                          edge rows
                          wet areas
                          hilltops
                          specific block
                        
                      
                    

                    
                      
                        Action Needed
                        
                        
                          Select action...
                          none
                          monitor weekly
                          monitor bi-weekly
                          treatment required
                          spray scheduled
                          cultural practices
                          consult advisor
                          lab analysis
                        
                      
                    
                  

                  
                    📍
                     Event Location
                      Optional
                    

                    
                      {editActivityForm.location_lat && editActivityForm.location_lng ? (
                        
                          
                            {editActivityForm.location_name || 'Location Set'}
                          
                          
                            ✕ Clear
                          
                        
                      ) : (
                        
                          No location set for this event
                        
                      )}

                    
                      
                        
                          🗺️ Search Location (Google Maps):
                        
                        
                          
                            
                          
                          
                            Search
                          
                        
                      
                    

                    
                      
                        Select Location:
                      
                      
                        
                          
                            
                              {result.name}
                            
                            
                              {result.formattedAddress}
                            
                            
                              {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                            
                          
                        
                      
                    

                    
                      
                        {locationError}
                      
                    

                    
                      
                        
                          
                            
                              
                                
                                  
                                    
                                      Getting GPS...
                                    
                                  
                                  📍 Check In Here
                                
                              

                              {currentVineyard && (
                                
                                  🍇 Use Vineyard Location
                                
                              )}
                            
                          
                        
                      
                    
                  

                  
                    
                      Notes (Optional)
                    
                    
                  

                  
                    
                      {isUpdatingActivity || !editActivityForm.activity_type || !editActivityForm.start_date ? 'Updating...' : 'Save Changes'}
                    
                    Cancel
                  
                
              
            ) : (
              
                
                  
                    
                      
                        
                          
                        
                        
                          {style.emoji}
                          
                            {style.label}
                          
                           
                          
                          {new Date(activity.event_date).toLocaleDateString()}
                          {cumulativeGDD > 0 && (
                            
                              {Math.round(cumulativeGDD)} GDDs
                            
                          )}
                        
                        {activity.end_date && (
                          
                            Duration: {activity.event_date} to {activity.end_date}
                          
                        )}

                        {activity.harvest_block && (
                          
                            Block: {activity.harvest_block}
                          
                        )}

                        
                          {(activity.location_lat && activity.location_lng) ? (
                            
                              
                                📍 
                                {activity.location_name ? (
                                  
                                    {activity.location_name}
                                  
                                ) : (
                                  
                                    {activity.location_lat.toFixed(4)}, {activity.location_lng.toFixed(4)}
                                  
                                )}
                                {activity.location_accuracy && (
                                  (±{Math.round(activity.location_accuracy)}m)
                                )}
                              
                            
                            
                              🗺️ Map
                            
                          
                        ) : (
                          
                            ⚠️ No location recorded
                          
                        )}

                        
                          {activity.event_type === 'spray_application' && activity.spray_product && (
                            
                              
                                🌿 Spray Application Details
                                {(() => {
                                  const productInfo = sprayDatabase[activity.spray_product as keyof typeof sprayDatabase];
                                  if (productInfo) {
                                    const sprayDate = new Date(activity.event_date);
                                    const today = new Date();
                                    const hoursSinceSpray = Math.floor((today.getTime() - sprayDate.getTime()) / (1000 * 60 * 60));

                                    if (hoursSinceSpray < productInfo.reentryHours) {
                                      return (
                                        
                                          RE-ENTRY ACTIVE
                                        
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              
                              
                                Product: {activity.spray_product}
                                {activity.spray_quantity && activity.spray_unit && (
                                  <span> • Rate: {activity.spray_quantity} {activity.spray_unit}
                                )}
                              
                              {activity.spray_target && (
                                
                                  Target: {activity.spray_target}
                                
                              )}
                              {activity.spray_equipment && (
                                
                                  Equipment: {activity.spray_equipment}
                                
                              )}
                              {activity.spray_conditions && (
                                
                                  Conditions: {activity.spray_conditions}
                                
                              )}
                              {(() => {
                                const productInfo = sprayDatabase[activity.spray_product as keyof typeof sprayDatabase];
                                if (productInfo) {
                                  return (
                                    
                                      Safety: {productInfo.reentryHours}h re-entry, {productInfo.preharvestDays}d pre-harvest
                                    
                                  );
                                }
                                return null;
                              })()}
                            
                          )}

                        {activity.notes && (
                          
                            {activity.notes}
                          
                        )}
                      
                    

                    
                      {activity.created_at && (
                        
                          Logged: {new Date(activity.created_at).toLocaleDateString()}
                        
                      )}

                      
                        
                          
                            ✏️ Edit
                          
                          
                            🗑️ Delete
                          
                        
                      
                    
                  
                
              
            )}
          
        )}
      
    

      
        
          
            
              
                
                  
                    
                      AI Insights (BETA)
                    
                  
                
              
              
                Add NEXT_PUBLIC_OPENAI_API_KEY to enable AI features
              
            
          
        

        
          
            
              
                
                  
                    AI Vineyard Insights
                  
                  
                    
                      
                         Refresh Insights
                      
                    
                  
                

              {isGeneratingInsights ? (
                
                  
                    
                      🤖 AI is analyzing your vineyard data...
                    
                    
                      This may take a few seconds
                    
                  
                
              ) : (
                
                  
                    
                      
                        
                          🍇 Recommendations
                        
                      
                      
                        
                          
                            
                              
                                
                                  
                                    
                                    
                                    
                                    
                                    
                                    
                                      {insight.daysToAction} days
                                    
                                  
                                  
                                    {insight.title}
                                  
                                  
                                    {insight.urgency}
                                  
                                
                                
                                  {insight.message}
                                
                                
                                  📊 {(insight.confidence * 100).toFixed(0)}% confidence
                                  •
                                  {insight.category}
                                
                              
                            
                          
                        
                      
                    

                    
                      
                        
                          
                            
                              
                                🌤️ Weather Impact on Harvest
                              
                            
                            
                              {weatherAnalysis}
                            
                          
                        
                          
                            
                              📈 Development & Timing
                            
                            
                              {phenologyAnalysis}
                            
                          
                        
                      
                    
                  
                
              )}
            
          
        
      
    
    
  );
}