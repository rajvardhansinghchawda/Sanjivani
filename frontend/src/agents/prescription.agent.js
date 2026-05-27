import { AgentBase } from './base.agent';
import { axiosInstance as api } from '@/lib/axios';

const PATIENTS_BASE = '/patients';

class PrescriptionAgent extends AgentBase {
  async list({ isActive } = {}) {
    const params = {};
    if (isActive !== undefined) params.is_active = isActive;
    return this._get(api.get(`${PATIENTS_BASE}/me/prescriptions/`, { params }));
  }

  async create(data) {
    return this._post(api.post(`${PATIENTS_BASE}/me/prescriptions/`, data));
  }

  async update(id, data) {
    return this._put(api.put(`${PATIENTS_BASE}/me/prescriptions/${id}/`, data));
  }

  async patch(id, data) {
    return this._patch(api.patch(`${PATIENTS_BASE}/me/prescriptions/${id}/`, data));
  }

  async remove(id) {
    return this._delete(api.delete(`${PATIENTS_BASE}/me/prescriptions/${id}/`));
  }

  async addSchedule(prescriptionId, data) {
    return this._post(api.post(`${PATIENTS_BASE}/me/prescriptions/${prescriptionId}/schedules/`, data));
  }
}

export const prescriptionAgent = new PrescriptionAgent();
