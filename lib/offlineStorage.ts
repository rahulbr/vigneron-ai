
// Offline storage using IndexedDB for vineyard data
interface OfflineData {
  id?: number;
  key: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
  synced: boolean;
  type: 'weather' | 'activities' | 'vineyards' | 'queue';
}

interface QueuedAction {
  id?: number;
  method: string;
  url: string;
  data: any;
  headers: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export class OfflineStorage {
  private static instance: OfflineStorage;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'VigneronAI_OfflineDB';
  private readonly DB_VERSION = 1;
  private readonly STORES = {
    DATA: 'offline_data',
    QUEUE: 'sync_queue'
  };

  static getInstance(): OfflineStorage {
    if (!OfflineStorage.instance) {
      OfflineStorage.instance = new OfflineStorage();
    }
    return OfflineStorage.instance;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('❌ IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create offline data store
        if (!db.objectStoreNames.contains(this.STORES.DATA)) {
          const dataStore = db.createObjectStore(this.STORES.DATA, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          dataStore.createIndex('key', 'key', { unique: true });
          dataStore.createIndex('type', 'type', { unique: false });
          dataStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create sync queue store
        if (!db.objectStoreNames.contains(this.STORES.QUEUE)) {
          const queueStore = db.createObjectStore(this.STORES.QUEUE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          queueStore.createIndex('retryCount', 'retryCount', { unique: false });
        }
      };
    });
  }

  // Store data offline
  async setOfflineData(key: string, data: any, type: OfflineData['type'], expiryHours = 24): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.DATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.DATA);
      
      const offlineData: OfflineData = {
        key,
        data,
        type,
        timestamp: Date.now(),
        expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000),
        synced: true // Data coming from online source is already synced
      };

      const request = store.put(offlineData);
      
      request.onsuccess = () => {
        console.log('💾 Stored offline data:', key, type);
        resolve();
      };
      
      request.onerror = () => {
        console.error('❌ Failed to store offline data:', request.error);
        reject(request.error);
      };
    });
  }

  // Get data from offline storage
  async getOfflineData(key: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.DATA], 'readonly');
      const store = transaction.objectStore(this.STORES.DATA);
      const index = store.index('key');
      
      const request = index.get(key);
      
      request.onsuccess = () => {
        const result = request.result as OfflineData;
        
        if (!result) {
          resolve(null);
          return;
        }

        // Check if data has expired
        if (result.expiresAt && Date.now() > result.expiresAt) {
          console.log('⏰ Offline data expired:', key);
          this.deleteOfflineData(key); // Clean up expired data
          resolve(null);
          return;
        }

        console.log('📱 Retrieved offline data:', key, result.type);
        resolve(result.data);
      };
      
      request.onerror = () => {
        console.error('❌ Failed to retrieve offline data:', request.error);
        reject(request.error);
      };
    });
  }

  // Delete offline data
  async deleteOfflineData(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.DATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.DATA);
      const index = store.index('key');
      
      const getRequest = index.getKey(key);
      
      getRequest.onsuccess = () => {
        const id = getRequest.result;
        if (id) {
          const deleteRequest = store.delete(id);
          
          deleteRequest.onsuccess = () => {
            console.log('🗑️ Deleted offline data:', key);
            resolve();
          };
          
          deleteRequest.onerror = () => {
            reject(deleteRequest.error);
          };
        } else {
          resolve(); // Key not found, nothing to delete
        }
      };
      
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  // Queue action for later sync
  async queueAction(method: string, url: string, data: any, headers: any = {}): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.QUEUE], 'readwrite');
      const store = transaction.objectStore(this.STORES.QUEUE);
      
      const queuedAction: QueuedAction = {
        method,
        url,
        data,
        headers,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
      };

      const request = store.add(queuedAction);
      
      request.onsuccess = () => {
        console.log('📝 Queued action for sync:', method, url);
        resolve();
      };
      
      request.onerror = () => {
        console.error('❌ Failed to queue action:', request.error);
        reject(request.error);
      };
    });
  }

  // Get all queued actions
  async getQueuedActions(): Promise<QueuedAction[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.QUEUE], 'readonly');
      const store = transaction.objectStore(this.STORES.QUEUE);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const actions = request.result as QueuedAction[];
        console.log('📋 Retrieved queued actions:', actions.length);
        resolve(actions);
      };
      
      request.onerror = () => {
        console.error('❌ Failed to retrieve queued actions:', request.error);
        reject(request.error);
      };
    });
  }

  // Remove queued action after successful sync
  async removeQueuedAction(id: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.QUEUE], 'readwrite');
      const store = transaction.objectStore(this.STORES.QUEUE);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log('✅ Removed queued action:', id);
        resolve();
      };
      
      request.onerror = () => {
        console.error('❌ Failed to remove queued action:', request.error);
        reject(request.error);
      };
    });
  }

  // Update retry count for failed sync
  async updateRetryCount(id: number, retryCount: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.QUEUE], 'readwrite');
      const store = transaction.objectStore(this.STORES.QUEUE);
      
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const action = getRequest.result as QueuedAction;
        if (action) {
          action.retryCount = retryCount;
          
          const putRequest = store.put(action);
          
          putRequest.onsuccess = () => {
            resolve();
          };
          
          putRequest.onerror = () => {
            reject(putRequest.error);
          };
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  // Clean up expired data
  async cleanupExpiredData(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.DATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.DATA);
      
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          const data = cursor.value as OfflineData;
          
          if (data.expiresAt && Date.now() > data.expiresAt) {
            cursor.delete();
            console.log('🗑️ Cleaned up expired data:', data.key);
          }
          
          cursor.continue();
        } else {
          console.log('✅ Cleanup completed');
          resolve();
        }
      };
      
      request.onerror = () => {
        console.error('❌ Cleanup failed:', request.error);
        reject(request.error);
      };
    });
  }

  // Get storage stats
  async getStorageStats(): Promise<{
    dataEntries: number;
    queuedActions: number;
    totalSize: number;
  }> {
    if (!this.db) await this.init();

    const [dataCount, queueCount] = await Promise.all([
      this.countRecords(this.STORES.DATA),
      this.countRecords(this.STORES.QUEUE)
    ]);

    return {
      dataEntries: dataCount,
      queuedActions: queueCount,
      totalSize: 0 // Could be calculated if needed
    };
  }

  private async countRecords(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = store.count();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

export const offlineStorage = OfflineStorage.getInstance();

// Initialize offline storage when module loads
if (typeof window !== 'undefined') {
  offlineStorage.init().catch(console.error);
  
  // Clean up expired data periodically
  setInterval(() => {
    offlineStorage.cleanupExpiredData().catch(console.error);
  }, 60 * 60 * 1000); // Every hour
}
