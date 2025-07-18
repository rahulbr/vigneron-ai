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
                            cursor: 'pointer',
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
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                        title="Rename vineyard"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                ))}

                {/* Create new vineyard button */}
                <button
                  onClick={() => setShowCreateVineyard(true)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  ➕ Add New Vineyard
                </button>
              </div>
            </div>
          )}

          {/* Show vineyard count */}
          <div style={{ 
            fontSize: '12px', 
            color: '#6b7280',
            padding: '8px',
            backgroundColor: '#f1f5f9',
            borderRadius: '4px'
          }}>
            📊 You have {userVineyards.length} vineyard{userVineyards.length !== 1 ? 's' : ''} configured
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



      {/* Location Controls */}
      <div className="card section-spacing">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} />
          Location Settings
        </h3>

        {/* Location Search */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
            Search for Location (Google Maps):
          </label>
          <div className="flex-responsive" style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
              placeholder="e.g., Napa Valley CA, Bordeaux France, Tuscany Italy..."
              style={{ 
                flex: 1, 
                minWidth: '0'
              }}
            />
            <button
              onClick={handleLocationSearch}
              disabled={isSearching || !locationSearch.trim()}
              style={{
                backgroundColor: isSearching ? '#9ca3af' : '#4285f4',
                color: 'white',
                whiteSpace: 'nowrap'
              }}
            >
              {isSearching ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              <span className="hide-mobile">Search</span>
            </button>
          </div>
        </div>

        {/* Search Results */}
        {showSearchResults && searchResults.length > 0 && (
          <div style={{ 
            marginBottom: '15px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px', 
            backgroundColor: 'white',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: '500', fontSize: '14px', backgroundColor: '#f9fafb' }}>
              Google Maps Results:
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
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
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

        {/* Saved Locations */}
        {savedLocations.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Recent Locations:</label>
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

        {/* Manual Coordinates */}
        <div className="responsive-grid" style={{ marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Location Name:
            </label>
            <input
              type="text"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              style={{ width: '100%' }}
              placeholder="Vineyard Name or Location"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Latitude:
            </label>
            <input
              type="number"
              value={latitude}
              onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
              step="0.0001"
              style={{ width: '100%' }}
              placeholder="37.3272"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Longitude:
            </label>
            <input
              type="number"
              value={longitude}
              onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
              step="0.0001"
              style={{ width: '100%' }}
              placeholder="-122.2813"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {currentVineyard ? (
            <button
              onClick={handleManualLocationUpdate}
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
              {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={16} />}
              Update "{currentVineyard.name}" Location
            </button>
          ) : (
            <button
              onClick={createNewVineyard}
              disabled={loading || !customLocation.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: loading || !customLocation.trim() ? '#9ca3af' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !customLocation.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={16} />}
              ✨ Create New Vineyard
            </button>
          )}
        </div>
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
              {totalRainfall.toFixed(2)}"
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



      {/* Events Section - Combined Activity Log and Phenology Events */}
      {currentVineyard && (
        <div className="card section-spacing">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: '0', fontSize: '1.25rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🌱 Events
            </h3>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowEventFilterDropdown(!showEventFilterDropdown)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                🔍 Filter ({eventFilterTypes.length > 0 ? eventFilterTypes.length : 'All'})
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
                    Filter by Event Type:
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

          {/* Event Form */}
          {showActivityForm && (
            <div style={{
              padding: '20px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#374151' }}>Log New Event</h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
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
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                    Start Date *
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
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
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

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any additional details about this event..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={saveActivity}
                  disabled={isSavingActivity || !activityForm.activity_type || !activityForm.start_date}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isSavingActivity || !activityForm.activity_type || !activityForm.start_date ? '#9ca3af' : '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingActivity || !activityForm.activity_type || !activityForm.start_date ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isSavingActivity ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '💾'}
                  {isSavingActivity ? 'Saving...' : 'Save Event'}
                </button>

                <button
                  onClick={() => setShowActivityForm(false)}
                  style={{
                    padding: '8px 16px',
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

          {/* Events List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: '0', fontSize: '16px', color: '#374151' }}>
                Event History {activities.length > 0 && `(${activities.length})`}
              </h4>
              {activities.length > 0 && (
                <button
                  onClick={loadActivities}
                  disabled={isLoadingActivities}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
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
              )}
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
                    other: { color: "#9ca3af", label: "Other", emoji: "📝" },
                  };

                  const eventType = activity.event_type?.toLowerCase().replace(' ', '_') || 'other';
                  const style = eventStyles[eventType] || eventStyles.other;

                  // Calculate GDD at event date
                  const gddAtEvent = data.find(d => d.date === activity.event_date)?.gdd || 0;
                  const cumulativeGDD = data.filter(d => d.date <= activity.event_date).reduce((sum, d) => sum + d.gdd, 0);

                  return (
                    <div
                      key={activity.id || index}
                      style={{
                        padding: '15px',
                        borderBottom: index < activities.length - 1 ? '1px solid #f3f4f6' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              backgroundColor: style.color,
                              borderRadius: '50%',
                            }}
                          ></div>
                          <span style={{ fontSize: '16px', marginRight: '4px' }}>{style.emoji}</span>
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
                          {cumulativeGDD > 0 && (
                            <span style={{
                              fontSize: '11px',
                              color: '#059669',
                              padding: '2px 6px',
                              backgroundColor: '#ecfdf5',
                              borderRadius: '10px',
                              fontWeight: '500'
                            }}>
                              {Math.round(cumulativeGDD)} GDDs
                            </span>
                          )}
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

                        {activity.notes && (
                          <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.4' }}>
                            {activity.notes}
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '15px' }}>
                        {activity.created_at && (
                          <div>Logged: {new Date(activity.created_at).toLocaleDateString()}</div>
                        )}
                      </div>
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
            {!process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'AI Insights (API Key Required)' : 'Generate AI Vineyard Insights'}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
              {/* AI Recommendations */}
              {aiInsights.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#92400e' }}>
                    🎯 Recommendations
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {aiInsights.map((insight) => {
                      const colors = getInsightColor(insight.type);
                      return (
                        <div
                          key={insight.id}
                          style={{
                            padding: '12px',
                            backgroundColor: colors.bg,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                            {getInsightIcon(insight.type)}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '600', fontSize: '14px', color: colors.text, marginBottom: '4px' }}>
                                {insight.title}
                              </div>
                              <div style={{ fontSize: '13px', color: colors.text, lineHeight: '1.4' }}>
                                {insight.message}
                              </div>
                              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                                Confidence: {(insight.confidence * 100).toFixed(0)}% • {insight.category}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Weather Analysis */}
              {weatherAnalysis && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#92400e' }}>
                    🌤️ Weather Pattern Analysis
                  </h4>
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    fontSize: '13px',
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
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#92400e' }}>
                    🌱 Phenology Insights
                  </h4>
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: '#065f46'
                  }}>
                    {phenologyAnalysis}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}