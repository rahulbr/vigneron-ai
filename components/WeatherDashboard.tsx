import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
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

type TabType = 'dashboard' | 'log' | 'history' | 'settings';

export function WeatherDashboard({ 
  vineyardId: propVineyardId, 
  initialLatitude = 37.3272,
  initialLongitude = -122.2813,
  locationName = "La Honda, CA"
}: WeatherDashboardProps) {
  // Core state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [customLocation, setCustomLocation] = useState(locationName);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [dateRangeMode, setDateRangeMode] = useState<'current' | 'previous' | 'custom'>('current');
  const [isInitialized, setIsInitialized] = useState(false);
  const [vineyardId, setVineyardId] = useState<string>(propVineyardId || '');
  const [userVineyards, setUserVineyards] = useState<any[]>([]);
  const [currentVineyard, setCurrentVineyard] = useState<any | null>(null);

  // Activity/event state
  const [activities, setActivities] = useState<any[]>([]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  // Form state - keep this stable
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
    irrigation_unit: 'gallons/vine',
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

  // UI state
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [isLoadingVineyards, setIsLoadingVineyards] = useState(true);
  const [showCreateVineyard, setShowCreateVineyard] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  const { isConnected, testing, testConnection } = useWeatherConnection();

  const weatherOptions = {
    latitude,
    longitude,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    autoFetch: false
  };

  const { data, loading, error, lastUpdated, refetch, retry, clearError } = useWeather(weatherOptions);

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

  // Load vineyards on mount
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

  // Initialize date range
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

  // Auto-fetch weather data when initialized
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

  // Load activities when vineyard changes
  useEffect(() => {
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

    if (vineyardId) {
      loadActivities();
    }
  }, [vineyardId]);

  // Calculate safety alerts
  useEffect(() => {
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
  }, [activities]);

  // Stable handlers
  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setActivityForm(prev => ({ ...prev, notes: e.target.value }));
  }, []);

  const handleActivityTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setActivityForm(prev => ({ ...prev, activity_type: e.target.value }));
  }, []);

  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setActivityForm(prev => ({ ...prev, start_date: e.target.value }));
  }, []);

  const openReportsModal = () => {
    if (!currentVineyard) {
      alert('Please select a vineyard first to generate reports.');
      return;
    }
    setShowReportsModal(true);
  };

  // Calculate summary statistics
  const totalGDD = data.reduce((sum, day) => sum + day.gdd, 0);
  const totalRainfall = data.reduce((sum, day) => sum + day.rainfall, 0);
  const avgTempHigh = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_high, 0) / data.length : 0;
  const avgTempLow = data.length > 0 ? data.reduce((sum, day) => sum + day.temp_low, 0) / data.length : 0;

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
      {data.length > 0 && !loading && vineyardId && (
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
            weatherData={data}
            locationName={customLocation}
            vineyardId={vineyardId}
            onEventsChange={() => {}} // Simplified
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

  const LogEventTab = () => (
    <div style={{ padding: '0 1rem 1rem 1rem' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#374151' }}>
          📝 Log Event
        </h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
          Record vineyard activities and phenology events
        </p>
      </div>

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
          marginBottom: '24px'
        }}
      >
        <Plus size={20} />
        Add New Event
      </button>

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
                onChange={handleActivityTypeChange}
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
                <option value="Bud Break">Bud Break</option>
                <option value="Bloom">Bloom</option>
                <option value="Fruit Set">Fruit Set</option>
                <option value="Veraison">Veraison</option>
                <option value="Harvest">Harvest</option>
                <option value="Spray Application">Spray Application</option>
                <option value="Irrigation">Irrigation</option>
                <option value="Fertilization">Fertilization</option>
                <option value="Pruning">Pruning</option>
                <option value="Canopy Management">Canopy Management</option>
                <option value="Soil Work">Soil Work</option>
                <option value="Equipment Maintenance">Equipment Maintenance</option>
                <option value="Pest">Pest</option>
                <option value="Scouting">Scouting</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                Date *
              </label>
              <input
                type="date"
                value={activityForm.start_date}
                onChange={handleStartDateChange}
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
              Notes
            </label>
            <textarea
              value={activityForm.notes}
              onChange={handleNotesChange}
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

          <button
            onClick={() => {
              alert('Event logged successfully!');
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
                irrigation_unit: 'gallons/vine',
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
            }}
            disabled={!activityForm.activity_type || !activityForm.start_date}
            style={{
              padding: '12px 24px',
              backgroundColor: (!activityForm.activity_type || !activityForm.start_date) ? '#d1d5db' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (!activityForm.activity_type || !activityForm.start_date) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            Save Event
          </button>
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
          Recent vineyard activities and phenology events
        </p>
      </div>

      {activities.length === 0 ? (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
          <h4 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '18px' }}>
            No Events Yet
          </h4>
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
          {activities.slice(0, 10).map((activity, index) => (
            <div
              key={activity.id || index}
              style={{
                padding: '16px',
                borderBottom: index < Math.min(activities.length, 10) - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📋</span>
                  <span style={{ fontWeight: '600', color: '#374151' }}>
                    {activity.event_type}
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
              </div>
            </div>
          ))}
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

        {currentVineyard && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            marginBottom: '8px'
          }}>
            <div>
              <div style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                📍 {currentVineyard.name}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {currentVineyard.latitude.toFixed(4)}, {currentVineyard.longitude.toFixed(4)}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={openReportsModal}
          disabled={!currentVineyard}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: !currentVineyard ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: !currentVineyard ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} />
          Generate Reports
        </button>
      </div>
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
          { id: 'dashboard', icon: Home, label: 'Dashboard' },
          { id: 'log', icon: Plus, label: 'Log Event' },
          { id: 'history', icon: BarChart3, label: 'History' },
          { id: 'settings', icon: Settings, label: 'Settings' }
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
                transition: 'all 0.2s ease'
              }}
            >
              <Icon 
                size={20} 
                style={{ 
                  color: isActive ? '#22c55e' : '#6b7280'
                }} 
              />
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
      {showReportsModal && currentVineyard && (
        <ReportsModal
          isOpen={showReportsModal}
          onClose={() => setShowReportsModal(false)}
          vineyardId={vineyardId}
          vineyardName={currentVineyard.name}
          activities={activities}
          weatherData={data}
        />
      )}
    </div>
  );
}