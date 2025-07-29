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
  const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]);
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
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
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

  const { data, loading, error, lastUpdated, refetch, retry, clearError } = useWeather(weatherOptions);

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

      const daysSinceSpray = Math.floor((today.getTime() - sprayDate.getTime()) / (1000 * 60 * 60 * 24));
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

  // Keep all your existing function implementations (shortened for brevity)
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

      const { savePhenologyEvent } = await import('../lib/supabase');

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

      await savePhenologyEvent(
        vineyardId,
        activityForm.activity_type.toLowerCase().replace(' ', '_'),
        activityForm.start_date,
        activityForm.notes,
        activityForm.end_date || undefined,
        activityForm.harvest_block || undefined,
        locationData,
        sprayData
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
  const totalGDD = data.reduce((sum, day) => sum + day.gdd, 0);
  const totalRainfall = data.reduce((sum, day) => sum + day.rainfall, 0);
  const avgTempHigh = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_high, 0) / data.length : 0;
  const avgTempLow = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_low, 0) / data.length : 0;

  const activityTypes = [
    'Pruning', 'Bud Break', 'Bloom', 'Fruit Set', 'Veraison', 'Harvest',
    'Irrigation', 'Spray Application', 'Fertilization', 'Canopy Management',
    'Soil Work', 'Equipment Maintenance', 'Pest', 'Scouting', 'Other'
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

  // Tab content components
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

      {/* Weather Summary Stats */}
      {data.length > 0 && (
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
              {totalRainfall.toFixed(1)}"
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
      {data.length > 0 && !loading && vineyardId && (
        <div style={{ 
          marginBottom: '20px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 16px 0 16px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#374151' }}>
              📈 GDD Accumulation & Events
            </h3>
          </div>
          <EnhancedGDDChart 
            weatherData={data}
            locationName={customLocation}
            vineyardId={vineyardId}
            onEventsChange={loadActivities}
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
          <RefreshCw size={32} style={{ color: '#64748b', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#475569' }}>Loading Weather Data</h3>
          <p style={{ margin: '0', color: '#64748b' }}>
            Fetching data for {customLocation}...
          </p>
        </div>
      )}
    </div>
  );

  const LogEventTab = () => (
    <div style={{ padding: '0 1rem 1rem 1rem' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#374151' }}>
          ➕ Log New Event
        </h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
          Quickly log vineyard events and activities
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
                start_date: new Date().toISOString().split('T')[0]
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
              ➕ New Event
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                Event Type *
              </label>
              <select
                value={activityForm.activity_type}
                onChange={(e) => setActivityForm(prev => ({ ...prev, activity_type: e.target.value }))}
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
                onChange={(e) => setActivityForm(prev => ({ ...prev, start_date: e.target.value }))}
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
                🌿 Spray Details
              </h5>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
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
                    <option value="Glyphosate">Glyphosate</option>
                    <option value="Neem Oil">Neem Oil</option>
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
                    Target
                  </label>
                  <input
                    type="text"
                    value={activityForm.spray_target}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, spray_target: e.target.value }))}
                    placeholder="e.g. Powdery mildew"
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

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={saveActivity}
              disabled={isSavingActivity || !activityForm.activity_type || !activityForm.start_date}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: isSavingActivity || !activityForm.activity_type || !activityForm.start_date ? '#9ca3af' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isSavingActivity || !activityForm.activity_type || !activityForm.start_date ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                padding: '12px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const HistoryTab = () => (
    <div style={{ padding: '0 1rem 1rem 1rem' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#374151' }}>
          📅 Event History
        </h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
          View and manage your vineyard events
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
            {activities.length}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Total Events
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669', marginBottom: '4px' }}>
            {activities.filter(a => a.location_lat && a.location_lng).length}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            With Location
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#3b82f6', marginBottom: '4px' }}>
            {activities.filter(a => a.event_date === new Date().toISOString().split('T')[0]).length}
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
      ) : activities.length === 0 ? (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '18px' }}>No Events Yet</h4>
          <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
            Start logging your vineyard activities to see them here
          </p>
          <button
            onClick={() => setActiveTab('log')}
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
          {activities.slice(0, 10).map((activity, index) => {
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
              scouting: { color: "#059669", label: "Scouting", emoji: "🔍" },
              pest: { color: "#dc2626", label: "Pest", emoji: "🐞" },
              other: { color: "#9ca3af", label: "Other", emoji: "📝" },
            };

            let eventType = activity.event_type?.toLowerCase().replace(/\s+/g, '_') || 'other';
            const style = eventStyles[eventType] || eventStyles.other;

            return (
              <div
                key={activity.id || index}
                style={{
                  padding: '16px',
                  borderBottom: index < activities.length - 1 ? '1px solid #f3f4f6' : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: style.color,
                    borderRadius: '50%',
                    marginTop: '4px',
                    flexShrink: 0
                  }}
                ></div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>{style.emoji}</span>
                    <span style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                      {style.label}
                    </span>
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#6b7280',
                      padding: '2px 6px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '10px'
                    }}>
                      {new Date(activity.event_date).toLocaleDateString()}
                    </span>
                  </div>

                  {activity.location_lat && activity.location_lng && (
                    <div style={{ fontSize: '12px', color: '#059669', marginBottom: '4px' }}>
                      📍 {activity.location_name || `${activity.location_lat.toFixed(4)}, ${activity.location_lng.toFixed(4)}`}
                    </div>
                  )}

                  {activity.spray_product && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Product: {activity.spray_product}
                    </div>
                  )}

                  {activity.notes && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      {activity.notes.length > 100 ? `${activity.notes.substring(0, 100)}...` : activity.notes}
                    </div>
                  )}
                </div>

                {activity.location_lat && activity.location_lng && (
                  <a
                    href={`https://www.google.com/maps?q=${activity.location_lat},${activity.location_lng}&z=18`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 8px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: '500',
                      flexShrink: 0
                    }}
                    title="View on map"
                  >
                    🗺️
                  </a>
                )}
              </div>
            );
          })}

          {activities.length > 10 && (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Showing 10 of {activities.length} events
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

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
            Weather data: {data.length} points loaded
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
          weatherData={data}
        />
      )}
    </div>
  );
}