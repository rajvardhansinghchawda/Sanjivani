import { AgentBase } from './base.agent';
import { axiosInstance as api } from '@/lib/axios';

const BASE = '/vitals';

class VitalsAgent extends AgentBase {
  async getReadings(params = {}) {
    return this._get(api.get(`${BASE}/readings/`, { params }));
  }

  async addReading(data) {
    return this._post(api.post(`${BASE}/readings/`, data));
  }

  async deleteReading(id) {
    return this._delete(api.delete(`${BASE}/readings/${id}/`));
  }

  async getTargets() {
    return this._get(api.get(`${BASE}/targets/`));
  }

  async setTarget(data) {
    return this._post(api.post(`${BASE}/targets/`, data));
  }

  async updateTarget(id, data) {
    return this._patch(api.patch(`${BASE}/targets/${id}/`, data));
  }
}

export const vitalsAgent = new VitalsAgent();
