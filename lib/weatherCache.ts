
interface WeatherCacheEntry {
  data: any[];
  timestamp: number;
  expiresAt: number;
  vineyardId: string;
  dateRange: {
    start: string;
    end: string;
  };
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
}

export class WeatherCache {
  private static instance: WeatherCache;
  private cache = new Map<string, WeatherCacheEntry>();
  private readonly CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
  private readonly MAX_CACHE_SIZE = 50; // Maximum number of cache entries
  private stats: CacheStats = { hits: 0, misses: 0, entries: 0 };

  static getInstance(): WeatherCache {
    if (!WeatherCache.instance) {
      WeatherCache.instance = new WeatherCache();
    }
    return WeatherCache.instance;
  }

  private generateCacheKey(vineyardId: string, startDate: string, endDate: string): string {
    return `${vineyardId}_${startDate}_${endDate}`;
  }

  private isExpired(entry: WeatherCacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private evictExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.stats.entries--;
      }
    }
  }

  private evictOldestEntries(): void {
    if (this.cache.size <= this.MAX_CACHE_SIZE) return;

    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => {
      this.cache.delete(key);
      this.stats.entries--;
    });
  }

  get(vineyardId: string, startDate: string, endDate: string): any[] | null {
    this.evictExpiredEntries();
    
    const key = this.generateCacheKey(vineyardId, startDate, endDate);
    const entry = this.cache.get(key);

    if (!entry || this.isExpired(entry)) {
      this.stats.misses++;
      if (entry) {
        this.cache.delete(key);
        this.stats.entries--;
      }
      return null;
    }

    this.stats.hits++;
    console.log('🎯 Weather cache HIT:', { vineyardId, startDate, endDate });
    return entry.data;
  }

  set(vineyardId: string, startDate: string, endDate: string, data: any[]): void {
    this.evictExpiredEntries();
    this.evictOldestEntries();

    const key = this.generateCacheKey(vineyardId, startDate, endDate);
    const now = Date.now();

    const entry: WeatherCacheEntry = {
      data: [...data], // Create a copy to avoid mutation
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION,
      vineyardId,
      dateRange: { start: startDate, end: endDate }
    };

    this.cache.set(key, entry);
    this.stats.entries++;
    
    console.log('💾 Weather cached:', { 
      vineyardId, 
      startDate, 
      endDate, 
      dataPoints: data.length,
      expiresIn: Math.round(this.CACHE_DURATION / (1000 * 60)) + ' minutes'
    });
  }

  clear(vineyardId?: string): void {
    if (vineyardId) {
      // Clear cache for specific vineyard
      for (const [key, entry] of this.cache.entries()) {
        if (entry.vineyardId === vineyardId) {
          this.cache.delete(key);
          this.stats.entries--;
        }
      }
      console.log('🗑️ Cleared weather cache for vineyard:', vineyardId);
    } else {
      // Clear all cache
      this.cache.clear();
      this.stats.entries = 0;
      console.log('🗑️ Cleared all weather cache');
    }
  }

  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  // Store cache in localStorage for persistence
  persist(): void {
    if (typeof window === 'undefined') return; // Skip on server side
    
    try {
      const cacheData = Array.from(this.cache.entries()).map(([key, entry]) => [key, entry]);
      localStorage.setItem('weather_cache', JSON.stringify(cacheData));
      localStorage.setItem('weather_cache_stats', JSON.stringify(this.stats));
    } catch (error) {
      console.warn('Failed to persist weather cache to localStorage:', error);
    }
  }

  // Load cache from localStorage
  restore(): void {
    if (typeof window === 'undefined') return; // Skip on server side
    
    try {
      const cacheData = localStorage.getItem('weather_cache');
      const statsData = localStorage.getItem('weather_cache_stats');

      if (cacheData) {
        const entries = JSON.parse(cacheData);
        this.cache = new Map(entries);
        
        // Remove expired entries during restore
        this.evictExpiredEntries();
      }

      if (statsData) {
        this.stats = { ...this.stats, ...JSON.parse(statsData) };
      }

      console.log('♻️ Weather cache restored from localStorage:', this.getStats());
    } catch (error) {
      console.warn('Failed to restore weather cache from localStorage:', error);
      this.cache.clear();
      this.stats = { hits: 0, misses: 0, entries: 0 };
    }
  }
}

export const weatherCache = WeatherCache.getInstance();

// Initialize cache only on client side
if (typeof window !== 'undefined') {
  // Restore cache on module load
  weatherCache.restore();

  // Persist cache periodically
  setInterval(() => {
    weatherCache.persist();
  }, 5 * 60 * 1000); // Every 5 minutes

  // Persist on page unload
  window.addEventListener('beforeunload', () => {
    weatherCache.persist();
  });
}
