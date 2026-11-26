'use strict';

const scope = new URL(self.registration.scope);
const prefix = 'finance-pwa:' + scope.href + ':';
const cacheName = prefix + 'shell-1';
const indexUrl = new URL('index.html', scope).href;
const files = [
  'manifest.webmanifest', 'icon-152.png', 'icon-167.png', 'icon-180.png',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'
].map(path => new URL(path, scope).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([indexUrl, ...files].map(url => new Request(url, {cache:'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function openIndex(request) {
  const cached = await caches.match(indexUrl, {cacheName}).catch(() => undefined);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  let response;
  try {
    response = await fetch(request, {cache:'no-cache', signal:controller.signal});
  } catch (error) {
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (response.status >= 500 && cached) return cached;

  const html = response.headers.get('content-type')?.toLowerCase().startsWith('text/html');
  if (response.status === 200 && html && (response.url === scope.href || response.url === indexUrl)) {
    try {
      const cache = await caches.open(cacheName);
      await cache.put(indexUrl, response.clone());
    } catch {
      // The online version stays usable when the browser cannot update its cache.
    }
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || url.search) return;
  if (request.mode === 'navigate' && (url.href === scope.href || url.href === indexUrl)) {
    event.respondWith(openIndex(request));
  } else if (files.includes(url.href)) {
    event.respondWith((async () => (await caches.match(url.href, {cacheName})) || fetch(request))());
  }
});
