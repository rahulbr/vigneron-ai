
// Enhanced offline synchronization service for vineyard data
import { offlineStorage } from './offlineStorage';
import { supabase } from './supabase';

interface SyncResult {
  success: boolean;
  synced: number;
  conflicts: number;
  errors: string[];
  conflictData?: any[];
}

interface SyncOptions {
  vineyardId?: string;
  type?: 'weather' | 'activities' | 'vineyards';
  priority?: 'high' | 'medium' | 'low';
  batchSize?: number;
  timeout?: number;
}

export class OfflineSyncService {
  private static instance: OfflineSyncService;
  private syncInProgress = false;
  private syncQueue: (() => Promise<void>)[] = [];

  static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  // Main synchronization method
  async syncData(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log('🔄 Sync already in progress, queuing...');
      return new Promise((resolve) => {
        this.syncQueue.push(async () => {
          const result = await this.performSync(options);
          resolve(result);
        });
      });
    }

    return this.performSync(options);
  }

  private async performSync(options: SyncOptions): Promise<SyncResult> {
    this.syncInProgress = true;
    
    const result: SyncResult = {
      success: false,
      synced: 0,
      conflicts: 0,
      errors: [],
      conflictData: []
    };

    try {
      console.log('🔄 Starting offline sync...', options);

      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        result.errors.push('Not authenticated - cannot sync');
        return result;
      }

      // Get unsynced data
      const unsyncedData = await offlineStorage.getUnsyncedData(options.vineyardId);
      
      if (unsyncedData.length === 0) {
        console.log('✅ No data to sync');
        result.success = true;
        return result;
      }

      // Filter by type and priority if specified
      let dataToSync = unsyncedData;
      if (options.type) {
        dataToSync = dataToSync.filter(item => item.type === options.type);
      }
      if (options.priority) {
        dataToSync = dataToSync.filter(item => item.priority === options.priority);
      }

      // Batch sync with size limit
      const batchSize = options.batchSize || 10;
      const batches = this.createBatches(dataToSync, batchSize);

      for (const batch of batches) {
        await this.syncBatch(batch, result);
        
        // Check timeout
        if (options.timeout && Date.now() > (Date.now() + options.timeout)) {
          result.errors.push('Sync timeout reached');
          break;
        }
      }

      result.success = result.errors.length === 0;
      console.log('🎯 Sync completed:', result);

    } catch (error) {
      console.error('❌ Sync failed:', error);
      result.errors.push(`Sync process failed: ${error}`);
    } finally {
      this.syncInProgress = false;
      
      // Process queued syncs
      if (this.syncQueue.length > 0) {
        const nextSync = this.syncQueue.shift();
        if (nextSync) {
          setTimeout(() => nextSync(), 100);
        }
      }
    }

    return result;
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private async syncBatch(batch: any[], result: SyncResult): Promise<void> {
    const promises = batch.map(item => this.syncSingleItem(item, result));
    await Promise.allSettled(promises);
  }

  private async syncSingleItem(item: any, result: SyncResult): Promise<void> {
    try {
      switch (item.type) {
        case 'activities':
          await this.syncActivity(item, result);
          break;
        case 'vineyards':
          await this.syncVineyard(item, result);
          break;
        case 'weather':
          // Weather data is typically read-only, skip sync
          await offlineStorage.markAsSynced(item.id);
          result.synced++;
          break;
        default:
          console.warn('⚠️ Unknown data type for sync:', item.type);
      }
    } catch (error) {
      console.error('❌ Failed to sync item:', item.key, error);
      result.errors.push(`Failed to sync ${item.key}: ${error}`);
    }
  }

  private async syncActivity(item: any, result: SyncResult): Promise<void> {
    const activityData = item.data;
    
    try {
      // Check if activity already exists on server
      const { data: existingActivity } = await supabase
        .from('phenology_events')
        .select('*')
        .eq('id', activityData.id)
        .maybeSingle();

      if (existingActivity) {
        // Handle conflict
        const resolvedData = await offlineStorage.resolveConflict(
          item,
          existingActivity,
          item.conflictStrategy
        );

        if (resolvedData.__conflict) {
          // Manual resolution required
          result.conflicts++;
          if (!result.conflictData) result.conflictData = [];
          result.conflictData.push({
            type: 'activity',
            id: activityData.id,
            ...resolvedData
          });
          return;
        }

        // Update existing activity
        const { error } = await supabase
          .from('phenology_events')
          .update(resolvedData)
          .eq('id', activityData.id);

        if (error) throw error;
        
      } else {
        // Create new activity
        const { error } = await supabase
          .from('phenology_events')
          .insert(activityData);

        if (error) throw error;
      }

      await offlineStorage.markAsSynced(item.id);
      result.synced++;
      console.log('✅ Synced activity:', activityData.id);

    } catch (error) {
      throw new Error(`Activity sync failed: ${error}`);
    }
  }

  private async syncVineyard(item: any, result: SyncResult): Promise<void> {
    const vineyardData = item.data;
    
    try {
      // Check if vineyard already exists
      const { data: existingVineyard } = await supabase
        .from('vineyards')
        .select('*')
        .eq('id', vineyardData.id)
        .maybeSingle();

      if (existingVineyard) {
        // Handle conflict
        const resolvedData = await offlineStorage.resolveConflict(
          item,
          existingVineyard,
          item.conflictStrategy
        );

        if (resolvedData.__conflict) {
          result.conflicts++;
          if (!result.conflictData) result.conflictData = [];
          result.conflictData.push({
            type: 'vineyard',
            id: vineyardData.id,
            ...resolvedData
          });
          return;
        }

        // Update existing vineyard
        const { error } = await supabase
          .from('vineyards')
          .update(resolvedData)
          .eq('id', vineyardData.id);

        if (error) throw error;
        
      } else {
        // Create new vineyard
        const { error } = await supabase
          .from('vineyards')
          .insert(vineyardData);

        if (error) throw error;
      }

      await offlineStorage.markAsSynced(item.id);
      result.synced++;
      console.log('✅ Synced vineyard:', vineyardData.id);

    } catch (error) {
      throw new Error(`Vineyard sync failed: ${error}`);
    }
  }

  // Sync specific vineyard data
  async syncVineyardData(vineyardId: string): Promise<SyncResult> {
    return this.syncData({ vineyardId });
  }

  // Priority sync for critical data
  async syncHighPriority(): Promise<SyncResult> {
    return this.syncData({ priority: 'high', batchSize: 5 });
  }

  // Background sync with low priority
  async backgroundSync(): Promise<SyncResult> {
    return this.syncData({ 
      priority: 'low', 
      batchSize: 20,
      timeout: 30000 // 30 second timeout
    });
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    hasUnsyncedData: boolean;
    unsyncedCount: number;
    lastSyncTime: Date | null;
    conflicts: number;
  }> {
    const unsyncedData = await offlineStorage.getUnsyncedData();
    const stats = await offlineStorage.getStorageStats();
    
    return {
      hasUnsyncedData: unsyncedData.length > 0,
      unsyncedCount: unsyncedData.length,
      lastSyncTime: null, // Could be tracked in localStorage
      conflicts: unsyncedData.filter(item => item.conflictStrategy === 'manual').length
    };
  }
}

export const offlineSyncService = OfflineSyncService.getInstance();
