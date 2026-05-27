import { AgentBase } from './base.agent';
import { axiosInstance as api } from '@/lib/axios';

class UserAgent extends AgentBase {
  async getMe() {
    return this._get(api.get('/users/me/'));
  }

  async updateMe(data) {
    return this._patch(api.patch('/users/me/', data));
  }

  async getNotificationPreferences() {
    return this._get(api.get('/users/me/notifications/'));
  }

  async updateNotificationPreferences(data) {
    return this._patch(api.patch('/users/me/notifications/', data));
  }
}

export const userAgent = new UserAgent();
