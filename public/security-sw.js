// Service Worker — security response headers
// Intercepts navigation requests and injects security headers that
// Base44's hosting layer does not set by default.

const SECURITY_HEADERS = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), microphone=(self)',
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  // Only intercept same-origin navigation requests to the SPA shell.
  // Skip API routes and auth flows — those need their redirects untouched.
  if (
    event.request.mode !== 'navigate' ||
    !url.startsWith(self.location.origin) ||
    url.includes('/api/') ||
    url.includes('/auth/') ||
    url.includes('/oauth')
  ) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        headers.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    })
  );
});
