export const environment = {
  production: false,
  // Relative. The dev server proxies /api and /auth (frontend/proxy.conf.js);
  // a deployed build is fronted by a reverse proxy. No host is compiled in,
  // so the same build works with or without the VM.
  apiUrl: '',
  authUrl: '',
};
