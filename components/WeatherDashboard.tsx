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
    location_accuracy: null as number | null
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
    location_accuracy: null as number | null
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

      await savePhenologyEvent(
        vineyardId,
        activityForm.activity_type.toLowerCase().replace(' ', '_'),
        activityForm.start_date,
        activityForm.notes,
        activityForm.end_date || undefined,
        undefined, // harvestBlock
        locationData
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
        location_accuracy: null
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
    setEditingActivityId(activity.id);
    setEditActivityForm({
      activity_type: activity.event_type || '',
      start_date: activity.event_date || '',
      end_date: activity.end_date || '',
      notes: activity.notes || '',
      location_lat: activity.location_lat || null,
      location_lng: activity.location_lng || null,
      location_name: activity.location_name || '',
      location_accuracy: activity.location_accuracy || null
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
      location_accuracy: null
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

      // Delete the old event and create a new one (since we don't have an update function)
      const { deletePhenologyEvent, savePhenologyEvent } = await import('../lib/supabase');

      // Delete the old event
      await deletePhenologyEvent(activityId);

      // Create the updated event
      const locationData = (editActivityForm.location_lat && editActivityForm.location_lng) ? {
        latitude: editActivityForm.location_lat,
        longitude: editActivityForm.location_lng,
        locationName: editActivityForm.location_name,
        accuracy: editActivityForm.location_accuracy || undefined
      } : undefined;

      await savePhenologyEvent(
        vineyardId,
        editActivityForm.activity_type.toLowerCase().replace(' ', '_'),
        editActivityForm.start_date,
        editActivityForm.notes,
        editActivityForm.end_date || undefined,
        undefined, // harvestBlock
        locationData
      );

      // Clear editing state
      setEditingActivityId(null);
      setEditActivityForm({
        activity_type: '',
        start_date: '',
        end_date: '',
        notes: ''
      });

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
              color: dateRangeMode === 'current' ?'white' : '#374151',
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
              🌱 Event Log
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
                      // Event styles for consistent display
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

          {/* Event Form */}
          {showActivityForm && (
            <div style={{
              padding: '20px',
              backgroundColor: '#f8fafc',
              border: '2px solid #3b82f6',
              borderRadius: '12px',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#1e40af', fontSize: '18px', fontWeight: '700' }}>
                    📝 Add New Event
                  </h4>
                  <p style={{ margin: '0', fontSize: '14px', color: '#3730a3' }}>
                    Log vineyard activities with optional location check-in
                  </p>
                </div>
                {currentVineyard && (
                  <div style={{
                    padding: '8px 16px',
                    backgroundColor: '#e0f2fe',
                    border: '1px solid #7dd3fc',
                    borderRadius: '20px',
                    fontSize: '13px',
                    color: '#0369a1',
                    fontWeight: '600'
                  }}>
                    🍇 {currentVineyard.name}
                  </div>
                )}
              </div>

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

              {/* Location Check-in Section - Enhanced */}
              <div style={{ 
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#fefce8',
                border: '2px solid #facc15',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>📍</span>
                  <label style={{ fontWeight: '700', fontSize: '16px', color: '#a16207' }}>
                    Add Location (Like Dropping a Pin!)
                  </label>
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: '#fbbf24',
                    color: '#92400e',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Optional
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#a16207', marginBottom: '15px', fontStyle: 'italic' }}>
                  📱 Perfect for mobile use - record exactly where vineyard work happened
                </div>

                {/* Location Status Display */}
                {activityForm.location_lat && activityForm.location_lng ? (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#065f46', fontSize: '14px', marginBottom: '2px' }}>
                        {activityForm.location_name || 'Location Captured'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#059669' }}>
                        {activityForm.location_lat.toFixed(6)}, {activityForm.location_lng.toFixed(6)}
                        {activityForm.location_accuracy && (
                          <span style={{ marginLeft: '8px' }}>
                            (±{Math.round(activityForm.location_accuracy)}m)
                          </span>
                        )}
                      </div>
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
                        fontSize: '12px'
                      }}
                    >
                      ✕ Clear
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                      No location set for this event
                    </div>
                  </div>
                )}

                {/* Google Maps Location Search */}
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                    🗺️ Search Location (Google Maps):
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
                      placeholder="e.g., Block 5 North, Chardonnay Section..."
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleLocationSearch}
                      disabled={isSearching || !locationSearch.trim()}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: isSearching ? '#9ca3af' : '#4285f4',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isSearching || !locationSearch.trim() ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isSearching ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={12} />}
                      Search
                    </button>
                  </div>
                </div>

                {/* Search Results for Event Location */}
                {showSearchResults && searchResults.length > 0 && (
                  <div style={{ 
                    marginBottom: '10px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px', 
                    backgroundColor: 'white',
                    maxHeight: '150px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', fontWeight: '500', fontSize: '12px', backgroundColor: '#f9fafb', color: '#374151' }}>
                      Select Location:
                    </div>
                    {searchResults.map((result, index) => (
                      <div
                        key={result.placeId}
                        onClick={() => {
                          setActivityForm(prev => ({
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
                          padding: '8px 10px',
                          cursor: 'pointer',
                          borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                          fontSize: '12px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <div style={{ fontWeight: '500', marginBottom: '2px' }}>{result.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
                          {result.formattedAddress}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                          {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Location Error Display */}
                {locationError && (
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#991b1b',
                    marginBottom: '10px'
                  }}>
                    {locationError}
                  </div>
                )}

                {/* Location Action Buttons - Enhanced for Mobile */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    style={{
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
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isGettingLocation) {
                        e.currentTarget.style.backgroundColor = '#059669';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isGettingLocation) {
                        e.currentTarget.style.backgroundColor = '#10b981';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    {isGettingLocation ? (
                      <>
                        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
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
                      onClick={useVineyardLocation}
                      style={{
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
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#3b82f6';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      🍇 Use Vineyard Location
                    </button>
                  )}
                </div>

                <div style={{ fontSize: '12px', color: '#a16207', marginTop: '12px', lineHeight: '1.4', fontWeight: '500' }}>
                  💡 <strong>Pro Tip:</strong> Search for specific vineyard areas (e.g., "Block 5", "North Field"), use "Check In Here" for GPS location, or use vineyard location for general activities.
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

          {/* Add Event Button - Prominent */}
          {!showActivityForm && (
            <div style={{ 
              textAlign: 'center', 
              marginBottom: '25px',
              padding: '20px',
              backgroundColor: '#f0f9ff',
              border: '2px dashed #0ea5e9',
              borderRadius: '12px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📱</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '18px' }}>
                Ready to Log an Event?
              </h3>
              <p style={{ margin: '0 0 15px 0', color: '#0284c7', fontSize: '14px' }}>
                Add vineyard activities with location check-in (like dropping a pin in Google Maps)
              </p>
              <button
                onClick={() => setShowActivityForm(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#0ea5e9',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0284c7';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(14, 165, 233, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0ea5e9';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.3)';
                }}
              >
                📝 Add Event
              </button>
            </div>
          )}

          {/* Events List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: '0', fontSize: '16px', color: '#374151' }}>
                Event History {activities.length > 0 && `(${activities.length})`}
              </h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                {showActivityForm && (
                  <button
                    onClick={() => setShowActivityForm(false)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    ✕ Cancel
                  </button>
                )}
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
              </div>
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

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '10px' }}>
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

                            {(activity.location_lat && activity.location_lng) && (
                              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
    </div>
  );
}