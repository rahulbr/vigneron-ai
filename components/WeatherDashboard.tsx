// components/WeatherDashboard.tsx - Phase 1: Tab-Based Navigation Implementation

import React, { useState, useEffect } from 'react';
import { useWeather, useWeatherConnection } from '../hooks/useWeather';
import { EnhancedGDDChart } from './EnhancedGDDChart';
import { googleGeocodingService, GeocodeResult } from '../lib/googleGeocodingService';
import { openaiService, VineyardContext, AIInsight } from '../lib/openaiService';
import { supabase } from '../lib/supabase';
import { AlertCircle, RefreshCw, MapPin, Calendar, Thermometer, CloudRain, TrendingUp, Search, Brain, Lightbulb, AlertTriangle, CheckCircle, Info, FileText, Home, Plus, BarChart3, Settings } from 'lucide-react';
import { ReportsModal } from './ReportsModal';

interface WeatherDashboardProps {
  vineyardId?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  locationName?: string;
}

// Tab navigation types
type TabType = 'dashboard' | 'log' | 'history' | 'settings';

export function WeatherDashboard({
  vineyardId: propVineyardId,
  initialLatitude = 37.3272,
  initialLongitude = -122.2813,
  locationName = "La Honda, CA"
}: WeatherDashboardProps) {
  // Tab state - default to dashboard
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // All your existing state variables (unchanged)
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [customLocation, setCustomLocation] = useState(locationName);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [dateRangeMode, setDateRangeMode] = useState<'current' | 'previous' | 'custom'>('current');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [savedLocations, setSavedLocations] = useState<GeocodeResult[]>([]);
  const [vineyardId, setVineyardId] = useState<string>(propVineyardId || '');
  const [userVineyards, setUserVineyards] = useState<any[]>([]);
  const [currentVineyard, setCurrentVineyard] = useState<any | null>(null);

  // Spray safety database
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

  // All other state variables from original component
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isLoadingVineyards, setIsLoadingVineyards] = useState(true);
  const [showCreateVineyard, setShowCreateVineyard] = useState(false);
  const [editingVineyardId, setEditingVineyardId] = useState<string | null>(null);
  const [editingVineyardName, setEditingVineyardName] = useState('');
  const [editingVineyardLocation, setEditingVineyardLocation] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [weatherAnalysis, setWeatherAnalysis] = useState<string>('');
  const [phenologyAnalysis, setPhenologyAnalysis] = useState<string>('');
  const [showAIPanel, setShowAIPanel] = useState(false);
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
    irrigation_measurement_method: '', // Added for user feedback
    irrigation_measurement_value: '', // Added for user feedback
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
    scout_action: '',
    // Phenology tracking
    phenology_stage: '',
    phenology_percent_complete: '',
    phenology_location: '',
    // Ripeness tracking
    ripeness_block_estimates: '',
    ripeness_brix: '',
    ripeness_ph: '',
    ripeness_ta: '',
    ripeness_seed_brownness: '',
  });
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
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
    irrigation_measurement_method: '',
    irrigation_measurement_value: '',
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
  const [isUpdatingActivity, setIsUpdatingActivity] = useState(false);
  const [eventFilterTypes, setEventFilterTypes] = useState<string[]>([]);
  const [showEventFilterDropdown, setShowEventFilterDropdown] = useState(false);
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

  const { data: weatherData, loading, error, lastUpdated, refetch, retry, clearError } = useWeather(weatherOptions);
  const currentWeather = weatherData; // Alias for clarity

  // Function to generate auto weather notes
  const generateAutoWeatherNotes = (activityType?: string) => {
    if (!currentWeather || !currentWeather.length) return '';

    const today = new Date().toISOString().split('T')[0];
    const todaysWeather = currentWeather.find(w => w.date === today);

    if (!todaysWeather) return '';

    let notes = `Weather on ${today}: High ${todaysWeather.temp_high}°F, Low ${todaysWeather.temp_low}°F`;

    if (todaysWeather.rainfall > 0) {
      notes += `, Rainfall: ${todaysWeather.rainfall}"`;
    }

    // Add heat warnings - especially important for irrigation
    if (todaysWeather.temp_high >= 100) {
      notes += ` ⚠️ EXTREME HEAT WARNING - Temperatures over 100°F`;
      if (activityType === 'Irrigation') {
        notes += ` - Vines likely under severe water stress`;
      }
    } else if (todaysWeather.temp_high >= 95) {
      notes += ` ⚠️ Heat Wave Alert - High temperatures may stress vines`;
      if (activityType === 'Irrigation') {
        notes += ` - Monitor soil moisture closely`;
      }
    }

    // Add wind conditions if spray application
    if (activityType === 'Spray Application') {
      // Note: We'd need wind data from weather API for this
      notes += ` - Check wind conditions before spraying`;
    }

    return notes;
  };

  // All your existing useEffect hooks and functions (unchanged - keeping all the business logic)
  useEffect(() => {
    const loadUserVineyards = async () => {
      try {
        setIsLoadingVineyards(true);
        console.log('🔍 Loading user vineyards...');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('👤 No authenticated user, using demo mode');
          setIsLoadingVineyards(false);
          return;
        }

        const { getUserVineyards } = await import('../lib/supabase');
        const vineyards = await getUserVineyards();

        console.log('🍇 Loaded user vineyards:', vineyards.length);
        setUserVineyards(vineyards);

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

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];
    const startDate = `${currentYear}-04-01`;
    const aprilFirst = new Date(currentYear, 3, 1);

    let actualStartDate: string;
    let actualEndDate: string;

    if (now < aprilFirst) {
      actualStartDate = `${currentYear - 1}-04-01`;
      actualEndDate = `${currentYear - 1}-10-31`;
    } else {
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

  useEffect(() => {
    if (vineyardId) {
      loadActivities();
    }
  }, [vineyardId]);

  useEffect(() => {
    calculateSafetyAlerts();
  }, [activities]);

  const calculateSafetyAlerts = () => {
    const alerts: any[] = [];
    const today = new Date();

    const sprayApplications = activities.filter(activity =>
      activity.event_type === 'spray_application' &&
      activity.spray_product &&
      sprayDatabase[activity.spray_product as keyof typeof sprayDatabase]
    );

    sprayApplications.forEach(spray => {
      const sprayDate = new Date(spray.event_date);
      const productInfo = sprayDatabase[spray.spray_product as keyof typeof sprayDatabase];

      if (!productInfo) return;

      const hoursSinceSpray = Math.floor((today.getTime() - sprayDate.getTime()) / (1000 * 60 * 60));

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
    });

    setSafetyAlerts(alerts);
  };

  const openReportsModal = () => {
    if (!currentVineyard) {
      alert('Please select a vineyard first to generate reports.');
      return;
    }
    setShowReportsModal(true);
  };

  const saveActivity = async () => {
    if (!vineyardId || !activityForm.activity_type || !activityForm.start_date) {
      alert('Please fill in activity type and start date');
      return;
    }

    setIsSavingActivity(true);
    try {
      console.log('💾 Saving activity:', activityForm);

      const { savePhenologyEvent, updatePhenologyEvent } = await import('../lib/supabase');

      const locationData = (activityForm.location_lat && activityForm.location_lng) ? {
        latitude: activityForm.location_lat,
        longitude: activityForm.location_lng,
        locationName: activityForm.location_name,
        accuracy: activityForm.location_accuracy || undefined
      } : undefined;

      // Event type specific data preparation (simplified for brevity)
      let sprayData = undefined;
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

      // Event type specific data preparation (simplified for brevity)
      let irrigationData = undefined;
      if (activityForm.activity_type === 'Irrigation' && activityForm.irrigation_amount) {
        irrigationData = {
          amount: activityForm.irrigation_amount,
          unit: activityForm.irrigation_unit,
          method: activityForm.irrigation_method,
          duration: activityForm.irrigation_duration,
          measurement_method: activityForm.irrigation_measurement_method, // Added for user feedback
          measurement_value: activityForm.irrigation_measurement_value // Added for user feedback
        };
      }

      let fertilizationData = undefined;
      if (activityForm.activity_type === 'Fertilization' && activityForm.fertilizer_type) {
        fertilizationData = {
          type: activityForm.fertilizer_type,
          npk: activityForm.fertilizer_npk,
          rate: activityForm.fertilizer_rate,
          unit: activityForm.fertilizer_unit,
          method: activityForm.fertilizer_method
        };
      }

      let harvestData = undefined;
      if (activityForm.activity_type === 'Harvest' && activityForm.harvest_yield) {
        harvestData = {
          yield: activityForm.harvest_yield,
          unit: activityForm.harvest_unit,
          brix: activityForm.harvest_brix,
          ph: activityForm.harvest_ph,
          ta: activityForm.harvest_ta,
          block: activityForm.harvest_block
        };
      }

      let canopyData = undefined;
      if (activityForm.activity_type === 'Canopy Management' && activityForm.canopy_activity) {
        canopyData = {
          activity: activityForm.canopy_activity,
          intensity: activityForm.canopy_intensity,
          side: activityForm.canopy_side,
          stage: activityForm.canopy_stage
        };
      }

      let scoutData = undefined;
      if (activityForm.activity_type === 'Scouting' && activityForm.scout_focus) {
        scoutData = {
          focus: activityForm.scout_focus,
          severity: activityForm.scout_severity,
          distribution: activityForm.scout_distribution,
          action: activityForm.scout_action
        };
      }

      // Ripeness tracking data
      let ripenessData = undefined;
      if (activityForm.activity_type === 'Ripeness Tracking') {
        ripenessData = {
          block_estimates: activityForm.ripeness_block_estimates,
          brix: activityForm.ripeness_brix,
          ph: activityForm.ripeness_ph,
          ta: activityForm.ripeness_ta,
          seed_brownness: activityForm.ripeness_seed_brownness,
        };
      }

      // Phenology tracking data
      let phenologyData = undefined;
      if (activityForm.activity_type === 'Phenology Tracking' && activityForm.phenology_stage) {
        phenologyData = {
          stage: activityForm.phenology_stage,
          percent_complete: activityForm.phenology_percent_complete,
          location_estimate: activityForm.phenology_location
        };
      }

      const eventTypeMap: { [key: string]: string } = {
        'Spray Application': 'spray_application',
        'Irrigation': 'irrigation',
        'Fertilization': 'fertilization',
        'Harvest': 'harvest',
        'Canopy Management': 'canopy_management',
        'Scouting': 'scouting',
        'Phenology Tracking': 'phenology',
        'Ripeness Tracking': 'ripeness',
        'Bud Break': 'budbreak',
        'Bloom': 'bloom',
        'Fruit Set': 'fruit_set',
        'Veraison': 'veraison',
        'Pruning': 'pruning',
        'Soil Work': 'soil_work',
        'Equipment Maintenance': 'equipment_maintenance',
        'Pest': 'pest',
        'Other': 'other'
      };

      // Add any additional activity-specific data to notes
      let enhancedNotes = activityForm.notes || '';

      if (activityForm.activity_type === 'Phenology Tracking' && activityForm.phenology_stage) {
        const phenologyDetails = [];
        phenologyDetails.push(`Growth Stage: ${activityForm.phenology_stage}`);

        if (activityForm.phenology_percent_complete) {
          phenologyDetails.push(`${activityForm.phenology_percent_complete}% Complete`);
        }

        if (activityForm.phenology_location) {
          phenologyDetails.push(`Block Estimates: ${activityForm.phenology_location}`);
        }

        enhancedNotes = `${phenologyDetails.join(' | ')}\n${enhancedNotes}`.trim();
      }

      if (activityForm.activity_type === 'Ripeness Tracking') {
        const ripenessDetails = [];

        if (activityForm.ripeness_brix) {
          ripenessDetails.push(`Brix: ${activityForm.ripeness_brix}`);
        }

        if (activityForm.ripeness_ph) {
          ripenessDetails.push(`pH: ${activityForm.ripeness_ph}`);
        }

        if (activityForm.ripeness_ta) {
          ripenessDetails.push(`TA: ${activityForm.ripeness_ta}`);
        }

        if (activityForm.ripeness_seed_brownness) {
          ripenessDetails.push(`Seed Brownness: ${activityForm.ripeness_seed_brownness}`);
        }

        if (activityForm.ripeness_block_estimates) {
          ripenessDetails.push(`Block Estimates: ${activityForm.ripeness_block_estimates}`);
        }

        enhancedNotes = `${ripenessDetails.join(' | ')}\n${enhancedNotes}`.trim();
      }

      if (editingEvent) {
        // Update existing event
        const updates: any = {
          event_type: eventTypeMap[activityForm.activity_type] || activityForm.activity_type.toLowerCase().replace(/ /g, '_'),
          event_date: activityForm.start_date,
          notes: enhancedNotes
        };

        if (activityForm.end_date) updates.end_date = activityForm.end_date;
        if (activityForm.harvest_block) updates.harvest_block = activityForm.harvest_block;
        if (activityForm.phenology_stage) updates.phenology_stage = activityForm.phenology_stage;
        if (activityForm.phenology_percent_complete) updates.phenology_percent_complete = activityForm.phenology_percent_complete;
        if (activityForm.phenology_location) updates.phenology_location = activityForm.phenology_location;
        if (activityForm.ripeness_block_estimates) updates.ripeness_block_estimates = activityForm.ripeness_block_estimates;
        if (activityForm.ripeness_brix) updates.ripeness_brix = activityForm.ripeness_brix;
        if (activityForm.ripeness_ph) updates.ripeness_ph = activityForm.ripeness_ph;
        if (activityForm.ripeness_ta) updates.ripeness_ta = activityForm.ripeness_ta;
        if (activityForm.ripeness_seed_brownness) updates.ripeness_seed_brownness = activityForm.ripeness_seed_brownness;


        if (locationData) {
          if (locationData.latitude !== undefined) updates.location_lat = locationData.latitude;
          if (locationData.longitude !== undefined) updates.location_lng = locationData.longitude;
          if (locationData.locationName) updates.location_name = locationData.locationName;
          if (locationData.accuracy !== undefined) updates.location_accuracy = locationData.accuracy;
        }

        if (sprayData) {
          if (sprayData.product) updates.spray_product = sprayData.product;
          if (sprayData.quantity) updates.spray_quantity = sprayData.quantity;
          if (sprayData.unit) updates.spray_unit = sprayData.unit;
          if (sprayData.target) updates.spray_target = sprayData.target;
          if (sprayData.conditions) updates.spray_conditions = sprayData.conditions;
          if (sprayData.equipment) updates.spray_equipment = sprayData.equipment;
        }

        if (irrigationData) {
          if (irrigationData.amount) updates.irrigation_amount = irrigationData.amount;
          if (irrigationData.unit) updates.irrigation_unit = irrigationData.unit;
          if (irrigationData.method) updates.irrigation_method = irrigationData.method;
          if (irrigationData.duration) updates.irrigation_duration = irrigationData.duration;
          if (irrigationData.measurement_method) updates.irrigation_measurement_method = irrigationData.measurement_method;
          if (irrigationData.measurement_value) updates.irrigation_measurement_value = irrigationData.measurement_value;
        }

        if (fertilizationData) {
          if (fertilizationData.type) updates.fertilizer_type = fertilizationData.type;
          if (fertilizationData.npk) updates.fertilizer_npk = fertilizationData.npk;
          if (fertilizationData.rate) updates.fertilizer_rate = fertilizationData.rate;
          if (fertilizationData.unit) updates.fertilizer_unit = fertilizationData.unit;
          if (fertilizationData.method) updates.fertilizer_method = fertilizationData.method;
        }

        if (harvestData) {
          if (harvestData.yield) updates.harvest_yield = harvestData.yield;
          if (harvestData.unit) updates.harvest_unit = harvestData.unit;
          if (harvestData.brix) updates.harvest_brix = harvestData.brix;
          if (harvestData.ph) updates.harvest_ph = harvestData.ph;
          if (harvestData.ta) updates.harvest_ta = harvestData.ta;
          if (harvestData.block) updates.harvest_block = harvestData.block;
        }

        if (canopyData) {
          if (canopyData.activity) updates.canopy_activity = canopyData.activity;
          if (canopyData.intensity) updates.canopy_intensity = canopyData.intensity;
          if (canopyData.side) updates.canopy_side = canopyData.side;
          if (canopyData.stage) updates.canopy_stage = canopyData.stage;
        }

        if (scoutData) {
          if (scoutData.focus) updates.scout_focus = scoutData.focus;
          if (scoutData.severity) updates.scout_severity = scoutData.severity;
          if (scoutData.distribution) updates.scout_distribution = scoutData.distribution;
          if (scoutData.action) updates.scout_action = scoutData.action;
        }

        if (ripenessData) {
          if (ripenessData.block_estimates) updates.ripeness_block_estimates = ripenessData.block_estimates;
          if (ripenessData.brix) updates.ripeness_brix = ripenessData.brix;
          if (ripenessData.ph) updates.ripeness_ph = ripenessData.ph;
          if (ripenessData.ta) updates.ripeness_ta = ripenessData.ta;
          if (ripenessData.seed_brownness) updates.ripeness_seed_brownness = ripenessData.seed_brownness;
        }

        if (phenologyData) {
          if (phenologyData.stage) updates.phenology_stage = phenologyData.stage;
          if (phenologyData.percent_complete) updates.phenology_percent_complete = phenologyData.percent_complete;
          if (phenologyData.location_estimate) updates.phenology_location = phenologyData.location_estimate;
        }

        await updatePhenologyEvent(editingEvent.id, updates);
        console.log('✅ Activity updated successfully');
        setEditingEvent(null);
        alert('Activity updated successfully!');
      } else {
        // Create new event
        await savePhenologyEvent(
          vineyardId,
          eventTypeMap[activityForm.activity_type] || activityForm.activity_type.toLowerCase().replace(/ /g, '_'),
          activityForm.start_date,
          enhancedNotes, // Use enhancedNotes here
          activityForm.end_date || undefined,
          activityForm.harvest_block || undefined,
          locationData,
          sprayData,
          irrigationData,
          fertilizationData,
          harvestData,
          canopyData,
          scoutData,
          phenologyData, // Pass phenology data
          ripenessData // Pass ripeness data
        );
        console.log('✅ Activity saved successfully');
        alert('Activity logged successfully!');
      }

      setActivityForm({
        activity_type: '',
        start_date: '',
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
        irrigation_measurement_method: '',
        irrigation_measurement_value: '', // Added for user feedback
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
        scout_action: '',
        phenology_stage: '',
        phenology_percent_complete: '',
        phenology_location: '',
        ripeness_block_estimates: '',
        ripeness_brix: '',
        ripeness_ph: '',
        ripeness_ta: '',
        ripeness_seed_brownness: '',
      });
      await loadActivities();

      if (typeof window !== 'undefined') {
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

  // Calculate summary statistics
  const totalGDD = weatherData.reduce((sum, day) => sum + day.gdd, 0);
  const totalRainfall = weatherData.reduce((sum, day) => sum + day.rainfall, 0);
  const avgTempHigh = weatherData.length > 0 ? weatherData.reduce((sum, day) => sum + day.temp_high, 0) / weatherData.length : 0;
  const avgTempLow = weatherData.length > 0 ? weatherData.reduce((sum, day) => sum + day.temp_low, 0) / weatherData.length : 0;

  const activityTypes = [
    'Pruning', 'Bud Break', 'Bloom', 'Fruit Set', 'Veraison', 'Harvest',
    'Irrigation', 'Spray Application', 'Fertilization', 'Canopy Management',
    'Soil Work', 'Equipment Maintenance', 'Pest', 'Scouting', 'Other',
    'Phenology Tracking', 'Ripeness Tracking'
  ];

  // Don't render until initialized
  if (!isInitialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #22c55e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>Loading vineyard data...</p>
      </div>
    );
  }

  // Calculate phenology predictions
  const getPhenologyPredictions = () => {
    if (!weatherData.length || !activities.length) return [];

    const currentGDD = totalGDD;
    const predictions = [];

    // Typical GDD requirements for phenology stages
    const phenologyRequirements = {
      bud_break: 150,
      bloom: 900,
      veraison: 1800,
      harvest: 2400
    };

    // Find recorded events
    const recordedEvents = {
      bud_break: activities.find(e => e.event_type === 'phenology' && e.phenology_stage === 'Budbreak'),
      bloom: activities.find(e => e.event_type === 'phenology' && e.phenology_stage === 'Flowering'),
      veraison: activities.find(e => e.event_type === 'phenology' && e.phenology_stage === 'Veraison'),
      harvest: activities.find(e => e.event_type === 'harvest' || e.event_type === 'Harvest')
    };

    // Predict missing stages
    if (!recordedEvents.veraison && currentGDD < phenologyRequirements.veraison) {
      const remainingGDD = phenologyRequirements.veraison - currentGDD;
      const avgDailyGDD = weatherData.length > 0 ? totalGDD / weatherData.length : 8;
      const daysToVeraison = Math.ceil(remainingGDD / avgDailyGDD);
      const predictedDate = new Date();
      predictedDate.setDate(predictedDate.getDate() + daysToVeraison);

      predictions.push({
        stage: 'Veraison',
        date: predictedDate.toLocaleDateString(),
        gdd: phenologyRequirements.veraison,
        confidence: currentGDD > 1000 ? 'High' : 'Medium'
      });
    }

    if (!recordedEvents.harvest && currentGDD < phenologyRequirements.harvest) {
      const remainingGDD = phenologyRequirements.harvest - currentGDD;
      const avgDailyGDD = weatherData.length > 0 ? totalGDD / weatherData.length : 8;
      const daysToHarvest = Math.ceil(remainingGDD / avgDailyGDD);
      const predictedDate = new Date();
      predictedDate.setDate(predictedDate.getDate() + daysToHarvest);

      predictions.push({
        stage: 'Harvest',
        date: predictedDate.toLocaleDateString(),
        gdd: phenologyRequirements.harvest,
        confidence: currentGDD > 1500 ? 'High' : 'Medium'
      });
    }

    return predictions;
  };

  const phenologyPredictions = getPhenologyPredictions();

  const DashboardTab = () => (
    <div style={{ padding: '0 1rem 1rem 1rem' }}>
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
              <div style={{ fontSize: '20px', marginTop: '2px' }}>
                {alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '🚫' : '📅'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>
                  {alert.title}
                </div>
                <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                  {alert.message}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  📍 {alert.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Vineyard Display */}
      {currentVineyard && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#0369a1', marginBottom: '8px' }}>
            📍 {currentVineyard.name}
          </div>
          <div style={{ fontSize: '14px', color: '#0284c7', marginBottom: '8px' }}>
            {currentVineyard.latitude.toFixed(4)}, {currentVineyard.longitude.toFixed(4)}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Current vineyard • {activities.length} events logged
          </div>
        </div>
      )}

      {/* Phenology Predictions */}
      {phenologyPredictions.length > 0 && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#fef7ff',
          border: '2px solid #d8b4fe',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>🔮</span>
            <h4 style={{ margin: '0', fontSize: '16px', fontWeight: '700', color: '#7c3aed' }}>
              Predicted Phenology Stages
            </h4>
          </div>

          {phenologyPredictions.map((prediction, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                backgroundColor: 'white',
                borderRadius: '8px',
                marginBottom: index < phenologyPredictions.length - 1 ? '8px' : '0',
                border: '1px solid #e5e7eb'
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                  🍇 {prediction.stage}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  At {prediction.gdd} GDD • {prediction.confidence} confidence
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#7c3aed',
                padding: '4px 8px',
                backgroundColor: '#f3e8ff',
                borderRadius: '6px'
              }}>
                {prediction.date}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Date Range Controls */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Calendar size={16} style={{ color: '#6b7280' }} />
          <h4 style={{ margin: '0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
            Date Range
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
          {[
            { key: 'current', label: 'Current Season' },
            { key: 'previous', label: 'Previous Season' },
            { key: 'custom', label: 'Custom Range' }
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => {
                setDateRangeMode(option.key as any);

                const now = new Date();
                const currentYear = now.getFullYear();

                if (option.key === 'current') {
                  const aprilFirst = new Date(currentYear, 3, 1);
                  if (now < aprilFirst) {
                    setDateRange({
                      start: `${currentYear - 1}-04-01`,
                      end: `${currentYear - 1}-10-31`
                    });
                  } else {
                    setDateRange({
                      start: `${currentYear}-04-01`,
                      end: now.toISOString().split('T')[0]
                    });
                  }
                  setShowCustomRange(false);
                } else if (option.key === 'previous') {
                  setDateRange({
                    start: `${currentYear - 1}-04-01`,
                    end: `${currentYear - 1}-10-31`
                  });
                  setShowCustomRange(false);
                } else if (option.key === 'custom') {
                  setShowCustomRange(true);
                }
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: dateRangeMode === option.key ? '#22c55e' : 'white',
                color: dateRangeMode === option.key ? 'white' : '#374151',
                border: `1px solid ${dateRangeMode === option.key ? '#22c55e' : '#d1d5db'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {showCustomRange && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#374151' }}>
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#374151' }}>
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
            </div>
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
          📅 {dateRange.start} to {dateRange.end} ({weatherData.length} days)
        </div>
      </div>

      {/* Weather Summary Stats */}
      {weatherData.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={20} style={{ color: '#059669' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669', marginBottom: '4px' }}>
              {Math.round(totalGDD)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Total GDDs
            </div>
          </div>

          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <CloudRain size={20} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6', marginBottom: '4px' }}>
              {totalRainfall.toFixed(1)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Total Rainfall
            </div>
          </div>

          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <Thermometer size={20} style={{ color: '#ef4444' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444', marginBottom: '4px' }}>
              {avgTempHigh.toFixed(0)}°F
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Avg High
            </div>
          </div>

          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <Thermometer size={20} style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#8b5cf6', marginBottom: '4px' }}>
              {avgTempLow.toFixed(0)}°F
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Avg Low
            </div>
          </div>
        </div>
      )}

      {/* Enhanced GDD Chart */}
      {weatherData.length > 0 && !loading && vineyardId && (
        <div style={{
          marginBottom: '20px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 16px 0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: '#374151' }}>
                📈 GDD Accumulation & Events
              </h3>
              <button
                onClick={() => {
                  setActiveTab('log');
                  setTimeout(() => setShowActivityForm(true), 100);
                }}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={14} />
                Add Event
              </button>
            </div>
          </div>
          <EnhancedGDDChart
            weatherData={weatherData}
            locationName={customLocation}
            vineyardId={vineyardId}
            onEventsChange={loadActivities}
            onAddEvent={() => {
              setActiveTab('log');
              setTimeout(() => setShowActivityForm(true), 100);
            }}
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <RefreshCw size={32} style={{ color: '#6b748b', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#475569' }}>Loading Weather Data</h3>
          <p style={{ margin: '0', color: '#64748b' }}>
            Fetching data for {customLocation}...
          </p>
        </div>
      )}
    </div>
  );

  const LogEventTab = () => {
    return (
      <div style={{ padding: '0 1rem 1rem 1rem' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#374151' }}>
            {editingEvent ? '✏️ Edit Event' : '📝 Log Event'}
          </h3>
          <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
            {editingEvent ? 'Update vineyard activity or phenology event' : 'Record vineyard activities and phenology events'}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {[
            { type: 'Spray Application', emoji: '🌿', color: '#f59e0b', bg: '#fef3c7' },
            { type: 'Irrigation', emoji: '💧', color: '#06b6d4', bg: '#e0f7fa' },
            { type: 'Harvest', emoji: '🍷', color: '#ef4444', bg: '#fef2f2' },
            { type: 'Scouting', emoji: '🔍', color: '#059669', bg: '#f0f9ff' }
          ].map((eventType) => (
            <button
              key={eventType.type}
              onClick={() => {
                setActivityForm(prev => ({
                  ...prev,
                  activity_type: eventType.type,
                  start_date: new Date().toISOString().split('T')[0],
                  spray_conditions: eventType.type === 'Spray Application' ? generateAutoWeatherNotes('Spray Application') : prev.spray_conditions,
                  notes: eventType.type === 'Irrigation' ? generateAutoWeatherNotes('Irrigation') : prev.notes,
                }));
                setShowActivityForm(true);
              }}
              style={{
                padding: '16px',
                backgroundColor: eventType.bg,
                border: `2px solid ${eventType.color}`,
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{eventType.emoji}</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: eventType.color }}>
                {eventType.type}
              </div>
            </button>
          ))}
        </div>

        {/* All Event Types Button */}
        <button
          onClick={() => setShowActivityForm(true)}
          style={{
            width: '100%',
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
            marginBottom: '24px',
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
          <Plus size={20} />
          View All Event Types
        </button>

        {/* Event Form */}
        {showActivityForm && (
          <div style={{
            padding: '20px',
            backgroundColor: 'white',
            border: '2px solid #22c55e',
            borderRadius: '12px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: '0', color: '#059669', fontSize: '18px', fontWeight: '700' }}>
                {editingEvent ? '✏️ Edit Event' : '➕ New Event'}
              </h4>
              <button
                onClick={() => {
                  setShowActivityForm(false);
                  setEditingEvent(null); // Clear editing state when closing form
                }}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                  Event Type *
                </label>
                <select
                  value={activityForm.activity_type}
                  onChange={(e) => {
                    const selectedType = e.target.value;
                    setActivityForm(prev => ({
                      ...prev,
                      activity_type: selectedType,
                      // Reset other fields if needed when type changes, or set defaults
                      spray_product: '', spray_quantity: '', spray_unit: 'oz/acre', spray_target: '', spray_conditions: '', spray_equipment: '',
                      irrigation_amount: '', irrigation_unit: 'inches', irrigation_method: '', irrigation_duration: '', irrigation_measurement_method: '', irrigation_measurement_value: '',
                      fertilizer_type: '', fertilizer_npk: '', fertilizer_rate: '', fertilizer_unit: 'lbs/acre', fertilizer_method: '',
                      harvest_yield: '', harvest_unit: 'tons/acre', harvest_brix: '', harvest_ph: '', harvest_ta: '', harvest_block: '',
                      phenology_stage: '', phenology_percent_complete: '', phenology_location: '',
                      ripeness_block_estimates: '', ripeness_brix: '', ripeness_ph: '', ripeness_ta: '', ripeness_seed_brownness: '',
                      // Auto-populate weather notes based on the new type
                      spray_conditions: selectedType === 'Spray Application' ? generateAutoWeatherNotes('Spray Application') : prev.spray_conditions,
                      notes: selectedType === 'Irrigation' ? generateAutoWeatherNotes('Irrigation') : prev.notes,
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    fontSize: '14px'
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
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setActivityForm(prev => {
                      const updated = { ...prev, start_date: newDate };

                      // Auto-update weather conditions for spray applications and irrigation
                      if (updated.activity_type === 'Spray Application') {
                        updated.spray_conditions = generateAutoWeatherNotes('Spray Application');
                      }
                      if (updated.activity_type === 'Irrigation') {
                        updated.notes = generateAutoWeatherNotes('Irrigation');
                      }

                      return updated;
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>
            </div>

            {/* Spray Application Details */}
            {activityForm.activity_type === 'Spray Application' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#fef3c7',
                border: '2px solid #fbbf24',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#92400e', fontSize: '16px', fontWeight: '700' }}>
                  🌿 Spray Application Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                      Product *
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
                      <option value="Captan">Captan</option>
                      <option value="Copper Sulfate">Copper Sulfate</option>
                      <option value="Sulfur">Sulfur</option>
                      <option value="Mancozeb">Mancozeb</option>
                      <option value="Chlorothalonil">Chlorothalonil</option>
                      <option value="Propiconazole">Propiconazole</option>
                      <option value="Myclobutanil">Myclobutanil</option>
                      <option value="Tebuconazole">Tebuconazole</option>
                      <option value="Imidacloprid">Imidacloprid</option>
                      <option value="Spinosad">Spinosad</option>
                      <option value="Carbaryl">Carbaryl</option>
                      <option value="Malathion">Malathion</option>
                      <option value="Glyphosate">Glyphosate</option>
                      <option value="2,4-D">2,4-D</option>
                      <option value="Dicamba">Dicamba</option>
                      <option value="Paraquat">Paraquat</option>
                      <option value="Roundup">Roundup</option>
                      <option value="Bt (Bacillus thuringiensis)">Bt (Bacillus thuringiensis)</option>
                      <option value="Kaolin Clay">Kaolin Clay</option>
                      <option value="Neem Oil">Neem Oil</option>
                      <option value="Horticultural Oil">Horticultural Oil</option>
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
                        fontSize: '13px'
                      }}
                    >
                      <option value="oz/acre">oz/acre</option>
                      <option value="lbs/acre">lbs/acre</option>
                      <option value="gal/acre">gal/acre</option>
                      <option value="ml/L">ml/L</option>
                      <option value="ppm">ppm</option>
                      <option value="kg/ha">kg/ha</option>
                      <option value="L/ha">L/ha</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                      Target Pest/Disease
                    </label>
                    <input
                      type="text"
                      value={activityForm.spray_target}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, spray_target: e.target.value }))}
                      placeholder="e.g. Powdery mildew, aphids"
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
                    <select
                      value={activityForm.spray_equipment}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, spray_equipment: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select equipment...</option>
                      <option value="Airblast Sprayer">Airblast Sprayer</option>
                      <option value="Boom Sprayer">Boom Sprayer</option>
                      <option value="Backpack Sprayer">Backpack Sprayer</option>
                      <option value="Handheld Sprayer">Handheld Sprayer</option>
                      <option value="Helicopter">Helicopter</option>
                      <option value="Drone">Drone</option>
                      <option value="Mist Blower">Mist Blower</option>
                      <option value="Electrostatic Sprayer">Electrostatic Sprayer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                    Weather Conditions
                  </label>
                  <textarea
                    value={activityForm.spray_conditions}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, spray_conditions: e.target.value }))}
                    placeholder="e.g. Temp: 68°F, Wind: 3mph N, Humidity: 45%, Clear skies"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #f59e0b',
                      borderRadius: '6px',
                      fontSize: '13px',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Irrigation Details */}
            {activityForm.activity_type === 'Irrigation' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#e0f7fa',
                border: '2px solid #06b6d4',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#0e7490', fontSize: '16px', fontWeight: '700' }}>
                  💧 Irrigation Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#0e7490' }}>
                      Amount *
                    </label>
                    <input
                      type="text"
                      value={activityForm.irrigation_amount}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_amount: e.target.value }))}
                      placeholder="e.g. 1.5"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #06b6d4',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#0e7490' }}>
                      Unit
                    </label>
                    <select
                      value={activityForm.irrigation_unit}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_unit: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #06b6d4',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="inches">inches</option>
                      <option value="gallons">gallons</option>
                      <option value="gallons/vine">gallons/vine</option>
                      <option value="gal/acre">gal/acre</option>
                      <option value="acre-feet">acre-feet</option>
                      <option value="liters">liters</option>
                      <option value="mm">mm</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#0e7490' }}>
                      Method *
                    </label>
                    <select
                      value={activityForm.irrigation_method}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_method: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #06b6d4',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select method...</option>
                      <option value="Drip">Drip Irrigation</option>
                      <option value="Micro Sprinkler">Micro Sprinkler</option>
                      <option value="Overhead Sprinkler">Overhead Sprinkler</option>
                      <option value="Furrow">Furrow Irrigation</option>
                      <option value="Flood">Flood Irrigation</option>
                      <option value="Subsurface Drip">Subsurface Drip</option>
                      <option value="Micro-jet">Micro-jet</option>
                      <option value="Hand Watering">Hand Watering</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#0e7490' }}>
                      Duration (optional)
                    </label>
                    <input
                      type="text"
                      value={activityForm.irrigation_duration}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_duration: e.target.value }))}
                      placeholder="e.g. 2 hours, 30 minutes"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #06b6d4',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#0e7490' }}>
                    Measurement Method (optional)
                  </label>
                  <select
                    value={activityForm.irrigation_measurement_method || ''}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, irrigation_measurement_method: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #06b6d4',
                      borderRadius: '6px',
                      fontSize: '13px'
                    }}
                  >
                    <option value="">Select method...</option>
                    <option value="Leaf Water Potential">Leaf Water Potential (LWP)</option>
                    <option value="Soil Moisture Probe">Soil Moisture Probe</option>
                    <option value="Visual Inspection">Visual Inspection</option>
                    <option value="Stem Water Potential">Stem Water Potential (SWP)</option>
                    <option value="Neutron Probe">Neutron Probe</option>
                    <option value="Tensiometer">Tensiometer</option>
                    <option value="Capacitance Sensor">Capacitance Sensor</option>
                    <option value="Time Domain Reflectometry">Time Domain Reflectometry (TDR)</option>
                    <option value="Infrared Thermometry">Infrared Thermometry</option>
                    <option value="Scheduled/Calendar">Scheduled/Calendar Based</option>
                  </select>
                </div>
              </div>
            )}

            {/* Fertilization Details */}
            {activityForm.activity_type === 'Fertilization' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f0f9ff',
                border: '2px solid #3b82f6',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#1e40af', fontSize: '16px', fontWeight: '700' }}>
                  🌱 Fertilization Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#1e40af' }}>
                      Fertilizer Type *
                    </label>
                    <select
                      value={activityForm.fertilizer_type}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_type: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select fertilizer...</option>
                      <option value="Organic Compost">Organic Compost</option>
                      <option value="Well-rotted Manure">Well-rotted Manure</option>
                      <option value="Nitrogen (N)">Nitrogen (N)</option>
                      <option value="Phosphorus (P)">Phosphorus (P)</option>
                      <option value="Potassium (K)">Potassium (K)</option>
                      <option value="NPK Blend">NPK Blend</option>
                      <option value="Calcium Carbonate">Calcium Carbonate</option>
                      <option value="Magnesium Sulfate">Magnesium Sulfate</option>
                      <option value="Ammonium Sulfate">Ammonium Sulfate</option>
                      <option value="Urea">Urea</option>
                      <option value="Triple Superphosphate">Triple Superphosphate</option>
                      <option value="Muriate of Potash">Muriate of Potash</option>
                      <option value="Bone Meal">Bone Meal</option>
                      <option value="Fish Emulsion">Fish Emulsion</option>
                      <option value="Kelp Meal">Kelp Meal</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#1e40af' }}>
                      NPK Analysis
                    </label>
                    <input
                      type="text"
                      value={activityForm.fertilizer_npk}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_npk: e.target.value }))}
                      placeholder="e.g. 20-10-10, 0-0-60"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#1e40af' }}>
                      Application Rate
                    </label>
                    <input
                      type="text"
                      value={activityForm.fertilizer_rate}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_rate: e.target.value }))}
                      placeholder="e.g. 50"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#1e40af' }}>
                      Unit
                    </label>
                    <select
                      value={activityForm.fertilizer_unit}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_unit: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="lbs/acre">lbs/acre</option>
                      <option value="kg/ha">kg/ha</option>
                      <option value="tons/acre">tons/acre</option>
                      <option value="oz/vine">oz/vine</option>
                      <option value="g/vine">g/vine</option>
                      <option value="gal/acre">gal/acre</option>
                      <option value="L/ha">L/ha</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#1e40af' }}>
                    Application Method
                  </label>
                  <select
                    value={activityForm.fertilizer_method}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, fertilizer_method: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      fontSize: '13px'
                    }}
                  >
                    <option value="">Select application method...</option>
                    <option value="Broadcast">Broadcast</option>
                    <option value="Banded">Banded</option>
                    <option value="Foliar Spray">Foliar Spray</option>
                    <option value="Fertigation">Fertigation (through irrigation)</option>
                    <option value="Soil Injection">Soil Injection</option>
                    <option value="Sidedress">Sidedress</option>
                    <option value="Topdress">Topdress</option>
                    <option value="Incorporation">Incorporation</option>
                  </select>
                </div>
              </div>
            )}

            {/* Canopy Management Details */}
            {activityForm.activity_type === 'Canopy Management' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f0fdf4',
                border: '2px solid #059669',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#059669', fontSize: '16px', fontWeight: '700' }}>
                  ✂️ Canopy Management Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#059669' }}>
                      Activity *
                    </label>
                    <select
                      value={activityForm.canopy_activity}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_activity: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #059669',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select activity...</option>
                      <option value="Shoot Thinning">Shoot Thinning</option>
                      <option value="Leaf Removal">Leaf Removal</option>
                      <option value="Hedging">Hedging</option>
                      <option value="Suckering">Suckering</option>
                      <option value="Cluster Thinning">Cluster Thinning</option>
                      <option value="Topping">Topping</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#059669' }}>
                      Intensity
                    </label>
                    <select
                      value={activityForm.canopy_intensity}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_intensity: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #059669',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select intensity...</option>
                      <option value="Light">Light</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Heavy">Heavy</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#059669' }}>
                      Side
                    </label>
                    <select
                      value={activityForm.canopy_side}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_side: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #059669',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select side...</option>
                      <option value="East">East</option>
                      <option value="West">West</option>
                      <option value="Both">Both</option>
                      <option value="North">North</option>
                      <option value="South">South</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Pruning Details */}
            {activityForm.activity_type === 'Pruning' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#fff7ed',
                border: '2px solid #ea580c',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#c2410c', fontSize: '16px', fontWeight: '700' }}>
                  ✂️ Pruning Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#c2410c' }}>
                      Pruning Type *
                    </label>
                    <select
                      value={activityForm.canopy_activity}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_activity: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ea580c',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select pruning type...</option>
                      <option value="Dormant Pruning">Dormant Pruning</option>
                      <option value="Summer Pruning">Summer Pruning</option>
                      <option value="Cane Pruning">Cane Pruning</option>
                      <option value="Spur Pruning">Spur Pruning</option>
                      <option value="Sucker Removal">Sucker Removal</option>
                      <option value="Shoot Positioning">Shoot Positioning</option>
                      <option value="Renewal Pruning">Renewal Pruning</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#c2410c' }}>
                      Intensity
                    </label>
                    <select
                      value={activityForm.canopy_intensity}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_intensity: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ea580c',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select intensity...</option>
                      <option value="Light">Light</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Heavy">Heavy</option>
                      <option value="Severe">Severe</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#c2410c' }}>
                      Growth Stage
                    </label>
                    <select
                      value={activityForm.canopy_stage}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_stage: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ea580c',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select stage...</option>
                      <option value="Dormant">Dormant</option>
                      <option value="Bud Swell">Bud Swell</option>
                      <option value="Bud Break">Bud Break</option>
                      <option value="Early Shoot Growth">Early Shoot Growth</option>
                      <option value="Pre-Bloom">Pre-Bloom</option>
                      <option value="Post-Harvest">Post-Harvest</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Soil Work Details */}
            {activityForm.activity_type === 'Soil Work' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#fefce8',
                border: '2px solid #ca8a04',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#a16207', fontSize: '16px', fontWeight: '700' }}>
                  🌍 Soil Work Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#a16207' }}>
                      Activity Type *
                    </label>
                    <select
                      value={activityForm.canopy_activity}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_activity: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ca8a04',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select soil work...</option>
                      <option value="Tillage">Tillage</option>
                      <option value="Cultivation">Cultivation</option>
                      <option value="Discing">Discing</option>
                      <option value="Subsoiling">Subsoiling</option>
                      <option value="Cover Crop Planting">Cover Crop Planting</option>
                      <option value="Cover Crop Termination">Cover Crop Termination</option>
                      <option value="Weed Control">Weed Control</option>
                      <option value="Soil Amendment">Soil Amendment</option>
                      <option value="Mulching">Mulching</option>
                      <option value="Erosion Control">Erosion Control</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#a16207' }}>
                      Equipment Used
                    </label>
                    <input
                      type="text"
                      value={activityForm.spray_equipment}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, spray_equipment: e.target.value }))}
                      placeholder="e.g. Disc harrow, Cultivator"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ca8a04',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#a16207' }}>
                      Depth/Intensity
                    </label>
                    <input
                      type="text"
                      value={activityForm.canopy_intensity}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, canopy_intensity: e.target.value }))}
                      placeholder="e.g. 6 inches, Light"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ca8a04',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Scouting Details */}
            {activityForm.activity_type === 'Scouting' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#fffbeb',
                border: '2px solid #f59e0b',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#92400e', fontSize: '16px', fontWeight: '700' }}>
                  🔍 Scouting Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                      Focus *
                    </label>
                    <select
                      value={activityForm.scout_focus}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, scout_focus: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select focus...</option>
                      <option value="Pest Monitoring">Pest Monitoring</option>
                      <option value="Disease Check">Disease Check</option>
                      <option value="Nutrient Deficiency">Nutrient Deficiency</option>
                      <option value="Phenology Stage">Phenology Stage</option>
                      <option value="Fruit Quality">Fruit Quality</option>
                      <option value="General Health">General Health</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                      Severity
                    </label>
                    <select
                      value={activityForm.scout_severity}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, scout_severity: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select severity...</option>
                      <option value="None">None</option>
                      <option value="Low">Low</option>
                      <option value="Moderate">Moderate</option>
                      <option value="High">High</option>
                      <option value="Severe">Severe</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                      Distribution
                    </label>
                    <select
                      value={activityForm.scout_distribution}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, scout_distribution: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select distribution...</option>
                      <option value="Isolated">Isolated</option>
                      <option value="Scattered">Scattered</option>
                      <option value="Clustered">Clustered</option>
                      <option value="Widespread">Widespread</option>
                      <option value="Uniform">Uniform</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Ripeness Tracking */}
            {activityForm.activity_type === 'Ripeness Tracking' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#fdf2f8',
                border: '2px solid #ec4899',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#be185d', fontSize: '16px', fontWeight: '600' }}>
                  🍇 Ripeness Assessment
                </h5>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#be185d' }}>
                    Block Estimates (% Complete)
                  </label>
                  <textarea
                    value={activityForm.ripeness_block_estimates || ''}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, ripeness_block_estimates: e.target.value }))}
                    placeholder="e.g. Block A: 85% ready, Block B: 70% ready, Block C: 90% ready"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ec4899',
                      borderRadius: '6px',
                      fontSize: '13px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#be185d' }}>
                      Brix *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={activityForm.ripeness_brix || ''}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, ripeness_brix: e.target.value }))}
                      placeholder="e.g. 24.5"
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '2px solid #ec4899',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#be185d' }}>
                      pH *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={activityForm.ripeness_ph || ''}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, ripeness_ph: e.target.value }))}
                      placeholder="e.g. 3.4"
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '2px solid #ec4899',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#be185d' }}>
                      TA (optional)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={activityForm.ripeness_ta || ''}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, ripeness_ta: e.target.value }))}
                      placeholder="e.g. 6.5 g/L"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ec4899',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#be185d' }}>
                      Seed Brownness (optional)
                    </label>
                    <select
                      value={activityForm.ripeness_seed_brownness || ''}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, ripeness_seed_brownness: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ec4899',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select...</option>
                      <option value="Green">Green (0%)</option>
                      <option value="Light Brown">Light Brown (25%)</option>
                      <option value="Medium Brown">Medium Brown (50%)</option>
                      <option value="Dark Brown">Dark Brown (75%)</option>
                      <option value="Fully Brown">Fully Brown (100%)</option>
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
                backgroundColor: '#fef7e6',
                border: '2px solid #f59e0b',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#92400e', fontSize: '16px', fontWeight: '700' }}>
                  🍇 Harvest Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                      Yield Amount
                    </label>
                    <input
                      type="text"
                      value={activityForm.harvest_yield}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_yield: e.target.value }))}
                      placeholder="e.g. 4.5"
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
                      value={activityForm.harvest_unit}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_unit: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="tons">tons</option>
                      <option value="tons/acre">tons/acre</option>
                      <option value="pounds">pounds</option>
                      <option value="kg">kg</option>
                      <option value="bins">bins</option>
                      <option value="lugs">lugs</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#92400e' }}>
                      Brix
                    </label>
                    <input
                      type="text"
                      value={activityForm.harvest_brix}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_brix: e.target.value }))}
                      placeholder="e.g. 24.5"
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
                      pH
                    </label>
                    <input
                      type="text"
                      value={activityForm.harvest_ph}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_ph: e.target.value }))}
                      placeholder="e.g. 3.4"
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
                      TA (optional)
                    </label>
                    <input
                      type="text"
                      value={activityForm.harvest_ta}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, harvest_ta: e.target.value }))}
                      placeholder="e.g. 6.5"
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
              </div>
            )}

            {/* Phenology Tracking */}
            {activityForm.activity_type === 'Phenology Tracking' && (
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f0f9ff',
                border: '2px solid #3b82f6',
                borderRadius: '8px'
              }}>
                <h5 style={{ margin: '0 0 12px 0', color: '#1e40af', fontSize: '16px', fontWeight: '600' }}>
                  🌱 Phenology Details
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#1e40af' }}>
                      Growth Stage *
                    </label>
                    <select
                      value={activityForm.phenology_stage}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, phenology_stage: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select stage...</option>
                      <option value="Budbreak">Budbreak</option>
                      <option value="Leaf Development">Leaf Development</option>
                      <option value="Flowering">Flowering</option>
                      <option value="Fruit Set">Fruit Set</option>
                      <option value="Berry Development">Berry Development</option>
                      <option value="Veraison">Veraison</option>
                      <option value="Harvest Maturity">Harvest Maturity</option>
                      <option value="Leaf Fall">Leaf Fall</option>
                      <option value="Dormant">Dormant</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#1e40af' }}>
                      % Complete *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="5"
                        value={activityForm.phenology_percent_complete || ''}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, phenology_percent_complete: e.target.value }))}
                        placeholder="0-100%"
                        style={{
                          width: '80px',
                          padding: '8px 12px',
                          border: '1px solid #3b82f6',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                      <span style={{ fontSize: '13px', color: '#1e40af' }}>%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={activityForm.phenology_percent_complete || '0'}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, phenology_percent_complete: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px', color: '#1e40af' }}>
                    Block/Location Estimate
                  </label>
                  <input
                    type="text"
                    value={activityForm.phenology_location || ''}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, phenology_location: e.target.value }))}
                    placeholder="e.g. Block A: 75%, Block B: 60%, Main vineyard average"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                Notes
              </label>
              <textarea
                value={activityForm.notes}
                onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add details about this event..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  minHeight: '80px',
                  resize: 'vertical',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Location Section */}
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#fefce8',
              border: '1px solid #fde68a',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MapPin size={16} />
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
                    onClick={() => setActivityForm(prev => ({
                      ...prev,
                      location_lat: null,
                      location_lng: null,
                      location_accuracy: null,
                      location_name: ''
                    }))}
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
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  style={{
                    padding: '10px 12px',
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
                    '📍 Current Location'
                  )}
                </button>

                {currentVineyard && (
                  <button
                    type="button"
                    onClick={() => setActivityForm(prev => ({
                      ...prev,
                      location_lat: currentVineyard.latitude,
                      location_lng: currentVineyard.longitude,
                      location_accuracy: null,
                      location_name: `🍇 ${currentVineyard.name}`
                    }))}
                    style={{
                      padding: '10px 12px',
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
                    🍇 Vineyard
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {editingEvent && (
                <button
                  onClick={() => {
                    setEditingEvent(null);
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
                      irrigation_measurement_method: '',
                      irrigation_measurement_value: '',
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
                      scout_action: '',
                      phenology_stage: '',
                      phenology_percent_complete: '',
                      phenology_location: '',
                      ripeness_block_estimates: '',
                      ripeness_brix: '',
                      ripeness_ph: '',
                      ripeness_ta: '',
                      ripeness_seed_brownness: '',
                    });
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}
                >
                  Cancel Edit
                </button>
              )}

              <button
                onClick={saveActivity}
                disabled={isSavingActivity || !activityForm.activity_type || !activityForm.start_date}
                style={{
                  padding: '12px 24px',
                  backgroundColor: (!activityForm.activity_type || !activityForm.start_date) ? '#d1d5db' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!activityForm.activity_type || !activityForm.start_date) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isSavingActivity ? 0.7 : 1
                }}
              >
                {isSavingActivity ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                ) : (
                  isSavingActivity ? 'Saving...' : (editingEvent ? 'Update Event' : 'Save Activity')
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const HistoryTab = () => {
    const filteredActivities = eventTypeFilter === 'all'
      ? activities
      : activities.filter(activity => activity.event_type === eventTypeFilter);

    // Complete event type mapping with all possible types
    const eventTypeEmojis: { [key: string]: string } = {
      'spray_application': '🌿',
      'fertilization': '🌱',
      'irrigation': '💧',
      'canopy_management': '✂️',
      'scouting': '🔍',
      'harvest': '🍇',
      'phenology': '🌱', // Added for phenology
      'ripeness': '🍇', // Added for ripeness
      'budbreak': '🌿',
      'bloom': '🌸',
      'fruit_set': '🍇',
      'veraison': '🍷',
      'pruning': '✂️',
      'soil_work': '🌍',
      'equipment_maintenance': '🔧',
      'pest': '🐞',
      'other': '📝',
      // Legacy/alternative naming
      'Spray Application': '🌿',
      'Fertilization': '🌱',
      'Irrigation': '💧',
      'Canopy Management': '✂️',
      'Scouting': '🔍',
      'Harvest': '🍇',
      'Phenology Tracking': '🌱',
      'Ripeness Tracking': '🍇',
      'Bud Break': '🌿',
      'Bloom': '🌸',
      'Fruit Set': '🍇',
      'Veraison': '🍷',
      'Pruning': '✂️',
      'Soil Work': '🌍',
      'Equipment Maintenance': '🔧',
      'Pest': '🐞',
      'Other': '📝'
    };

    const eventTypeNames: { [key: string]: string } = {
      'spray_application': 'Spray Application',
      'fertilization': 'Fertilization',
      'irrigation': 'Irrigation',
      'canopy_management': 'Canopy Management',
      'scouting': 'Scouting',
      'harvest': 'Harvest',
      'phenology': 'Phenology', // Added for phenology
      'ripeness': 'Ripeness', // Added for ripeness
      'budbreak': 'Bud Break',
      'bloom': 'Bloom',
      'fruit_set': 'Fruit Set',
      'veraison': 'Veraison',
      'pruning': 'Pruning',
      'soil_work': 'Soil Work',
      'equipment_maintenance': 'Equipment Maintenance',
      'pest': 'Pest Observation',
      'other': 'Other',
      // Legacy/alternative naming
      'Spray Application': 'Spray Application',
      'Fertilization': 'Fertilization',
      'Irrigation': 'Irrigation',
      'Canopy Management': 'Canopy Management',
      'Scouting': 'Scouting',
      'Harvest': 'Harvest',
      'Phenology Tracking': 'Phenology Tracking',
      'Ripeness Tracking': 'Ripeness Tracking',
      'Bud Break': 'Bud Break',
      'Bloom': 'Bloom',
      'Fruit Set': 'Fruit Set',
      'Veraison': 'Veraison',
      'Pruning': 'Pruning',
      'Soil Work': 'Soil Work',
      'Equipment Maintenance': 'Equipment Maintenance',
      'Pest': 'Pest Observation',
      'Other': 'Other'
    };

    // Get unique event types from activities for dynamic filter
    const uniqueEventTypes = [...new Set(activities.map(a => a.event_type))].sort();

    const getEventDetails = (activity: any) => {
      let details = [];

      if (activity.spray_product) {
        details.push(`Product: ${activity.spray_product}`);
        if (activity.spray_quantity) details.push(`Amount: ${activity.spray_quantity} ${activity.spray_unit || ''}`);
        if (activity.spray_target) details.push(`Target: ${activity.spray_target}`);
      }

      if (activity.fertilizer_type) {
        details.push(`Type: ${activity.fertilizer_type}`);
        if (activity.fertilizer_npk) details.push(`NPK: ${activity.fertilizer_npk}`);
        if (activity.fertilizer_rate) details.push(`Rate: ${activity.fertilizer_rate} ${activity.fertilizer_unit || ''}`);
      }

      if (activity.irrigation_amount) {
        details.push(`Amount: ${activity.irrigation_amount} ${activity.irrigation_unit || ''}`);
        if (activity.irrigation_method) details.push(`Method: ${activity.irrigation_method}`);
        if (activity.irrigation_measurement_method) details.push(`Measurement: ${activity.irrigation_measurement_method}`);
        if (activity.irrigation_measurement_value) details.push(`Value: ${activity.irrigation_measurement_value}`);
      }

      if (activity.ripeness_brix || activity.ripeness_ph || activity.ripeness_ta || activity.ripeness_seed_brownness || activity.ripeness_block_estimates) {
        details.push('Ripeness:');
        if (activity.ripeness_brix) details.push(` Brix: ${activity.ripeness_brix}°`);
        if (activity.ripeness_ph) details.push(` pH: ${activity.ripeness_ph}`);
        if (activity.ripeness_ta) details.push(` TA: ${activity.ripeness_ta}`);
        if (activity.ripeness_seed_brownness) details.push(` Seed Brownness: ${activity.ripeness_seed_brownness}`);
        if (activity.ripeness_block_estimates) details.push(` Block Estimates: ${activity.ripeness_block_estimates}`);
      }

      if (activity.phenology_stage) {
        details.push(`Phenology: ${activity.phenology_stage}`);
        if (activity.phenology_percent_complete) details.push(`${activity.phenology_percent_complete}% Complete`);
        if (activity.phenology_location) details.push(`Block Estimates: ${activity.phenology_location}`);
      }


      if (activity.harvest_yield) {
        details.push(`Yield: ${activity.harvest_yield} ${activity.harvest_unit || ''}`);
        if (activity.harvest_brix) details.push(`Brix: ${activity.harvest_brix}°`);
      }

      if (activity.canopy_activity) {
        details.push(`Activity: ${activity.canopy_activity}`);
        if (activity.canopy_intensity) details.push(`Intensity: ${activity.canopy_intensity}`);
      }

      if (activity.scout_focus) {
        details.push(`Focus: ${activity.scout_focus}`);
        if (activity.scout_severity) details.push(`Severity: ${activity.scout_severity}`);
      }

      return details;
    };

    const startEditEvent = (activity: any) => {
      setEditingEvent(activity);
      setShowActivityForm(true);
      setActiveTab('log'); // Switch to log tab when editing
      setActivityForm({
        activity_type: eventTypeNames[activity.event_type] || activity.event_type,
        start_date: activity.event_date,
        end_date: activity.end_date || '',
        notes: activity.notes || '',
        location_lat: activity.location_lat || null,
        location_lng: activity.location_lng || null,
        location_name: activity.location_name || '',
        location_accuracy: activity.location_accuracy || null,
        spray_product: activity.spray_product || '',
        spray_quantity: activity.spray_quantity || '',
        spray_unit: activity.spray_unit || 'oz/acre',
        spray_target: activity.spray_target || '',
        spray_conditions: activity.spray_conditions || '',
        spray_equipment: activity.spray_equipment || '',
        irrigation_amount: activity.irrigation_amount || '',
        irrigation_unit: activity.irrigation_unit || 'inches',
        irrigation_method: activity.irrigation_method || '',
        irrigation_duration: activity.irrigation_duration || '',
        irrigation_measurement_method: activity.irrigation_measurement_method || '',
        irrigation_measurement_value: activity.irrigation_measurement_value || '',
        fertilizer_type: activity.fertilizer_type || '',
        fertilizer_npk: activity.fertilizer_npk || '',
        fertilizer_rate: activity.fertilizer_rate || '',
        fertilizer_unit: activity.fertilizer_unit || 'lbs/acre',
        fertilizer_method: activity.fertilizer_method || '',
        harvest_yield: activity.harvest_yield || '',
        harvest_unit: activity.harvest_unit || 'tons/acre',
        harvest_brix: activity.harvest_brix || '',
        harvest_ph: activity.harvest_ph || '',
        harvest_ta: activity.harvest_ta || '',
        harvest_block: activity.harvest_block || '',
        canopy_activity: activity.canopy_activity || '',
        canopy_intensity: activity.canopy_intensity || '',
        canopy_side: activity.canopy_side || '',
        canopy_stage: activity.canopy_stage || '',
        scout_focus: activity.scout_focus || '',
        scout_severity: activity.scout_severity || '',
        scout_distribution: activity.scout_distribution || '',
        scout_action: activity.scout_action || '',
        phenology_stage: activity.phenology_stage || '',
        phenology_percent_complete: activity.phenology_percent_complete || '',
        phenology_location: activity.phenology_location || '',
        ripeness_block_estimates: activity.ripeness_block_estimates || '',
        ripeness_brix: activity.ripeness_brix || '',
        ripeness_ph: activity.ripeness_ph || '',
        ripeness_ta: activity.ripeness_ta || '',
        ripeness_seed_brownness: activity.ripeness_seed_brownness || '',
      });
    };

    const deleteEvent = async (eventId: string) => {
      if (window.confirm("Are you sure you want to delete this event?")) {
        try {
          setIsLoadingActivities(true);
          const { deletePhenologyEvent } = await import('../lib/supabase');
          await deletePhenologyEvent(eventId);
          await loadActivities();
          alert('Event deleted successfully!');
        } catch (error) {
          console.error('❌ Failed to delete event:', error);
          alert('Failed to delete event: ' + (error as Error).message);
        } finally {
          setIsLoadingActivities(false);
        }
      }
    };

    return (
      <div style={{ padding: '0 1rem 1rem 1rem' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#374151' }}>
            📅 Event History
          </h3>
          <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
            Recent vineyard activities and phenology events
          </p>
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            backgroundColor: '#f0f9ff',
            padding: '8px 12px',
            borderRadius: '6px',
            marginTop: '8px',
            border: '1px solid #bae6fd'
          }}>
            🌡️ {activities.length} events recorded • Growing degree days tracked daily
          </div>
        </div>

        {/* Filter and Refresh Controls */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white'
            }}
          >
            <option value="all">All Events ({activities.length})</option>
            {uniqueEventTypes.map(eventType => (
              <option key={eventType} value={eventType}>
                {eventTypeEmojis[eventType] || '📋'} {eventTypeNames[eventType] || eventType} ({activities.filter(a => a.event_type === eventType).length})
              </option>
            ))}
          </select>

          <button
            onClick={loadActivities}
            disabled={isLoadingActivities}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isLoadingActivities ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} style={{ animation: isLoadingActivities ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>

          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            Showing {filteredActivities.length} of {activities.length} events
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>
              {activities.filter(a => a.event_type === 'spray_application' || a.event_type === 'Spray Application').length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Spray Apps
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#7c3aed' }}>
              {activities.filter(a => a.event_type === 'fertilization' || a.event_type === 'Fertilization').length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Fertilizers
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
              {activities.filter(a => a.event_type === 'harvest' || a.event_type === 'Harvest').length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Harvests
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#ea580c' }}>
              {activities.filter(a => a.created_at && new Date(a.created_at).toDateString() === new Date().toDateString()).length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Today
            </div>
          </div>
        </div>

        {/* Event List */}
        {isLoadingActivities ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <div>Loading events...</div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
            <h4 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '18px' }}>
              {eventTypeFilter === 'all' ? 'No Events Yet' : 'No Events Found'}
            </h4>
            <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
              {eventTypeFilter === 'all'
                ? 'Start logging your vineyard activities to see them here'
                : `No ${eventTypeNames[eventTypeFilter] || eventTypeFilter.replace('_', ' ')} events found`
              }
            </p>
            <button
              onClick={() => {
                setActiveTab('log');
                setShowActivityForm(true);
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Log First Event
            </button>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            {filteredActivities.map((activity, index) => {
              const details = getEventDetails(activity);

              return (
                <div
                  key={activity.id || index}
                  style={{
                    padding: '16px',
                    borderBottom: index < filteredActivities.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>
                        {eventTypeEmojis[activity.event_type] || '📋'}
                      </span>
                      <span style={{ fontWeight: '600', color: '#374151' }}>
                        {eventTypeNames[activity.event_type] || activity.event_type}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {new Date(activity.event_date).toLocaleDateString()}
                      </span>
                    </div>

                    {activity.notes && (
                      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                        {activity.notes}
                      </div>
                    )}

                    {details.length > 0 && (
                      <div style={{ fontSize: '12px', color: '#374151', marginBottom: '8px' }}>
                        {details.map((detail, i) => (
                          <div key={i} style={{ marginBottom: '2px' }}>• {detail}</div>
                        ))}
                      </div>
                    )}

                    {activity.location_name && (
                      <div style={{ fontSize: '12px', color: '#059669', marginBottom: '4px' }}>
                        📍 {activity.location_name}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <button
                      onClick={() => startEditEvent(activity)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                      title="Edit event"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteEvent(activity.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                      title="Delete event"
                    >
                      Delete
                    </button>

                    {activity.location_lat && activity.location_lng && (
                      <a
                        href={`https://www.google.com/maps?q=${activity.location_lat},${activity.location_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          borderRadius: '4px',
                          textDecoration: 'none',
                          fontSize: '12px'
                        }}
                        title="View on map"
                      >
                        🗺️
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const SettingsTab = () => (
    <div style={{ padding: '0 1rem 1rem 1rem' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#374151' }}>
          ⚙️ Settings
        </h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
          Manage vineyards and preferences
        </p>
      </div>

      {/* Vineyard Management */}
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb'
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
          🍇 My Vineyards
        </h4>

        {userVineyards.length > 0 ? (
          <div style={{ marginBottom: '16px' }}>
            {userVineyards.map((vineyard) => (
              <div
                key={vineyard.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: currentVineyard?.id === vineyard.id ? '#f0f9ff' : '#f8fafc',
                  border: `1px solid ${currentVineyard?.id === vineyard.id ? '#0ea5e9' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                    {currentVineyard?.id === vineyard.id ? '📍 ' : '🍇 '}{vineyard.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {vineyard.latitude.toFixed(4)}, {vineyard.longitude.toFixed(4)}
                  </div>
                </div>

                {currentVineyard?.id !== vineyard.id && (
                  <button
                    onClick={() => {
                      setCurrentVineyard(vineyard);
                      setVineyardId(vineyard.id);
                      setLatitude(vineyard.latitude);
                      setLongitude(vineyard.longitude);
                      setCustomLocation(vineyard.name);
                      localStorage.setItem('currentVineyardId', vineyard.id);
                      setActiveTab('dashboard');
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    Switch
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '2px dashed #cbd5e1',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍇</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>No vineyards yet</div>
          </div>
        )}

        <button
          onClick={() => setShowCreateVineyard(!showCreateVineyard)}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Plus size={16} />
          Add New Vineyard
        </button>
      </div>

      {/* Reports Section */}
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb'
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
          📊 Reports & Data
        </h4>

        <button
          onClick={openReportsModal}
          disabled={!currentVineyard || activities.length === 0}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: !currentVineyard || activities.length === 0 ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: !currentVineyard || activities.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '8px'
          }}
        >
          <FileText size={16} />
          Generate Reports
        </button>

        <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
          {!currentVineyard ? 'Select a vineyard first' :
           activities.length === 0 ? 'No events to report' :
           `${activities.length} events available for reporting`}
        </div>
      </div>

      {/* Data Status */}
      {lastUpdated && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f1f5f9',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
            📡 Data Status
          </h4>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
            Last updated: {lastUpdated.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
            Weather data: {weatherData.length} points loaded
          </div>
          {dateRange.start && dateRange.end && (
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Period: {dateRange.start} to {dateRange.end}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      maxWidth: '100%',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      paddingBottom: '80px' // Space for bottom tabs
    }}>
      {/* Main Content Area */}
      <div style={{ paddingTop: '1rem' }}>
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'log' && <LogEventTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>

      {/* Bottom Tab Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        zIndex: 1000
      }}>
        {[
          { id: 'dashboard', icon: Home, label: 'Dashboard', badge: safetyAlerts.length > 0 ? safetyAlerts.length : null },
          { id: 'log', icon: Plus, label: 'Log Event', badge: null },
          { id: 'history', icon: BarChart3, label: 'History', badge: activities.length > 0 ? activities.length : null },
          { id: 'settings', icon: Settings, label: 'Settings', badge: null }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                padding: '12px 8px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon
                  size={20}
                  style={{
                    color: isActive ? '#22c55e' : '#6b7280'
                  }}
                />
                {tab.badge && (
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: '600',
                    minWidth: '16px',
                    textAlign: 'center'
                  }}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: '500',
                color: isActive ? '#22c55e' : '#6b7280'
              }}>
                {tab.label}
              </span>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3px',
                  height: '3px',
                  backgroundColor: '#22c55e',
                  borderRadius: '50%'
                }}></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Reports Modal */}
      {showReportsModal && (
        <ReportsModal
          isOpen={showReportsModal}
          onClose={() => setShowReportsModal(false)}
          vineyardId={vineyardId}
          vineyardName={currentVineyard?.name || 'Unknown Vineyard'}
          activities={activities}
          weatherData={weatherData}
        />
      )}
    </div>
  );
}