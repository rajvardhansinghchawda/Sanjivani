import { apiFetch } from './api';

const ROUTES = {
  'platform-admin': '/platform-admin',
  'admin': '/admin-portal',
  'supervisor': '/supervisor-portal',
  'reception': '/reception-portal',
  'ambulance': '/driver-portal',
  'patient': '/patient-portal',
  'public/patient': '/patient-portal',
};

export const Auth = {
  get user() {
    const userData = localStorage.getItem('medgrid_user');
    return userData ? JSON.parse(userData) : null;
  },

  ROUTES,

  async register(userData, forceLogin = false) {
    try {
      // Normalize legacy patient role id if needed
      if (userData && userData.role === 'patient') userData.role = 'public/patient';
      const res = await apiFetch('/api/auth/register/', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.detail || (typeof data === 'object' ? Object.values(data)[0] : 'Registration failed');
        return { success: false, error: Array.isArray(errorMsg) ? errorMsg[0] : errorMsg };
      }
      if (forceLogin) {
        return await this.signin(userData.email, userData.password);
      }
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  signup(userData) {
    return this.register(userData, true);
  },

  async signin(email, password, requiredRole = null) {
    try {
      const res = await apiFetch('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.detail || 'Invalid credentials' };
      }

      if (requiredRole && data.user && data.user.role !== requiredRole && data.user.role !== 'platform-admin') {
        return { success: false, error: 'Role mismatch' };
      }

      localStorage.setItem('medgrid_access_token', data.access);
      if (data.refresh) localStorage.setItem('medgrid_refresh_token', data.refresh);
      // Also store tokens using the platform-wide keys used by the Axios client.
      localStorage.setItem('access_token', data.access);
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh);

      const profileRes = await apiFetch('/api/auth/profile/');
      let userObj = {};
      if (profileRes.ok) {
        const profile = await profileRes.json();
        userObj = {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          role: profile.role,
          hospital: profile.hospital,
          hospitalName: profile.hospital_name,
        };
      } else {
        userObj = {
          id: data.user?.id,
          role: data.user?.role,
          hospital: data.user?.hospital,
          email: email,
          name: 'Unknown User',
        };
      }

      localStorage.setItem('medgrid_user', JSON.stringify(userObj));
      localStorage.setItem('medgrid_session', JSON.stringify({
        email: userObj.email,
        role: userObj.role,
        name: userObj.name,
        loggedInAt: new Date().toISOString(),
      }));

      return { success: true, user: userObj };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async logout() {
    const refresh = localStorage.getItem('medgrid_refresh_token');
    if (refresh) {
      try {
        await apiFetch('/api/auth/logout/', {
          method: 'POST',
          body: JSON.stringify({ refresh }),
        });
      } catch (e) {}
    }
    localStorage.removeItem('medgrid_access_token');
    localStorage.removeItem('medgrid_refresh_token');
    localStorage.removeItem('medgrid_user');
    localStorage.removeItem('medgrid_session');
    return '/';
  },

  redirectPath(role) {
    return ROUTES[role] || '/';
  },

  checkAccess(requiredRole) {
    const user = this.user;
    if (!user) return { allowed: false, redirect: '/signin' };
    if (requiredRole && user.role !== requiredRole && user.role !== 'platform-admin') {
      return { allowed: false, redirect: this.redirectPath(user.role) };
    }
    return { allowed: true };
  },
};

export default Auth;
