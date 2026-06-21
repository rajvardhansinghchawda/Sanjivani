// UI Configuration Constants
// Centralized configuration for frontend UI elements

export const UI_CONFIG = {
  // Typing animation text for SignUp page
  SIGNUP_TYPING_TEXT: 'Join the future of medical coordination.',
  TYPING_SPEED_MS: 60, // milliseconds per character

  // Sign In page
  SIGNIN_PLACEHOLDERS: {
    patient: 'name@email.com',
    hospital: 'unique-id@sanjivni.com',
    ambulance: 'driver@sanjivni.com',
  },

  // Colors and themes
  COLORS: {
    primary: '#1B4332',
    secondary: '#2D6A4F',
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',
    info: '#3498DB',
  },

  // Dashboard status colors
  BED_STATUS_COLORS: {
    available: '#1ABC9C',
    occupied: '#E74C3C',
    reserved: '#F39C12',
    maintenance: '#95A5A6',
  },

  ALERT_SEVERITY_COLORS: {
    critical: '#E74C3C',
    warning: '#F39C12',
    info: '#3498DB',
    success: '#16a34a',
  },

  // Bed and Ward Types
  BED_TYPES: ['ICU', 'General', 'Ventilator', 'Emergency', 'Private', 'Semi-Private'],

  WARD_PREFIXES: {
    GEN: 'General',
    ICU: 'ICU',
    EMR: 'Emergency',
    PRI: 'Private',
    SEMI: 'Semi-Private',
    VENT: 'Ventilator',
  },

  // Default locations
  DEFAULT_LOCATIONS: {
    indore: { lat: 22.7196, lng: 75.8577, name: 'Indore' },
    india: { lat: 20.5937, lng: 78.9629, name: 'India' },
  },

  // Time thresholds
  RESOURCE_ALERT_THRESHOLDS: {
    hours_12: 12 * 60 * 60,
    hours_24: 24 * 60 * 60,
  },

  // Map defaults
  MAP_CONFIG: {
    DEFAULT_ZOOM: 13,
    SEARCH_RADIUS_KM: 25,
  },

  // External APIs
  EXTERNAL_APIS: {
    OSRM_ROUTING: 'https://router.project-osrm.org/route/v1/driving/',
    LEAFLET_CDN: 'https://unpkg.com/leaflet@1.9.4/',
    AVATAR_SERVICE: 'https://pravatar.cc/',
  },

  // Pagination and limits
  PAGINATION: {
    ALERTS_LIMIT: 5,
    REQUESTS_LIMIT: 10,
    PATIENTS_LIMIT: 20,
    HOSPITALS_LIMIT: 50,
  },

  // Cache durations (in milliseconds)
  CACHE_DURATION: {
    CONFIG: 5 * 60 * 1000, // 5 minutes
    METRICS: 2 * 60 * 1000, // 2 minutes
    ROLES: 10 * 60 * 1000, // 10 minutes
  },
};

/**
 * Get placeholder text for email field based on role
 */
export const getEmailPlaceholder = (role) => {
  return UI_CONFIG.SIGNIN_PLACEHOLDERS[role] || 'email@example.com';
};

/**
 * Get color for bed status
 */
export const getBedStatusColor = (status) => {
  return UI_CONFIG.BED_STATUS_COLORS[status] || '#95A5A6';
};

/**
 * Get color for alert severity
 */
export const getAlertSeverityColor = (severity) => {
  return UI_CONFIG.ALERT_SEVERITY_COLORS[severity] || '#3498DB';
};

/**
 * Get ward name from prefix
 */
export const getWardName = (prefix) => {
  return UI_CONFIG.WARD_PREFIXES[prefix] || prefix;
};
