// About Page Configuration Service
// Fetches team members, company info, and about page content from backend

import { apiFetch } from './api';

// Default about page content (fallback)
const DEFAULT_ABOUT_CONFIG = {
  company: {
    founded: 2024,
    mission: 'In a crisis, time is the only resource that cannot be replenished. Our platform connects hospitals, ambulances, and patients in a living network of life-critical data.',
    uptime: 99.9,
    description: 'SANJIVNI was founded on a single premise: to revolutionize hospital coordination.',
  },
  team: [],
  values: [],
  stats: {
    uptime: 99.9,
    hospitals: 200,
    transfers: 50000,
  },
};

let aboutCache = null;
let aboutCacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export const aboutPageConfig = {
  /**
   * Get company information
   */
  async getCompanyInfo() {
    try {
      // Check cache
      if (
        aboutCache &&
        aboutCacheTimestamp &&
        Date.now() - aboutCacheTimestamp < CACHE_DURATION
      ) {
        return { success: true, data: aboutCache };
      }

      // Fetch from backend
      try {
        const response = await apiFetch('/api/about-page/company-info/', {
          method: 'GET',
        });
        if (response && response.ok) {
          const data = await response.json();
          aboutCache = data;
          aboutCacheTimestamp = Date.now();
          return { success: true, data };
        }
      } catch (err) {
        console.warn('Could not fetch about page info from backend:', err);
      }

      return { success: true, data: DEFAULT_ABOUT_CONFIG.company };
    } catch (error) {
      console.error('Error in aboutPageConfig.getCompanyInfo:', error);
      return { success: true, data: DEFAULT_ABOUT_CONFIG.company };
    }
  },

  /**
   * Get team members
   */
  async getTeam() {
    try {
      const response = await apiFetch('/api/about-page/team/', {
        method: 'GET',
      });
      if (response && response.ok) {
        const data = await response.json();
        return { success: true, data: Array.isArray(data) ? data : data.results || [] };
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
    return {
      success: true,
      data: DEFAULT_ABOUT_CONFIG.team,
    };
  },

  /**
   * Get company values
   */
  async getValues() {
    try {
      const response = await apiFetch('/api/about-page/values/', {
        method: 'GET',
      });
      if (response && response.ok) {
        const data = await response.json();
        return { success: true, data: Array.isArray(data) ? data : data.results || [] };
      }
    } catch (error) {
      console.error('Error fetching company values:', error);
    }
    return {
      success: true,
      data: DEFAULT_ABOUT_CONFIG.values,
    };
  },

  /**
   * Get about page statistics
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
            uptime: data.uptime || DEFAULT_ABOUT_CONFIG.stats.uptime,
            hospitals: data.hospitals?.total || DEFAULT_ABOUT_CONFIG.stats.hospitals,
            transfers: data.transfers?.total || DEFAULT_ABOUT_CONFIG.stats.transfers,
          },
        };
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
    return {
      success: true,
      data: DEFAULT_ABOUT_CONFIG.stats,
    };
  },

  /**
   * Clear cache
   */
  clearCache() {
    aboutCache = null;
    aboutCacheTimestamp = null;
  },
};
