const CACHE_NAME = 'fire-nav-v2';
const urlsToCache = [
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache).catch(function(){});
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n){ return n !== CACHE_NAME; })
             .map(function(n){ return caches.delete(n); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  // لا تعارض أبداً مع Firestore / OSRM / خدمات التوجيه
  if (url.indexOf('firestore.googleapis.com') > -1 ||
      url.indexOf('router.project-osrm.org') > -1 ||
      url.indexOf('open-meteo.com') > -1 ||
      url.indexOf('googleapis.com') > -1) {
    return;
  }

  // الصفحات (HTML): الشبكة أولاً — حتى تصل التحديثات فور نشرها
  if (event.request.mode === 'navigate' ||
      (event.request.headers.get('accept')||'').indexOf('text/html') > -1) {
    event.respondWith(
      fetch(event.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ c.put('./index.html', copy); });
        return res;
      }).catch(function(){
        return caches.match('./index.html');
      })
    );
    return;
  }

  // الأصول الثابتة: الكاش أولاً ثم الشبكة
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request).then(function(res){
        if (event.request.method === 'GET' && res.status === 200 &&
            (url.indexOf('unpkg.com') > -1 || url.indexOf('tile.openstreetmap.org') > -1 || url.indexOf(location.origin) === 0)) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(c){ c.put(event.request, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match('./index.html');
      });
    })
  );
});