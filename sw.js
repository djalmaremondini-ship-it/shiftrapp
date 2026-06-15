// Shiftr Service Worker v2
// Incrementar CACHE_NAME a cada deploy novo força atualização automática
const CACHE_NAME = 'shiftr-v2';

const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// INSTALL — cacheia assets essenciais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // ativa imediatamente sem esperar fechar abas
  );
});

// ACTIVATE — remove caches antigos e notifica o app de update disponível
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => {
      self.clients.claim(); // assume controle de todas as abas abertas
      // Notifica o app que há uma atualização
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
});

// FETCH — Network first para Firebase, Cache first para assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase, Google APIs — sempre online, nunca cacheia
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('recaptcha') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Assets estáticos — Cache First com atualização em background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached); // offline: usa cache

      return cached || fetchPromise;
    })
  );
});

// Receber mensagem do app para forçar update
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
