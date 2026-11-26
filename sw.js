'use strict';

const scope = new URL(self.registration.scope);
const prefix = 'finance-pwa:' + scope.href + ':';
const cacheName = prefix + '0.201';
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
  const cached = await caches.match(indexUrl, {cacheName});
  if (!cached) return fetch(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(request, {signal: controller.signal});
    return response.status >= 500 ? cached : response;
  } catch {
    return cached;
  } finally {
    clearTimeout(timeout);
  }
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
