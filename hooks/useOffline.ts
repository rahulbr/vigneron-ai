
// Hook for offline state management
import { useState, useEffect, useCallback } from 'react';
import { offlineStorage } from '../lib/offlineStorage';

interface OfflineState {
  isOnline: boolean;
  isOfflineReady: boolean;
  queuedActions: number;
  lastSyncTime: Date | null;
  error: string | null;
}

interface SyncResult {
  success: boolean;
  syncedActions: number;
  failedActions: number;
  errors: string[];
}

export function useOffline() {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOfflineReady: false,
    queuedActions: 0,
    lastSyncTime: null,
    error: null
  });

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered:', registration);
        
        // Enable background sync if supported
        if ('sync' in window.ServiceWorkerRegistration.prototype) {
          console.log('🔄 Background sync supported');
        }
        
        setOfflineState(prev => ({ 
          ...prev, 
          isOfflineReady: true,
          error: null 
        }));
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
        setOfflineState(prev => ({ 
          ...prev, 
          error: 'Failed to enable offline mode',
          isOfflineReady: false 
        }));
      }
    } else {
      setOfflineState(prev => ({ 
        ...prev, 
        error: 'Offline mode not supported in this browser',
        isOfflineReady: false 
      }));
    }
  }, []);

  // Handle online/offline events
  const handleOnline = useCallback(() => {
    console.log('🌐 Connection restored');
    setOfflineState(prev => ({ ...prev, isOnline: true }));
    
    // Trigger background sync when coming back online
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        return registration.sync.register('vineyard-data-sync');
      }).catch(console.error);
    }
    
    // Sync queued actions
    syncQueuedActions();
  }, []);

  const handleOffline = useCallback(() => {
    console.log('📱 Connection lost - switching to offline mode');
    setOfflineState(prev => ({ ...prev, isOnline: false }));
  }, []);

  // Sync queued actions when back online
  const syncQueuedActions = useCallback(async (): Promise<SyncResult> => {
    const result: SyncResult = {
      success: false,
      syncedActions: 0,
      failedActions: 0,
      errors: []
    };

    try {
      const queuedActions = await offlineStorage.getQueuedActions();
      console.log(`🔄 Syncing ${queuedActions.length} queued actions...`);

      for (const action of queuedActions) {
        try {
          // Attempt to execute the queued action
          const response = await fetch(action.url, {
            method: action.method,
            headers: {
              'Content-Type': 'application/json',
              ...action.headers
            },
            body: action.data ? JSON.stringify(action.data) : undefined
          });

          if (response.ok) {
            // Success - remove from queue
            await offlineStorage.removeQueuedAction(action.id!);
            result.syncedActions++;
            console.log(`✅ Synced action: ${action.method} ${action.url}`);
          } else {
            // Server error - update retry count
            const newRetryCount = action.retryCount + 1;
            
            if (newRetryCount >= action.maxRetries) {
              // Max retries reached - remove from queue
              await offlineStorage.removeQueuedAction(action.id!);
              result.failedActions++;
              result.errors.push(`Max retries reached for ${action.method} ${action.url}`);
              console.error(`❌ Max retries for action: ${action.method} ${action.url}`);
            } else {
              // Update retry count
              await offlineStorage.updateRetryCount(action.id!, newRetryCount);
              console.log(`⚠️ Retry ${newRetryCount}/${action.maxRetries} for: ${action.method} ${action.url}`);
            }
          }
        } catch (error) {
          // Network or other error - update retry count
          const newRetryCount = action.retryCount + 1;
          
          if (newRetryCount >= action.maxRetries) {
            await offlineStorage.removeQueuedAction(action.id!);
            result.failedActions++;
            result.errors.push(`Network error for ${action.method} ${action.url}: ${error}`);
          } else {
            await offlineStorage.updateRetryCount(action.id!, newRetryCount);
          }
        }
      }

      result.success = result.errors.length === 0;
      
      // Update sync time and queued actions count
      const stats = await offlineStorage.getStorageStats();
      setOfflineState(prev => ({ 
        ...prev, 
        queuedActions: stats.queuedActions,
        lastSyncTime: new Date(),
        error: result.success ? null : `Sync completed with ${result.errors.length} errors`
      }));

      console.log('🎯 Sync completed:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      result.errors.push(`Sync process failed: ${error}`);
      setOfflineState(prev => ({ 
        ...prev, 
        error: 'Sync failed - will retry later'
      }));
      return result;
    }
  }, []);

  // Get queued actions count
  const updateQueuedActionsCount = useCallback(async () => {
    try {
      const stats = await offlineStorage.getStorageStats();
      setOfflineState(prev => ({ 
        ...prev, 
        queuedActions: stats.queuedActions 
      }));
    } catch (error) {
      console.error('❌ Failed to update queued actions count:', error);
    }
  }, []);

  // Cache data for offline use
  const cacheData = useCallback(async (
    key: string, 
    data: any, 
    type: 'weather' | 'activities' | 'vineyards', 
    expiryHours = 24
  ) => {
    try {
      await offlineStorage.setOfflineData(key, data, type, expiryHours);
      console.log('💾 Cached data for offline use:', key, type);
    } catch (error) {
      console.error('❌ Failed to cache data:', error);
    }
  }, []);

  // Get cached data
  const getCachedData = useCallback(async (key: string) => {
    try {
      return await offlineStorage.getOfflineData(key);
    } catch (error) {
      console.error('❌ Failed to get cached data:', error);
      return null;
    }
  }, []);

  // Queue action for later sync
  const queueAction = useCallback(async (
    method: string, 
    url: string, 
    data: any, 
    headers: any = {}
  ) => {
    try {
      await offlineStorage.queueAction(method, url, data, headers);
      await updateQueuedActionsCount();
      console.log('📝 Action queued for sync:', method, url);
    } catch (error) {
      console.error('❌ Failed to queue action:', error);
    }
  }, [updateQueuedActionsCount]);

  // Initialize offline functionality
  useEffect(() => {
    registerServiceWorker();
    updateQueuedActionsCount();

    // Set up online/offline event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [registerServiceWorker, handleOnline, handleOffline, updateQueuedActionsCount]);

  return {
    ...offlineState,
    syncQueuedActions,
    cacheData,
    getCachedData,
    queueAction,
    refreshQueueCount: updateQueuedActionsCount
  };
}

// Hook for offline-first data fetching
export function useOfflineFirst<T>(
  key: string,
  fetchFunction: () => Promise<T>,
  cacheType: 'weather' | 'activities' | 'vineyards' = 'weather',
  cacheHours = 24
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  
  const { isOnline, cacheData, getCachedData } = useOffline();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Always try cache first
      const cachedData = await getCachedData(key);
      
      if (cachedData) {
        setData(cachedData);
        setFromCache(true);
        setLoading(false);
        console.log('📱 Using cached data:', key);
        
        // If online, still try to fetch fresh data in background
        if (isOnline) {
          try {
            const freshData = await fetchFunction();
            await cacheData(key, freshData, cacheType, cacheHours);
            setData(freshData);
            setFromCache(false);
            console.log('🔄 Updated with fresh data:', key);
          } catch (error) {
            console.log('⚠️ Fresh data fetch failed, using cached data');
            // Keep using cached data
          }
        }
      } else if (isOnline) {
        // No cache and online - fetch fresh data
        const freshData = await fetchFunction();
        await cacheData(key, freshData, cacheType, cacheHours);
        setData(freshData);
        setFromCache(false);
        setLoading(false);
        console.log('🌐 Fetched fresh data:', key);
      } else {
        // No cache and offline
        setError('No cached data available offline');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Data fetch error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
      setLoading(false);
    }
  }, [key, fetchFunction, cacheType, cacheHours, isOnline, cacheData, getCachedData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    fromCache,
    refetch: fetchData
  };
}
