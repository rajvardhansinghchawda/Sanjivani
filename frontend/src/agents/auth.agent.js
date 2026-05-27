import { AgentBase } from './base.agent';
import { axiosInstance as api } from '@/lib/axios';

const AUTH_BASE = '/auth';

class AuthAgent extends AgentBase {
  async loginWithPassword(email, password) {
    return this._post(api.post(`${AUTH_BASE}/login/`, { email, password }));
  }

  async requestOTP(email) {
    return this._post(api.post(`${AUTH_BASE}/otp/request/`, { email }));
  }

  async loginWithOTP(email, otp) {
    return this._post(api.post(`${AUTH_BASE}/login/otp/`, { email, otp }));
  }

  async register(data) {
    return this._post(api.post(`${AUTH_BASE}/register/`, data));
  }

  async logout(refreshToken) {
    return this._post(api.post(`${AUTH_BASE}/logout/`, { refresh: refreshToken }));
  }

  async updateFCMToken(token) {
    return this._post(api.post(`${AUTH_BASE}/fcm-token/`, { token }));
  }

  async loginWithGoogle(credential) {
    return this._post(api.post(`${AUTH_BASE}/google/`, { credential }));
  }

  async verifyEmail(token) {
    return this._post(api.post(`${AUTH_BASE}/verify-email/`, { token }));
  }

  async verifyMFA(userId, code) {
    return this._post(api.post(`${AUTH_BASE}/mfa/verify/`, { user_id: userId, code }));
  }
}

export const authAgent = new AuthAgent();
