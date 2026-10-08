// Routes API and auth calls to the backend so the browser only talks to the
// dev server's own origin. That keeps the session cookie host-only on
// localhost and removes the need to forward the backend port.
//
// In Docker Compose the backend is reached by service name (BACKEND_TARGET is
// set on the jaakd-frontend service); running the dev server on the host, it
// is reached on the published port.
const target = process.env.BACKEND_TARGET ?? 'http://localhost:8081';
const proxy = () => ({ target, secure: false, changeOrigin: true });

module.exports = {
  '/api': proxy(),
  '/auth': proxy(),
};
