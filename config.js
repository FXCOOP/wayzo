// Wayzo Configuration
window.WAYZO_CONFIG = {
  // API Configuration - points to the backend
  API_BASE_URL: window.location.hostname.includes('localhost')
    ? 'http://localhost:3000'
    : '', // Use same domain for production

  // Features
  ENABLE_AUTHENTICATION: true,
  ENABLE_PAYMENTS: true,
  ENABLE_GOOGLE_OAUTH: true,

  // Environment
  ENVIRONMENT: window.location.hostname.includes('staging') ? 'staging' : 'production'
};