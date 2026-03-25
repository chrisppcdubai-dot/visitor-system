// PPC Visitor Management - Service Worker
// Version 1.0

const CACHE_NAME = 'ppc-visitors-v1';
const urlsToCache = [
  '/index/',
  '/index/index.html',
  '/index/staff.html',
  '/index/manifest.json',
  '/index/icon-192.png',
  '/index/icon-512.png',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Work+Sans:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('cdnjs.cloudflare.com') &&
      !event.request.url.includes('fonts.googleapis.com') &&
      !event.request.url.includes('cdn.jsdelivr.net')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('[Service Worker] Found in cache:', event.request.url);
          return response;
        }
        
        console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // Return offline page if available
        return caches.match('/index/index.html');
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  console.log('[Service Worker] Push notification received');
  
  let data = {
    title: 'PPC Visitor Alert',
    body: 'A visitor has arrived',
    icon: '/index/icon-192.png',
    badge: '/index/badge-72.png',
    url: '/index/staff.html'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/index/icon-192.png',
    badge: data.badge || '/index/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'ppc-visitor-alert',
    requireInteraction: true,
    data: { 
      url: data.url || '/index/staff.html',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Details'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the app or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Check if there's already a window open
        for (let client of windowClients) {
          if (client.url.includes('/index/') && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});

// Background sync event (for offline check-ins)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-checkins') {
    console.log('[Service Worker] Background sync triggered');
    event.waitUntil(syncCheckIns());
  }
});

async function syncCheckIns() {
  // Get pending check-ins from IndexedDB
  // This will be implemented when offline functionality is added
  console.log('[Service Worker] Syncing pending check-ins...');
}

// Message event - handle messages from clients
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

console.log('[Service Worker] Loaded successfully');
