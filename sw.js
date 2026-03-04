// Service Worker - Stale-While-Revalidate Caching Strategy
const CACHE_NAME = 'bizstash-v1';
const DATA_CACHE = 'bizstash-data-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('Cache addAll failed:', err);
        // Don't fail install if some assets fail
      });
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Stale-While-Revalidate strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API calls (data files) with SWR
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Handle app assets with cache-first
  if (url.pathname.includes('.js') || url.pathname.includes('.css') || url.pathname.includes('.svg')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML - network first
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default - network first with fallback to cache
  event.respondWith(networkFirst(request));
});

/**
 * Stale-While-Revalidate Strategy:
 * 1. Return cached response immediately if available
 * 2. Fetch fresh data in background
 * 3. Update cache with fresh data
 * 4. If no cache and fetch fails, return error
 */
async function staleWhileRevalidate(request) {
  const cacheName = DATA_CACHE;
  const cache = await caches.open(cacheName);
  
  // Try to get from cache
  const cachedResponse = await cache.match(request);
  
  // Fetch fresh data in background (don't wait)
  const fetchPromise = fetch(request).then(response => {
    // Cache the fresh response
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(error => {
    console.warn('Background fetch failed:', error);
    // If fetch fails but we have cache, that's fine
    // The component will have cached data already
  });

  // Return cached response if available, else wait for fetch
  return cachedResponse || fetchPromise;
}

/**
 * Cache-First Strategy:
 * 1. Try cache first
 * 2. Fall back to network
 * 3. Cache network response
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    return new Response('Offline - resource not cached', { status: 503 });
  }
}

/**
 * Network-First Strategy:
 * 1. Try network
 * 2. Fall back to cache if network fails
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.open(CACHE_NAME).then(cache => cache.match(request));
    if (cached) {
      return cached;
    }
    
    // No cache either
    return new Response('Offline - resource not cached', { status: 503 });
  }
}
