/**
 * Configuration file for the SpamGenie frontend application
 * Contains environment-specific settings
 */

// Determine the environment
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// API Configuration
const API_CONFIG = {
  // In development, API is served from same host but with /api prefix
  // In production, we use the Django-provided API endpoints
  BASE_URL: isProduction ? '/api' : '/api',
  
  // Timeout for API requests in milliseconds
  TIMEOUT: 30000,
  
  // Whether to include credentials in requests (for CSRF protection)
  INCLUDE_CREDENTIALS: true,
};

// Feature flags
const FEATURES = {
  // Enable to show detailed error messages in UI
  DETAILED_ERRORS: isDevelopment,
  
  // Enable to show debug information in console
  DEBUG_LOGGING: isDevelopment,
  
  // Demo/test mode
  DEMO_MODE: false,
};

// Application settings
const APP_CONFIG = {
  // Application name
  APP_NAME: 'Codex',
  
  // Default pagination size
  DEFAULT_PAGE_SIZE: 10,
  
  // Maximum upload file size (in bytes)
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5MB
  
  // Supported file formats
  SUPPORTED_FORMATS: ['.eml'],
  
  // Auto-save interval (in milliseconds)
  AUTO_SAVE_INTERVAL: 60000, // 1 minute
};

// Routes configuration
const ROUTES = {
  // Login page 
  LOGIN: '/login',
  
  // Default redirect after login
  DEFAULT_REDIRECT: '/',
  
  // Workspace routes
  WORKSPACES: '/workspaces',
  WORKSPACE_DETAIL: (id) => `/workspaces/${id}`,
  
  // Settings
  SETTINGS: '/settings',
  
  // Admin routes
  ADMIN: {
    USERS: '/admin/users',
  },
};

// Export configuration objects
export default {
  API: API_CONFIG,
  FEATURES,
  APP: APP_CONFIG,
  ROUTES,
  IS_PRODUCTION: isProduction,
  IS_DEVELOPMENT: isDevelopment,
};
