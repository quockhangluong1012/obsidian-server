const cacheName = 'obsidian-lite-v4';

// Vendor bundles are versioned by filename and never change: safe to serve cache-first.
const vendor = [
    '/lib/marked.min.js',
    '/lib/purify.min.js',
    '/lib/highlight.min.js',
    '/lib/katex.min.js',
    '/lib/katex.min.css',
    '/lib/mermaid.min.js'
];

// App shell changes with every deploy: network-first, cached only as an offline fallback.
const shell = ['/', '/app.css', '/obsidian.js', '/manifest.webmanifest'];

self.addEventListener('install', event => event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...vendor, ...shell]);
    await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== cacheName).map(name => caches.delete(name)));
    await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/lib/')) {
        event.respondWith(caches.open(cacheName).then(async cache => {
            const cached = await cache.match(request);
            if (cached) return cached;
            const response = await fetch(request);
            if (response.ok) cache.put(request, response.clone());
            return response;
        }));
        return;
    }

    if (!shell.includes(url.pathname)) return;

    event.respondWith((async () => {
        const cache = await caches.open(cacheName);
        try {
            const response = await fetch(request);
            if (response.ok) cache.put(request, response.clone());
            return response;
        } catch (error) {
            const cached = await cache.match(request);
            if (cached) return cached;
            throw error;
        }
    })());
});
