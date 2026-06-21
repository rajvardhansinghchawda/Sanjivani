import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ebook-temp-doubt-mit.trycloudflare.com';

const ACCESS_KEYS = ['access_token', 'medgrid_access_token'];
const REFRESH_KEYS = ['refresh_token', 'medgrid_refresh_token'];

const getFirstStorageValue = (keys) => {
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

const setTokenPair = ({ access, refresh }) => {
  if (access) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('medgrid_access_token', access);
  }
  if (refresh) {
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('medgrid_refresh_token', refresh);
  }
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Helper to get current page context (SPA path + title)
const getPageContext = () => {
  try {
    if (typeof window !== 'undefined') return `${window.location.pathname}${document.title ? ' - ' + document.title : ''}`;
  } catch (e) {}
  return 'unknown';
};

api.interceptors.request.use((config) => {
  // Short-circuit for auth endpoints
  if (config.url.includes('/api/auth/login/') || 
      config.url.includes('/api/auth/register/') || 
      config.url.includes('/api/auth/token/refresh/')) {
    return config;
  }

  const token = getFirstStorageValue(ACCESS_KEYS);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Console logging (grouped by page) for debugging
  try {
    const page = getPageContext();
    const method = (config.method || 'GET').toUpperCase();
    console.groupCollapsed(`[API] ${page} → ${method} ${config.url}`);
    console.log('Request config:', { url: config.url, method, data: config.data, params: config.params });
  } catch (e) {
    /* ignore logging errors */
  }

  return config;
});

let isRefreshing = false;
let refreshQueue = [];

const resolveQueue = (error, accessToken = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(accessToken);
  });
  refreshQueue = [];
};

api.interceptors.response.use(
  (res) => {
    try {
      console.log('Response:', { url: res.config?.url, status: res.status, data: res.data });
      console.groupEnd();
    } catch (e) {}
    return res;
  },
  async (err) => {
    const original = err.config;
    try { console.error('Response error:', err?.response?.status, err?.response?.data); console.groupEnd(); } catch(e) {}
    if (!err.response || err.response.status !== 401 || original?._retry) {
      return Promise.reject(err);
    }

    const refresh = getFirstStorageValue(REFRESH_KEYS);
    if (!refresh) return Promise.reject(err);

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (accessToken) => {
            original.headers.Authorization = `Bearer ${accessToken}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshRes = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, { refresh }, { headers: { 'Content-Type': 'application/json' } });
      const newAccess = refreshRes.data?.access;
      const newRefresh = refreshRes.data?.refresh;
      setTokenPair({ access: newAccess, refresh: newRefresh });
      resolveQueue(null, newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (refreshErr) {
      resolveQueue(refreshErr, null);
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

/**
 * Backwards-compatible wrapper around Axios for existing code that expects:
 * - `res.ok`
 * - `await res.json()`
 * - `res.status`
 */
export const apiFetch = async (endpoint, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  let data = undefined;
  if (options.body !== undefined) {
    try {
      data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch {
      data = options.body;
    }
  }

  try {
    const res = await api.request({ url: endpoint, method, data, headers });
    return {
      ok: true,
      status: res.status,
      json: async () => res.data,
    };
  } catch (e) {
    const status = e.response?.status ?? 0;
    const payload = e.response?.data ?? { detail: e.message || 'Request failed' };
    return {
      ok: false,
      status,
      json: async () => payload,
    };
  }
};

export default apiFetch;
