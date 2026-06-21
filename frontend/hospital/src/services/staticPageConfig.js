// Static Pages Configuration Service
// Handles error pages, redirect logic, and general static content

import { apiFetch } from './api';

// Default error/static page content
const DEFAULT_ERROR_MESSAGES = {
  unauthorized: {
    title: 'Unauthorized',
    subtitle: 'Access Denied',
    message: 'Your account role doesn\'t have access to this portal.',
    primaryAction: 'Go to my portal',
    secondaryAction: 'Sign in with another account',
  },
  notfound: {
    title: 'Page Not Found',
    subtitle: '404',
    message: 'The page you are looking for doesn\'t exist or has been removed.',
    primaryAction: 'Go Home',
    secondaryAction: 'Contact Support',
  },
  error: {
    title: 'Something Went Wrong',
    subtitle: 'Error',
    message: 'An unexpected error occurred. Please try again later.',
    primaryAction: 'Go Home',
    secondaryAction: 'Refresh Page',
  },
  forbidden: {
    title: 'Forbidden',
    subtitle: 'Access Denied',
    message: 'You do not have permission to access this resource.',
    primaryAction: 'Go Back',
    secondaryAction: 'Go Home',
  },
};

let errorMessagesCache = null;
let errorCacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const staticPageConfig = {
  /**
   * Get error message for a specific error type
   */
  async getErrorMessage(errorType = 'error') {
    try {
      // Check cache first
      if (
        errorMessagesCache &&
        errorMessagesCache[errorType] &&
        errorCacheTimestamp &&
        Date.now() - errorCacheTimestamp < CACHE_DURATION
      ) {
        return { success: true, data: errorMessagesCache[errorType] };
      }

      // Try to fetch from backend
      try {
        const response = await apiFetch(
          `/api/static-pages/error-message/?type=${errorType}`,
          { method: 'GET' }
        );
        if (response && response.ok) {
          const data = await response.json();
          if (!errorMessagesCache) {
            errorMessagesCache = {};
          }
          errorMessagesCache[errorType] = data;
          errorCacheTimestamp = Date.now();
          return { success: true, data };
        }
      } catch (err) {
        console.warn(`Could not fetch ${errorType} message from backend:`, err);
      }

      // Return default
      const defaultMsg = DEFAULT_ERROR_MESSAGES[errorType] || DEFAULT_ERROR_MESSAGES.error;
      return { success: true, data: defaultMsg };
    } catch (error) {
      console.error(`Error in staticPageConfig.getErrorMessage(${errorType}):`, error);
      return { success: true, data: DEFAULT_ERROR_MESSAGES[errorType] || DEFAULT_ERROR_MESSAGES.error };
    }
  },

  /**
   * Get all error messages at once
   */
  async getAllErrorMessages() {
    try {
      // Check cache first
      if (
        errorMessagesCache &&
        errorCacheTimestamp &&
        Date.now() - errorCacheTimestamp < CACHE_DURATION
      ) {
        return { success: true, data: errorMessagesCache };
      }

      // Try to fetch from backend
      try {
        const response = await apiFetch('/api/static-pages/error-messages/', {
          method: 'GET',
        });
        if (response && response.ok) {
          const data = await response.json();
          errorMessagesCache = data;
          errorCacheTimestamp = Date.now();
          return { success: true, data };
        }
      } catch (err) {
        console.warn('Could not fetch error messages from backend:', err);
      }

      return { success: true, data: DEFAULT_ERROR_MESSAGES };
    } catch (error) {
      console.error('Error in staticPageConfig.getAllErrorMessages:', error);
      return { success: true, data: DEFAULT_ERROR_MESSAGES };
    }
  },

  /**
   * Get redirect path for a given role
   */
  async getRedirectPath(role) {
    try {
      const response = await apiFetch(
        `/api/auth/redirect-path/?role=${role}`,
        { method: 'GET' }
      );
      if (response && response.ok) {
        const data = await response.json();
        return {
          success: true,
          path: data.redirect_path || `/dashboard/${role}`,
        };
      }
    } catch (error) {
      console.error('Error fetching redirect path:', error);
    }

    // Default redirect paths
    const redirectMap = {
      'patient': '/patient-portal',
      'hospital': '/admin-portal',
      'admin': '/admin-portal',
      'ambulance': '/driver-portal',
      'doctor': '/dashboard',
      'supervisor': '/supervisor-portal',
      'reception': '/reception-portal',
      'dispatcher': '/supervisor-portal',
    };

    return {
      success: true,
      path: redirectMap[role] || '/dashboard',
    };
  },

  /**
   * Clear cache
   */
  clearCache() {
    errorMessagesCache = null;
    errorCacheTimestamp = null;
  },
};
