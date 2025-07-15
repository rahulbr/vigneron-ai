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
  const [isLoadingVineyards, setIsLoadingVineyards] = useState(true);
  const [showCreateVineyard, setShowCreateVineyard] = useState(false);
  const [editingVineyardId, setEditingVineyardId] = useState<string | null>(null);
  const [editingVineyardName, setEditingVineyardName] = useState('');

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
    notes: ''
  });
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);

  // Event filtering for Events section
  const [eventFilterTypes, setEventFilterTypes] = useState<string[]>([]);
  const [showEventFilterDropdown, setShowEventFilterDropdown] = useState(false);

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
  };

  // Cancel editing a vineyard name
  const cancelEditingVineyard = () => {
    setEditingVineyardId(null);
    setEditingVineyardName('');
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

    // For current year: April 1 to today (growing season)
    const startDate = `${currentYear}-04-01`;
    const endDate = today; // Only up to today

    console.log('📅 Setting current year growing season (April 1 to today):', { 
      startDate, 
      endDate, 
      year: currentYear,
      note: 'Growing season data - starts April 1st'
    });

    setDateRange({
      start: startDate,
      end: endDate
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

  // Load activities when vineyard changes
  useEffect(() => {
    if (vineyardId) {
      loadActivities();
    }
  }, [vineyardId]);

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

      await savePhenologyEvent(
        vineyardId,
        activityForm.activity_type.toLowerCase().replace(' ', '_'),
        activityForm.start_date,
        activityForm.notes,
        activityForm.end_date || undefined
      );

      // Reset form
      setActivityForm({
        activity_type: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: ''
      });
      setShowActivityForm(false);

      // Reload activities
      await loadActivities();

      console.log('✅ Activity saved successfully');
    } catch (error) {
      console.error('❌ Failed to save activity:', error);
      alert('Failed to save activity: ' + (error as Error).message);
    } finally {
      setIsSavingActivity(false);
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
    'Other'
  ];

  // Generate AI insights based on current vineyard data
  const generateAIInsights = async () => {
    if (!data || data.length === 0) return;

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
      } else {
        alert('❌ Failed to generate AI insights\n\n' + errorMessage);
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

  // Handle manual coordinate update
  const handleManualLocationUpdate = async () => {
    if (!currentVineyard) {
      alert('Please create a vineyard first or select an existing one.');
      return;
    }

    try {
      console.log('📍 Updating vineyard location:', { vineyard: currentVineyard.name, latitude, longitude, customLocation });

      const { saveVineyardLocation } = await import('../lib/supabase');
      const updatedVineyard = await saveVineyardLocation(
        currentVineyard.id,
        latitude,
        longitude,
        customLocation
      );

      // Update the vineyard in our local state
      setUserVineyards(prev => prev.map(v => v.id === currentVineyard.id ? updatedVineyard : v));
      setCurrentVineyard(updatedVineyard);

      console.log('✅ Vineyard location updated:', updatedVineyard);

      clearError();
      if (isInitialized && dateRange.start && dateRange.end) {
        refetch();
      }
    } catch (error) {
      console.error('❌ Error updating vineyard location:', error);
      alert('Failed to update vineyard location: ' + (error as Error).message);
    }
  };

  // Date range button handlers
  const setCurrentYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];

    const newDateRange = {
      start: `${currentYear}-04-01`, // Start from April 1st
      end: today // Only up to today
    };

    console.log('📅 Setting current year growing season (April 1 to today):', newDateRange);
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

  // Get icon for insight type
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'recommendation': return <Lightbulb size={16} style={{ color: '#059669' }} />;
      case 'warning': return <AlertTriangle size={16} style={{ color: '#dc2626' }} />;
      case 'action': return <CheckCircle size={16} style={{ color: '#2563eb' }} />;
      default: return <Info size={16} style={{ color: '#6b7280' }} />;
    }
  };

  // Get color for insight type
  const getInsightColor = (type: string) => {
    switch (type) {
      case 'recommendation': return { bg: '#f0fdf4', border: '#bbf7d0', text: '#065f46' };
      case 'warning': return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
      case 'action': return { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' };
      default: return { bg: '#f8fafc', border: '#e2e8f0', text: '#374151' };
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

      {/* Help Section - Moved to top */}
      <div className="card" style={{ 
        marginBottom: '2rem', 
        backgroundColor: '#fefce8',
        borderColor: '#fde68a'
      }}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#92400e', fontSize: '1.125rem' }}>
          💡 How to Use This Dashboard
        </h4>
        <ul style={{ margin: '0', paddingLeft: '1.25rem', color: '#92400e', fontSize: '0.875rem', lineHeight: '1.6' }}>
          <li style={{ marginBottom: '0.5rem' }}>🔍 Search for any location worldwide using Google Maps</li>
          <li style={{ marginBottom: '0.5rem' }}>📅 Select current year (YTD), previous year, or custom date range</li>
          <li style={{ marginBottom: '0.5rem' }}>📊 View growing degree days accumulation on the interactive chart</li>
          <li style={{ marginBottom: '0.5rem' }}>🌱 Click on the chart to add phenology events (bud break, bloom, etc.)</li>
          <li style={{ marginBottom: '0.5rem' }}>🤖 Click "Generate AI Vineyard Insights" for expert recommendations</li>
          <li style={{ marginBottom: '0.5rem' }}>💾 Your phenology events are saved to your personal database!</li>
          <li>🌧️ Track rainfall and temperature patterns throughout the season</li>
        </ul>

        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          backgroundColor: '#fef3cd',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#92400e'
        }}>
          <strong>🎉 Professional Features:</strong> Multi-vineyard management, persistent data storage, AI-powered insights, and mobile-optimized design for field use.
        </div>
      </div>

      {/* Vineyard Management Panel */}
      {!isLoadingVineyards && (
        <div className="card section-spacing">
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🍇 My Vineyards
          </h3>

          {/* Show create vineyard form if no current vineyard */}
          {showCreateVineyard && (
            <div style={{
              padding: '15px',
              backgroundColor: '#fefce8',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#92400e' }}>
                🆕 Create Your First Vineyard
              </h4>
              <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#92400e' }}>
                Enter a location below and click "Create New Vineyard" to get started.
              </p>
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
                  fontSize: '14px'
                }}
              >
                ✨ Create New Vineyard
              </button>
            </div>
          )}

          {/* Vineyard selector */}
          {userVineyards.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                My Vineyards:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {userVineyards.map((vineyard) => (
                  <div 
                    key={vineyard.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      backgroundColor: currentVineyard?.id === vineyard.id ? '#f0f9ff' : '#f8fafc',
                      border: `1px solid ${currentVineyard?.id === vineyard.id ? '#0ea5e9' : '#e2e8f0'}`,
                      borderRadius: '6px'
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
                          padding: '4px 8px',
                          border: '1px solid #3b82f6',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => switchVineyard(vineyard)}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: currentVineyard?.id === vineyard.id ? '600' : '400',
                          color: currentVineyard?.id === vineyard.id ? '#0369a1' : '#374151'
                        }}
                      >
                        {currentVineyard?.id === vineyard.id && '📍 '}{vineyard.name}
                      </button>
                    )}

                    {/* Edit/Save/Cancel buttons */}
                    {editingVineyardId === vineyard.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => saveVineyardName(vineyard.id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditingVineyard}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
</recursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingVineyard(vineyard)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#cbd5e1',
                          color: '#1e293b',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create new vineyard button */}
          {!showCreateVineyard && (
            <button
              onClick={() => setShowCreateVineyard(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                marginTop: '10px'
              }}
            >
              ➕ Add New Vineyard
            </button>
          )}
        </div>
      )}

      {/* Location Search and Display */}
      <div className="card section-spacing">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} /> Location
        </h3>

        {/* Location Search Bar */}
        <div style={{ display: 'flex', marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="Search for a location"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleLocationSearch}
            disabled={isSearching || !locationSearch.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: isSearching || !locationSearch.trim() ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSearching || !locationSearch.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              marginLeft: '8px'
            }}
          >
            {isSearching ? 'Searching...' : <Search size={16} />}
          </button>
        </div>

        {/* Search Results */}
        {showSearchResults && (
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#4b5563' }}>
              Search Results:
            </h4>
            {searchResults.length > 0 ? (
              <ul style={{ margin: '0', padding: '0', listStyle: 'none' }}>
                {searchResults.map((result) => (
                  <li
                    key={result.placeId}
                    onClick={() => selectLocation(result)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      marginBottom: '5px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#374151'
                    }}
                  >
                    {result.name} ({result.latitude.toFixed(4)}, {result.longitude.toFixed(4)})
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '14px', color: '#6b7280' }}>No results found.</p>
            )}
          </div>
        )}

        {/* Manual Coordinate Input */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
          <div>
            <label htmlFor="latitude" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
              Latitude:
            </label>
            <input
              type="number"
              id="latitude"
              value={latitude}
              onChange={(e) => setLatitude(parseFloat(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label htmlFor="longitude" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
              Longitude:
            </label>
            <input
              type="number"
              id="longitude"
              value={longitude}
              onChange={(e) => setLongitude(parseFloat(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <label htmlFor="customLocation" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
              Location Name:
          </label>
          <input
              type="text"
              id="customLocation"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '15px'
              }}
            />
            <button
              onClick={handleManualLocationUpdate}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Update Location
            </button>
        </div>
        {/* Saved Locations */}
        {savedLocations.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#4b5563' }}>
              Recent Locations:
            </h4>
            <ul style={{ margin: '0', padding: '0', listStyle: 'none' }}>
              {savedLocations.map((location) => (
                <li
                  key={location.placeId}
                  onClick={() => selectLocation(location)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    marginBottom: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151'
                  }}
                >
                  {location.name} ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Date Range Selection */}
      <div className="card section-spacing">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} /> Date Range
        </h3>

        {/* Date Range Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button
            onClick={setCurrentYear}
            disabled={dateRangeMode === 'current'}
            style={{
              padding: '8px 16px',
              backgroundColor: dateRangeMode === 'current' ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: dateRangeMode === 'current' ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            Current Year ({currentYear})
          </button>
          <button
            onClick={setPreviousYear}
            disabled={dateRangeMode === 'previous'}
            style={{
              padding: '8px 16px',
              backgroundColor: dateRangeMode === 'previous' ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: dateRangeMode === 'previous' ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            Previous Year ({previousYear})
          </button>
          <button
            onClick={setCustomDateRange}
            style={{
              padding: '8px 16px',
              backgroundColor: showCustomRange ? '#22c55e' : '#cbd5e1',
              color: showCustomRange ? 'white' : '#4b5563',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Custom Range
          </button>
        </div>

        {/* Custom Date Range Inputs */}
        {showCustomRange && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div>
              <label htmlFor="startDate" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                Start Date:
              </label>
              <input
                type="date"
                id="startDate"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label htmlFor="endDate" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                End Date:
              </label>
              <input
                type="date"
                id="endDate"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <button
              onClick={handleCustomDateRangeUpdate}
              disabled={!dateRange.start || !dateRange.end}
              style={{
                gridColumn: '1 / span 2',
                padding: '8px 16px',
                backgroundColor: !dateRange.start || !dateRange.end ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: !dateRange.start || !dateRange.end ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Update Date Range
            </button>
          </div>
        )}
      </div>

      {/* Weather Data Display */}
      <div className="card section-spacing">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Thermometer size={20} /> Weather Data
        </h3>

        {/* Loading and Error States */}
        {loading && (
          <div style={{ padding: '15px', textAlign: 'center', color: '#4b5563' }}>
            Loading weather data...
          </div>
        )}
        {error && (
          <div style={{ padding: '15px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b' }}>
            <AlertCircle size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
            Error fetching weather data: {error.message}
            <button
              onClick={retry}
              style={{
                marginLeft: '10px',
                padding: '4px 8px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Last Updated Time */}
        {lastUpdated && !loading && !error && (
          <div style={{ marginBottom: '15px', fontSize: '0.875rem', color: '#4b5563' }}>
            Last updated: {lastUpdated.toLocaleString()}
            <button
              onClick={refetch}
              style={{
                marginLeft: '10px',
                padding: '4px 8px',
                backgroundColor: '#cbd5e1',
                color: '#4b5563',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <RefreshCw size={14} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
              Refresh
            </button>
          </div>
        )}

        {/* Summary Statistics */}
        {data && data.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#065f46' }}>
              <TrendingUp size={20} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Total GDD: {totalGDD.toFixed(1)}
            </div>
            <div style={{ padding: '12px', backgroundColor: '#e0f2fe', border: '1px solid #90caf9', borderRadius: '6px', color: '#1e3a8a' }}>
              <CloudRain size={20} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Total Rainfall: {totalRainfall.toFixed(2)} mm
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', color: '#0369a1' }}>
              <Thermometer size={20} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Avg. High Temp: {avgTempHigh.toFixed(1)} °C
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', color: '#0369a1' }}>
              <Thermometer size={20} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Avg. Low Temp: {avgTempLow.toFixed(1)} °C
            </div>
          </div>
        )}

        {/* Weather Chart */}
        {data && data.length > 0 && (
          <div>
            <EnhancedGDDChart data={data} vineyardId={vineyardId} />
          </div>
        )}
      </div>

      {/* AI Insights Panel */}
      <div className="card section-spacing">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={20} /> AI Vineyard Insights
        </h3>

        {/* Generate Insights Button */}
        <button
          onClick={generateAIInsights}
          disabled={isGeneratingInsights || !data || data.length === 0}
          style={{
            padding: '8px 16px',
            backgroundColor: isGeneratingInsights || !data || data.length === 0 ? '#9ca3af' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isGeneratingInsights || !data || data.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            marginBottom: '15px'
          }}
        >
          {isGeneratingInsights ? 'Generating Insights...' : '✨ Generate AI Vineyard Insights'}
        </button>

        {/* AI Insights Display */}
        {showAIPanel && (
          <div>
            {/* Weather Analysis */}
            {weatherAnalysis && (
              <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', color: '#0369a1' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#0369a1' }}>
                  Weather Analysis:
                </h4>
                <p style={{ fontSize: '14px', color: '#374151' }}>
                  {weatherAnalysis}
                </p>
              </div>
            )}

            {/* Phenology Analysis */}
            {phenologyAnalysis && (
              <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', color: '#0369a1' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#0369a1' }}>
                  Phenology Analysis:
                </h4>
                <p style={{ fontSize: '14px', color: '#374151' }}>
                  {phenologyAnalysis}
                </p>
              </div>
            )}

            {/* Recommendations */}
            {aiInsights.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#4b5563' }}>
                  Recommendations:
                </h4>
                <ul style={{ margin: '0', padding: '0', listStyle: 'none' }}>
                  {aiInsights.map((insight, index) => {
                    const { bg, border, text } = getInsightColor(insight.type);
                    return (
                      <li
                        key={index}
                        style={{
                          padding: '12px',
                          backgroundColor: bg,
                          border: `1px solid ${border}`,
                          borderRadius: '6px',
                          marginBottom: '5px',
                          color: text,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        {getInsightIcon(insight.type)}
                        {insight.text}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="card section-spacing">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} /> Activity Log
        </h3>

        {/* Add Activity Button */}
        <button
          onClick={() => setShowActivityForm(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '15px'
          }}
        >
          ➕ Add Activity
        </button>

        {/* Activity Form */}
        {showActivityForm && (
          <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#4b5563' }}>
              Add New Activity:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div>
                <label htmlFor="activity_type" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                  Activity Type:
                </label>
                <select
                  id="activity_type"
                  value={activityForm.activity_type}
                  onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Select Activity Type</option>
                  {activityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="start_date" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                  Start Date:
                </label>
                <input
                  type="date"
                  id="start_date"
                  value={activityForm.start_date}
                  onChange={(e) => setActivityForm({ ...activityForm, start_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label htmlFor="end_date" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                  End Date (Optional):
                </label>
                <input
                  type="date"
                  id="end_date"
                  value={activityForm.end_date}
                  onChange={(e) => setActivityForm({ ...activityForm, end_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="notes" style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                Notes:
              </label>
              <textarea
                id="notes"
                value={activityForm.notes}
                onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={saveActivity}
                disabled={isSavingActivity}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isSavingActivity ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSavingActivity ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {isSavingActivity ? 'Saving...' : 'Save Activity'}
              </button>
              <button
                onClick={() => setShowActivityForm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#cbd5e1',
                  color: '#4b5563',
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

        {/* Activity List */}
        {isLoadingActivities ? (
          <div style={{ padding: '15px', textAlign: 'center', color: '#4b5563' }}>
            Loading activities...
          </div>
        ) : activities.length === 0 ? (
          <div style={{ padding: '15px', color: '#6b7280' }}>
            No activities recorded yet. Add one above!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Type
                  </th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Start Date
                  </th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    End Date
                  </th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id} style={{ borderBottom: '1px solid #f2f4f6' }}>
                    <td style={{ padding: '10px', fontSize: '14px', color: '#4b5563' }}>
                      {activity.event_type.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '10px', fontSize: '14px', color: '#4b5563' }}>
                      {new Date(activity.event_date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px', fontSize: '14px', color: '#4b5563' }}>
                      {activity.end_date ? new Date(activity.end_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '10px', fontSize: '14px', color: '#4b5563' }}>
                      {activity.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default WeatherDashboard;