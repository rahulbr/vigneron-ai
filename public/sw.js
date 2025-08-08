
// Enhanced Service Worker for Vigneron.AI - Farmer-focused offline functionality
const CACHE_NAME = 'vigneron-v1.2.0';
const OFFLINE_URL = '/offline.html';

// Critical resources that farmers need to work offline
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/_next/static/css/',
  '/_next/static/js/',
  '/favicon.ico'
];

// Weather API endpoints to cache
const WEATHER_CACHE = 'weather-v1';
const VINEYARD_DATA_CACHE = 'vineyard-data-v1';

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    (async () => {
      // Cache static assets
      const cache = await caches.open(CACHE_NAME);
      
      try {
        // Cache the offline page first
        await cache.add(OFFLINE_URL);
        console.log('✅ Cached offline page');
        
        // Cache other static assets
        await cache.add('/');
        console.log('✅ Cached main page');
        
      } catch (error) {
        console.warn('⚠️ Some static assets failed to cache:', error);
      }
      
      // Skip waiting to activate immediately
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== WEATHER_CACHE && name !== VINEYARD_DATA_CACHE)
          .map(name => {
            console.log('🗑️ Deleting old cache:', name);
            return caches.delete(name);
          })
      );
      
      // Take control of all pages immediately
      await self.clients.claim();
      console.log('✅ Service Worker is now controlling all pages');
    })()
  );
});

// Smart caching strategy for different types of requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (url.pathname === '/') {
    // Main page - Network first, fallback to cache
    event.respondWith(networkFirstStrategy(request));
  } else if (url.pathname.includes('/_next/') || url.pathname.includes('/static/')) {
    // Static assets - Cache first
    event.respondWith(cacheFirstStrategy(request));
  } else if (url.hostname === 'api.open-meteo.com' || url.pathname.includes('/api/weather')) {
    // Weather API - Cache with background update
    event.respondWith(staleWhileRevalidateStrategy(request, WEATHER_CACHE));
  } else if (url.pathname.includes('/api/') && url.pathname.includes('supabase')) {
    // Supabase API - Network first with offline queue
    event.respondWith(networkFirstWithQueueStrategy(request));
  } else {
    // Everything else - Network first
    event.respondWith(networkFirstStrategy(request));
  }
});

// Network first strategy - Try network, fallback to cache, then offline page
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone()).catch(console.warn);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('📱 Network failed, trying cache for:', request.url);
    
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // For navigation requests, return offline page
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    
    // For other requests, return a basic response
    return new Response('Offline - Content not available', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Cache first strategy - For static assets that rarely change
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone()).catch(console.warn);
    }
    return networkResponse;
  } catch (error) {
    return new Response('Resource not available offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Stale while revalidate - For weather data
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Start fetch in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone()).catch(console.warn);
    }
    return response;
  }).catch(error => {
    console.log('🌤️ Weather API failed:', error);
    return null;
  });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    console.log('📊 Serving cached weather data');
    return cachedResponse;
  }
  
  // Wait for network if no cache available
  return fetchPromise || new Response('Weather data not available offline', { 
    status: 503, 
    statusText: 'Service Unavailable' 
  });
}

// Network first with offline queue - For vineyard data updates
async function networkFirstWithQueueStrategy(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.log('📡 Network failed for API request:', request.url);
    
    // If it's a POST/PUT/DELETE request, queue it for later
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      await queueRequest(request);
      
      // Return a success response to prevent app errors
      return new Response(JSON.stringify({ 
        success: true, 
        queued: true, 
        message: 'Request queued for sync when online' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // For GET requests, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Data not available offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Queue requests for later sync
async function queueRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method !== 'GET' ? await request.text() : null,
      timestamp: Date.now()
    };
    
    // Store in IndexedDB via the main app's offline storage
    self.postMessage({
      type: 'QUEUE_REQUEST',
      data: requestData
    });
    
    console.log('📝 Queued request for sync:', request.method, request.url);
  } catch (error) {
    console.error('❌ Failed to queue request:', error);
  }
}

// Background sync for queued requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'vineyard-data-sync') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(syncQueuedRequests());
  }
});

async function syncQueuedRequests() {
  try {
    // Notify the main app to handle sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_QUEUED_REQUESTS'
      });
    });
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic cleanup
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cleanup') {
    event.waitUntil(cleanupCaches());
  }
});

async function cleanupCaches() {
  try {
    const cache = await caches.open(WEATHER_CACHE);
    const requests = await cache.keys();
    
    // Remove entries older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader && new Date(dateHeader).getTime() < sevenDaysAgo) {
          await cache.delete(request);
        }
      }
    }
    
    console.log('🧹 Cache cleanup completed');
  } catch (error) {
    console.error('❌ Cache cleanup failed:', error);
  }
}
