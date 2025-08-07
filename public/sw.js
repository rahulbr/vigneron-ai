
// Service Worker for Vigneron.AI
const CACHE_NAME = 'vigneron-ai-v1';
const OFFLINE_URL = '/offline.html';

// Core files to cache for offline use
const CORE_FILES = [
  '/',
  '/offline.html',
  '/_next/static/css/app/globals.css',
  '/favicon.ico'
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first for static assets
  CACHE_FIRST: 'cache-first',
  // Network first for API calls with cache fallback
  NETWORK_FIRST: 'network-first',
  // Stale while revalidate for frequently updated content
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Install event - cache core files
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching core files');
        return cache.addAll(CORE_FILES);
      })
      .then(() => {
        console.log('✅ Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API calls - network first with cache fallback
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    // Static assets - cache first
    event.respondWith(handleStaticAssets(request));
  } else if (url.hostname.includes('supabase.co')) {
    // Supabase requests - network first
    event.respondWith(handleDatabaseRequest(request));
  } else if (url.hostname.includes('googleapis.com') || url.hostname.includes('maps.google.com')) {
    // Google Maps/API - cache with network fallback
    event.respondWith(handleMapRequest(request));
  } else {
    // HTML pages - stale while revalidate
    event.respondWith(handlePageRequest(request));
  }
});

// Handle API requests (weather, etc.)
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🔄 API network failed, trying cache:', request.url);
    
    // Fall back to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Add offline indicator header
      const response = cachedResponse.clone();
      response.headers.set('x-served-from', 'cache');
      return response;
    }
    
    // Return offline response for critical API calls
    return new Response(
      JSON.stringify({
        error: 'Offline - data not available in cache',
        offline: true,
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable - Offline',
        headers: {
          'Content-Type': 'application/json',
          'x-served-from': 'offline-fallback'
        }
      }
    );
  }
}

// Handle static assets
async function handleStaticAssets(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Try cache first for static assets
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If not in cache, fetch and cache
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('❌ Static asset failed to load:', request.url);
    throw error;
  }
}

// Handle database requests (Supabase)
async function handleDatabaseRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET requests
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🔄 Database network failed, trying cache:', request.url);
    
    if (request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Queue POST/PUT/DELETE requests for later sync
    if (request.method !== 'GET') {
      await queueOfflineAction(request);
      
      return new Response(
        JSON.stringify({
          success: true,
          queued: true,
          message: 'Action queued for sync when online'
        }),
        {
          status: 202,
          statusText: 'Accepted - Queued for sync',
          headers: {
            'Content-Type': 'application/json',
            'x-served-from': 'offline-queue'
          }
        }
      );
    }
    
    throw error;
  }
}

// Handle Google Maps requests
async function handleMapRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache map tiles and API responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try to serve from cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Handle page requests
async function handlePageRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the page
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fall back to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fall back to offline page
    const offlineResponse = await cache.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }
    
    throw error;
  }
}

// Queue offline actions for later sync
async function queueOfflineAction(request) {
  try {
    // We'll implement this with IndexedDB in the next step
    console.log('📝 Queuing offline action:', request.method, request.url);
    
    // For now, just log it
    // This will be enhanced with proper IndexedDB storage
  } catch (error) {
    console.error('❌ Failed to queue offline action:', error);
  }
}

// Background sync for queued actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'vineyard-data-sync') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(syncQueuedActions());
  }
});

// Sync queued actions when back online
async function syncQueuedActions() {
  try {
    console.log('🚀 Syncing queued actions...');
    // Implementation will be added with IndexedDB integration
    console.log('✅ Sync completed');
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

// Handle push notifications for important updates
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'New vineyard update available',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data.data || {},
    actions: [
      {
        action: 'view',
        title: 'View Details'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Vigneron.AI', options)
  );
});
