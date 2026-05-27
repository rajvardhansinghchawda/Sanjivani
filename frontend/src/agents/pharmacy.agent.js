import { AgentBase } from './base.agent';
import { axiosInstance as api } from '@/lib/axios';

const BASE = '/pharmacy';

class PharmacyAgent extends AgentBase {
  async getPartners(params = {}) {
    return this._get(api.get(`${BASE}/partners/`, { params }));
  }

  async getRefillOrders(params = {}) {
    return this._get(api.get(`${BASE}/refill-orders/`, { params }));
  }

  async createRefillOrder(data) {
    return this._post(api.post(`${BASE}/refill-orders/`, data));
  }

  async getAutoRefillSettings() {
    return this._get(api.get(`${BASE}/integration/auto-refill/`));
  }

  async toggleAutoRefill(data) {
    return this._patch(api.patch(`${BASE}/integration/auto-refill/`, data));
  }
}

export const pharmacyAgent = new PharmacyAgent();
