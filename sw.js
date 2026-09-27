/* ============================================================
   ⚙️ sw.js — Service Worker v18
   ============================================================ */
var CACHE_NAME = 'ss-cache-v20';   // ← غيّره من v19
var URLS_TO_CACHE = [
  './',
  './index.html',
  './courses-data.js',
  './ai-assistant.js',
  './ai-assistant-plus.js',
  './plan-simulator.js',
  './plan-enhance.js',
  './calendar-sync.js',
  './insights.js',
  './courses-files-plus.js',
  './qc-fix.js',                    // 🆕
  './widgets.js',
  './supabase-config.js',
  './supabase-client.js',
  './pwa.js',
  './manifest.json'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(URLS_TO_CACHE).catch(function(err){
        console.warn('SW cache addAll warning:', err);
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k !== CACHE_NAME) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var url = e.request.url;
  if(url.indexOf('supabase.co') > -1) return;
  if(url.indexOf('cdn.jsdelivr.net') > -1) return;
  if(url.indexOf('translate.google.com') > -1) return;
  if(url.indexOf('api.qrserver.com') > -1) return;
  if(url.indexOf('open-meteo.com') > -1) return;
  if(url.indexOf('aladhan.com') > -1) return;
  if(e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function(cached){
      var fetchPromise = fetch(e.request).then(function(response){
        if(response && response.status === 200){
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, clone).catch(function(){}); });
        }
        return response;
      }).catch(function(){ return cached; });
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var data = e.notification.data || {};
  var tab = data.tab || 'dashboard';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        var c = list[i];
        if(c.url.indexOf('index.html') > -1 || c.url.indexOf(location.origin) === 0){
          c.focus();
          c.postMessage({type:'navigate', tab: tab});
          return;
        }
      }
      if(clients.openWindow) return clients.openWindow('./index.html#' + tab);
    })
  );
});