
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getVineyardDetails, getUserVineyards, getPhenologyEvents } from '../lib/supabase';

interface Vineyard {
  id: string;
  name: string;
  location?: string;
  latitude: number;
  longitude: number;
  user_id?: string;
  created_at: string;
  updated_at?: string;
}

interface PhenologyEvent {
  id?: string;
  vineyard_id: string;
  event_type: string;
  event_date: string;
  end_date?: string;
  notes?: string;
  harvest_block?: string;
  is_actual?: boolean;
  created_at?: string;
}

interface VineyardContextState {
  // Current vineyard
  currentVineyard: Vineyard | null;
  vineyardId: string | null;
  
  // User's vineyards
  userVineyards: Vineyard[];
  
  // Phenology events (cached)
  phenologyEvents: PhenologyEvent[];
  phenologyEventsLoading: boolean;
  
  // Loading states
  vineyardLoading: boolean;
  vineyardsLoading: boolean;
  
  // Error states
  error: string | null;
  
  // Actions
  setVineyardId: (id: string) => void;
  refreshVineyard: () => Promise<void>;
  refreshUserVineyards: () => Promise<void>;
  refreshPhenologyEvents: () => Promise<void>;
  clearError: () => void;
}

const VineyardContext = createContext<VineyardContextState | undefined>(undefined);

export function useVineyard() {
  const context = useContext(VineyardContext);
  if (context === undefined) {
    throw new Error('useVineyard must be used within a VineyardProvider');
  }
  return context;
}

interface VineyardProviderProps {
  children: React.ReactNode;
}

export function VineyardProvider({ children }: VineyardProviderProps) {
  const [currentVineyard, setCurrentVineyard] = useState<Vineyard | null>(null);
  const [vineyardId, setVineyardIdState] = useState<string | null>(null);
  const [userVineyards, setUserVineyards] = useState<Vineyard[]>([]);
  const [phenologyEvents, setPhenologyEvents] = useState<PhenologyEvent[]>([]);
  
  const [vineyardLoading, setVineyardLoading] = useState(false);
  const [vineyardsLoading, setVineyardsLoading] = useState(false);
  const [phenologyEventsLoading, setPhenologyEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load vineyard data
  const refreshVineyard = useCallback(async () => {
    if (!vineyardId) return;

    setVineyardLoading(true);
    setError(null);

    try {
      const vineyard = await getVineyardDetails(vineyardId);
      setCurrentVineyard(vineyard);
      
      // Store in localStorage for persistence
      if (vineyard) {
        localStorage.setItem('current_vineyard_data', JSON.stringify(vineyard));
      }
    } catch (error) {
      console.error('Failed to load vineyard:', error);
      setError('Failed to load vineyard data');
    } finally {
      setVineyardLoading(false);
    }
  }, [vineyardId]);

  // Load user's vineyards
  const refreshUserVineyards = useCallback(async () => {
    setVineyardsLoading(true);
    setError(null);

    try {
      const vineyards = await getUserVineyards();
      setUserVineyards(vineyards);
      
      // Cache in localStorage
      localStorage.setItem('user_vineyards', JSON.stringify(vineyards));
    } catch (error) {
      console.error('Failed to load user vineyards:', error);
      setError('Failed to load vineyards');
    } finally {
      setVineyardsLoading(false);
    }
  }, []);

  // Load phenology events with caching
  const refreshPhenologyEvents = useCallback(async () => {
    if (!vineyardId) return;

    setPhenologyEventsLoading(true);
    setError(null);

    try {
      const events = await getPhenologyEvents(vineyardId);
      setPhenologyEvents(events);
      
      // Cache events with timestamp
      const cacheData = {
        events,
        timestamp: Date.now(),
        vineyardId
      };
      localStorage.setItem(`phenology_events_${vineyardId}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to load phenology events:', error);
      setError('Failed to load phenology events');
    } finally {
      setPhenologyEventsLoading(false);
    }
  }, [vineyardId]);

  // Set vineyard ID and persist
  const setVineyardId = useCallback((id: string) => {
    setVineyardIdState(id);
    localStorage.setItem('current_vineyard_id', id);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize from localStorage
  useEffect(() => {
    // Load vineyard ID
    const storedVineyardId = localStorage.getItem('current_vineyard_id') || 
                            '8a7802ad-566f-417a-ad24-3df7d006ecf4';
    setVineyardIdState(storedVineyardId);

    // Load cached vineyard data
    const cachedVineyard = localStorage.getItem('current_vineyard_data');
    if (cachedVineyard) {
      try {
        setCurrentVineyard(JSON.parse(cachedVineyard));
      } catch (error) {
        console.warn('Failed to parse cached vineyard data');
      }
    }

    // Load cached user vineyards
    const cachedVineyards = localStorage.getItem('user_vineyards');
    if (cachedVineyards) {
      try {
        setUserVineyards(JSON.parse(cachedVineyards));
      } catch (error) {
        console.warn('Failed to parse cached vineyards');
      }
    }

    // Load cached phenology events
    const cachedEvents = localStorage.getItem(`phenology_events_${storedVineyardId}`);
    if (cachedEvents) {
      try {
        const { events, timestamp } = JSON.parse(cachedEvents);
        // Use cached data if less than 30 minutes old
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          setPhenologyEvents(events);
        }
      } catch (error) {
        console.warn('Failed to parse cached phenology events');
      }
    }
  }, []);

  // Load data when vineyard ID changes
  useEffect(() => {
    if (vineyardId) {
      refreshVineyard();
      refreshPhenologyEvents();
    }
  }, [vineyardId, refreshVineyard, refreshPhenologyEvents]);

  // Load user vineyards on mount
  useEffect(() => {
    refreshUserVineyards();
  }, [refreshUserVineyards]);

  const contextValue: VineyardContextState = {
    currentVineyard,
    vineyardId,
    userVineyards,
    phenologyEvents,
    phenologyEventsLoading,
    vineyardLoading,
    vineyardsLoading,
    error,
    setVineyardId,
    refreshVineyard,
    refreshUserVineyards,
    refreshPhenologyEvents,
    clearError
  };

  return (
    <VineyardContext.Provider value={contextValue}>
      {children}
    </VineyardContext.Provider>
  );
}
