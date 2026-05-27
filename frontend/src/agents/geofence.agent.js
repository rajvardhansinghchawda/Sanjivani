import { AgentBase } from './base.agent';
import { axiosInstance as api } from '@/lib/axios';

const BASE = '/geofence';

class GeofenceAgent extends AgentBase {
  async getZones() {
    return this._get(api.get(`${BASE}/zones/`));
  }

  async createZone(data) {
    return this._post(api.post(`${BASE}/zones/`, data));
  }

  async updateZone(id, data) {
    return this._patch(api.patch(`${BASE}/zones/${id}/`, data));
  }

  async deleteZone(id) {
    return this._delete(api.delete(`${BASE}/zones/${id}/`));
  }

  async getEvents(params = {}) {
    return this._get(api.get(`${BASE}/event/`, { params }));
  }
}

export const geofenceAgent = new GeofenceAgent();
