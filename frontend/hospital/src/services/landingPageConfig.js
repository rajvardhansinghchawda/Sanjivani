// Landing Page Configuration Service
// Fetches features, testimonials, pricing, and stats from backend

import { apiFetch } from './api';

// Default landing page content (fallback)
const DEFAULT_LANDING_CONFIG = {
  hero: {
    badge: 'Real-Time Hospital Network',
    title: 'Smarter Care. Faster Saves. For Every Hospital.',
    description: 'Coordinate transfers, manage equipment, and sync ICU beds across your entire city in one unified live dashboard.',
    cta1: 'Join SANJIVNI',
    cta2: 'How It Works',
    trustedHospitals: 200,
  },
  features: [],
  testimonials: [],
  pricing: [],
  faq: [],
  stats: {
    hospitals: 200,
    uptime: 99.9,
    avgResponseTime: 8.2,
  },
};

let landingCache = null;
let landingCacheTimestamp = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const landingPageConfig = {
  /**
   * Get complete landing page configuration
   */
  async getConfig() {
    try {
      // Check cache first
      if (
        landingCache &&
        landingCacheTimestamp &&
        Date.now() - landingCacheTimestamp < CACHE_DURATION
      ) {
        return { success: true, data: landingCache };
      }

      // Try to fetch from backend
      try {
        const response = await apiFetch('/api/landing-page/config/', {
          method: 'GET',
        });
        if (response && response.ok) {
          const data = await response.json();
          landingCache = data;
          landingCacheTimestamp = Date.now();
          return { success: true, data };
        }
      } catch (err) {
        console.warn('Could not fetch landing page config from backend:', err);
      }

      // Return defaults
      return { success: true, data: DEFAULT_LANDING_CONFIG };
    } catch (error) {
      console.error('Error in landingPageConfig.getConfig:', error);
      return { success: true, data: DEFAULT_LANDING_CONFIG };
    }
  },

  /**
   * Get features specifically
   */
  async getFeatures() {
    try {
      const response = await apiFetch('/api/landing-page/features/', {
        method: 'GET',
      });
      if (response && response.ok) {
        const data = await response.json();
        return { success: true, data: Array.isArray(data) ? data : data.results || [] };
      }
    } catch (error) {
      console.error('Error fetching features:', error);
    }
    return {
      success: true,
      data: DEFAULT_LANDING_CONFIG.features,
    };
  },

  /**
   * Get testimonials
   */
  async getTestimonials() {
    try {
      const response = await apiFetch('/api/landing-page/testimonials/', {
        method: 'GET',
      });
      if (response && response.ok) {
        const data = await response.json();
        return { success: true, data: Array.isArray(data) ? data : data.results || [] };
      }
    } catch (error) {
      console.error('Error fetching testimonials:', error);
    }
    return {
      success: true,
      data: DEFAULT_LANDING_CONFIG.testimonials,
    };
  },

  /**
   * Get pricing plans
   */
  async getPricing() {
    try {
      const response = await apiFetch('/api/landing-page/pricing/', {
        method: 'GET',
      });
      if (response && response.ok) {
        const data = await response.json();
        return { success: true, data: Array.isArray(data) ? data : data.results || [] };
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
    return {
      success: true,
      data: DEFAULT_LANDING_CONFIG.pricing,
    };
  },

  /**
   * Get FAQ items
   */
  async getFAQ() {
    try {
      const response = await apiFetch('/api/landing-page/faq/', {
        method: 'GET',
      });
      if (response && response.ok) {
        const data = await response.json();
        return { success: true, data: Array.isArray(data) ? data : data.results || [] };
      }
    } catch (error) {
      console.error('Error fetching FAQ:', error);
    }
    return {
      success: true,
      data: DEFAULT_LANDING_CONFIG.faq,
    };
  },

  /**
   * Get platform statistics
   */
  async getStats() {
    try {
      const response = await apiFetch('/api/analytics/platform-stats/', {
        method: 'GET',
      });
      if (response && response.ok) {
        const data = await response.json();
        return {
          success: true,
          data: {
            hospitals: data.hospitals?.total || DEFAULT_LANDING_CONFIG.stats.hospitals,
            uptime: data.uptime || DEFAULT_LANDING_CONFIG.stats.uptime,
            avgResponseTime: data.ambulances?.avg_response_time || DEFAULT_LANDING_CONFIG.stats.avgResponseTime,
          },
        };
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
    return {
      success: true,
      data: DEFAULT_LANDING_CONFIG.stats,
    };
  },

  /**
   * Clear cache
   */
  clearCache() {
    landingCache = null;
    landingCacheTimestamp = null;
  },
};
