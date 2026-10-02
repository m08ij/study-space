/* ============================================================
   sw.js v49 — Cache updated (batch 7.5)
   ============================================================ */
var CACHE_NAME = 'ss-cache-v49';
var URLS_TO_CACHE = [
  './',
  './index.html',
  './core-utils.js',
  './courses-data.js',
  './courses-data-patch.js',
  './ai-v3.js',
  './ai-v3-patch.js',
  './plan-simulator.js',
  './plan-enhance.js',
  './calendar-sync.js',
  './insights.js',
  './courses-files-plus.js',
  './qc-fix.js',
  './bottom-nav.js',
  './lecture-reminder.js',
  './calendar-view.js',
  './custom-dashboard.js',
  './mindmap.js',
  './smart-timetable-entry.js',
  './timetable-ui.js',
  './widgets.js',
  './supabase-config.js',
  './supabase-client.js',
  './pwa.js',
  './manifest.json',
  './fixes-all.js',
  './critical-fixes.js',
  './data-logic-fixes.js',
  './perf-fixes.js',
  './ux-fixes.js',
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(
        URLS_TO_CACHE.map(function(url){
          return cache.add(url).catch(function(err){
            console.warn('SW skip:', url, err && err.message);
          });
        })
      );
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_NAME) return caches.delete(k);
      }));
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

  var isHTML = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').indexOf('text/html') > -1;

  if(isHTML){
    e.respondWith(
      fetch(e.request).then(function(res){
        if(res && res.status === 200){
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){
            cache.put(e.request, clone).catch(function(){});
          });
        }
        return res;
      }).catch(function(){
        return caches.match(e.request).then(function(cached){
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.match(e.request).then(function(cached){
        var networkPromise = fetch(e.request).then(function(res){
          if(res && res.status === 200){
            cache.put(e.request, res.clone()).catch(function(){});
          }
          return res;
        }).catch(function(){
          return cached || caches.match('./index.html');
        });

        if(cached){
          networkPromise.catch(function(){});
          return cached;
        }
        return networkPromise;
      });
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
        if(c.url.indexOf('index.html') > -1 || c.url.indexOf(self.location.origin) === 0){
          c.focus();
          c.postMessage({ type: 'navigate', tab: tab });
          return;
        }
      }
      if(clients.openWindow) return clients.openWindow('./index.html#' + tab);
    })
  );
});