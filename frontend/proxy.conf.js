// Routes API calls to the backend under the backend's reserved /api prefix, so
// the browser only ever talks to the dev server's own origin. Everything else,
// including the SPA's /auth pages, is served by the dev server. That keeps the
// session cookie host-only on localhost and removes the need to forward the
// backend port.
//
// In Docker Compose the backend is reached by service name (BACKEND_TARGET is
// set on the jaakd-frontend service); running the dev server on the host, it
// is reached on the published port.
const target = process.env.BACKEND_TARGET ?? 'http://localhost:8081';

module.exports = {
  '/api': { target, secure: false, changeOrigin: true },
};
