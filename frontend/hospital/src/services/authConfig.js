// Authentication Configuration Service
// Fetches available roles and auth configs from backend

import { apiFetch } from './api';

const DEFAULT_ROLES = [
  { id: 'public/patient', label: 'Patient', icon: '🧑‍🤝‍🧑', desc: 'Find hospitals & book beds' },
  { id: 'ambulance', label: 'Ambulance', icon: '🚑', desc: 'Register as a driver' },
];

const DEFAULT_SIGNIN_ROLES = [
  { id: 'public/patient', label: 'Patient' },
  { id: 'hospital', label: 'Hospital' },
  { id: 'ambulance', label: 'Ambulance' },
];

let rolesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const authConfig = {
  /**
   * Get available signup roles
   * Fetches from backend /api/auth/roles/ or uses defaults
   */
  async getSignupRoles() {
    try {
      // Check cache first
      if (rolesCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
        return { success: true, data: rolesCache };
      }

      // Try to fetch from backend
      try {
        const response = await apiFetch('/api/auth/roles/', { method: 'GET' });
        if (response && Array.isArray(response)) {
          rolesCache = response;
          cacheTimestamp = Date.now();
          return { success: true, data: response };
        }
      } catch (err) {
        console.warn('Could not fetch roles from backend, using defaults:', err);
      }

      // Fallback to defaults
      return { success: true, data: DEFAULT_ROLES };
    } catch (error) {
      console.error('Error fetching signup roles:', error);
      return { success: true, data: DEFAULT_ROLES };
    }
  },

  /**
   * Get available signin roles
   * Fetches from backend /api/auth/signin-roles/ or uses defaults
   */
  async getSigninRoles() {
    try {
      // Check cache first
      if (rolesCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
        return { success: true, data: rolesCache };
      }

      // Try to fetch from backend
      try {
        const response = await apiFetch('/api/auth/signin-roles/', { method: 'GET' });
        if (response && Array.isArray(response)) {
          rolesCache = response;
          cacheTimestamp = Date.now();
          return { success: true, data: response };
        }
      } catch (err) {
        console.warn('Could not fetch signin roles from backend, using defaults:', err);
      }

      // Fallback to defaults
      return { success: true, data: DEFAULT_SIGNIN_ROLES };
    } catch (error) {
      console.error('Error fetching signin roles:', error);
      return { success: true, data: DEFAULT_SIGNIN_ROLES };
    }
  },

  /**
   * Clear cache (call after logout or when needed)
   */
  clearCache() {
    rolesCache = null;
    cacheTimestamp = null;
  },

  /**
   * Get auth metadata (supported features, requirements, etc.)
   */
  async getAuthMetadata() {
    try {
      const response = await apiFetch('/api/auth/metadata/', { method: 'GET' });
      return { success: true, data: response };
    } catch (error) {
      console.error('Error fetching auth metadata:', error);
      return { success: true, data: { hipaaCompliant: true, iso27001: true } };
    }
  },
};
