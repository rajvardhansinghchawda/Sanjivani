// Dashboard Configuration Service
// Fetches dashboard layout, metrics, and alerts from backend

import { apiFetch } from './api';

// Default dashboard configs for each role (fallback)
const DEFAULT_DASHBOARD_CONFIGS = {
  'hospital-admin': {
    icon: '🏥',
    label: 'Hospital Admin',
    title: 'Hospital Dashboard',
    navItems: [
      { icon: '📊', label: 'Overview', active: true },
      { icon: '🛏️', label: 'Bed Management' },
      { icon: '🏥', label: 'Equipment Status' },
      { icon: '👤', label: 'Staff on Duty' },
      { icon: '📢', label: 'Transfer Requests', badge: 0 },
      { icon: '📈', label: 'Analytics' },
    ],
  },
  'doctor': {
    icon: '💉',
    label: 'Doctor / Specialist',
    title: 'My Dashboard',
    navItems: [
      { icon: '📊', label: 'Overview', active: true },
      { icon: '👤', label: 'My Patients' },
      { icon: '🛏️', label: 'Find Beds' },
      { icon: '📋', label: 'Consult Requests', badge: 0 },
      { icon: '📢', label: 'Quick Transfer' },
      { icon: '📅', label: 'Schedule' },
    ],
  },
  'dispatcher': {
    icon: '🚑',
    label: 'Ambulance Dispatcher',
    title: 'Dispatch Center',
    navItems: [
      { icon: '📊', label: 'Overview', active: true },
      { icon: '🚑', label: 'Fleet Status' },
      { icon: '📍', label: 'City Map' },
      { icon: '📞', label: 'Call Queue', badge: 0 },
      { icon: '🏥', label: 'Hospital Capacity' },
    ],
  },
  'coordinator': {
    icon: '🎯',
    label: 'Regional Coordinator',
    title: 'Coordination Hub',
    navItems: [
      { icon: '📊', label: 'Overview', active: true },
      { icon: '🏥', label: 'Hospitals' },
      { icon: '🚑', label: 'Ambulances' },
      { icon: '🛏️', label: 'Bed Inventory' },
      { icon: '📈', label: 'Analytics' },
    ],
  },
};

let configCache = {};
let cacheTimestamp = {};

export const dashboardConfig = {
  /**
   * Get dashboard configuration for a specific role
   * Fetches from backend first, falls back to defaults
   */
  async getConfig(role, hospitalId = null) {
    try {
      // Check cache first (5 min cache)
      const cacheKey = `${role}-${hospitalId || 'general'}`;
      if (
        configCache[cacheKey] &&
        cacheTimestamp[cacheKey] &&
        Date.now() - cacheTimestamp[cacheKey] < 5 * 60 * 1000
      ) {
        return { success: true, data: configCache[cacheKey] };
      }

      // Try to fetch from backend
      try {
        let url = `/api/dashboard/config/?role=${role}`;
        if (hospitalId) url += `&hospital_id=${hospitalId}`;

        const response = await apiFetch(url, { method: 'GET' });

        if (response) {
          configCache[cacheKey] = response;
          cacheTimestamp[cacheKey] = Date.now();
          return { success: true, data: response };
        }
      } catch (err) {
        console.warn(`Could not fetch dashboard config for role ${role}:`, err);
      }

      // Fallback to default config
      const defaultConfig = DEFAULT_DASHBOARD_CONFIGS[role] || DEFAULT_DASHBOARD_CONFIGS['hospital-admin'];
      configCache[cacheKey] = defaultConfig;
      cacheTimestamp[cacheKey] = Date.now();
      return { success: true, data: defaultConfig };
    } catch (error) {
      console.error('Error in dashboardConfig.getConfig:', error);
      const defaultConfig = DEFAULT_DASHBOARD_CONFIGS[role] || DEFAULT_DASHBOARD_CONFIGS['hospital-admin'];
      return { success: true, data: defaultConfig };
    }
  },

  /**
   * Get live dashboard metrics for a role
   * Fetches from /api/analytics/my-hospital/ or role-specific endpoint
   */
  async getMetrics(role, hospitalId = null) {
    try {
      let endpoint = '';

      switch (role) {
        case 'hospital-admin':
        case 'doctor':
          endpoint = '/api/analytics/my-hospital/';
          break;
        case 'dispatcher':
          endpoint = '/api/supervisor/dashboard/';
          break;
        case 'coordinator':
        case 'admin':
          endpoint = '/api/analytics/dashboard/';
          break;
        default:
          endpoint = '/api/analytics/my-hospital/';
      }

      const response = await apiFetch(endpoint, { method: 'GET' });
      return { success: true, data: response };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      // Return empty or minimal metrics on error
      return { success: true, data: { metrics: [], alerts: [] } };
    }
  },

  /**
   * Get alerts for dashboard
   */
  async getAlerts(role, hospitalId = null) {
    try {
      let endpoint = '';

      if (role === 'dispatcher' || role === 'coordinator' || role === 'admin') {
        endpoint = '/api/supervisor/alerts/?limit=5';
      } else if (role === 'hospital-admin') {
        endpoint = hospitalId ? `/api/alerts/?hospital=${hospitalId}&limit=5` : '/api/alerts/?limit=5';
      }

      if (!endpoint) {
        return { success: true, data: [] };
      }

      const response = await apiFetch(endpoint, { method: 'GET' });
      return { success: true, data: Array.isArray(response) ? response : response.results || [] };
    } catch (error) {
      console.error('Error fetching dashboard alerts:', error);
      return { success: true, data: [] };
    }
  },

  /**
   * Get role-based data (bed availability, ambulances, etc.)
   */
  async getRoleSpecificData(role, hospitalId = null) {
    try {
      switch (role) {
        case 'hospital-admin':
          if (!hospitalId) return { success: true, data: null };
          return await apiFetch(`/api/hospitals/manage/${hospitalId}/`, { method: 'GET' });

        case 'doctor':
          return await apiFetch('/api/auth/profile/', { method: 'GET' });

        case 'dispatcher':
          return await apiFetch('/api/ambulances/manage/', { method: 'GET' });

        case 'coordinator':
          return await apiFetch('/api/analytics/dashboard/', { method: 'GET' });

        default:
          return { success: true, data: null };
      }
    } catch (error) {
      console.error('Error fetching role-specific data:', error);
      return { success: true, data: null };
    }
  },

  /**
   * Clear cache (call on logout or navigation)
   */
  clearCache() {
    configCache = {};
    cacheTimestamp = {};
  },
};
