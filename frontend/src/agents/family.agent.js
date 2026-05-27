import { AgentBase } from './base.agent';
import { axiosInstance as api } from '@/lib/axios';

const FAMILY_BASE = '/family';

class FamilyAgent extends AgentBase {
  async getGroups() {
    return this._get(api.get(`${FAMILY_BASE}/groups/`));
  }

  async createGroup(data) {
    return this._post(api.post(`${FAMILY_BASE}/groups/`, data));
  }

  async getGroup(id) {
    return this._get(api.get(`${FAMILY_BASE}/groups/${id}/`));
  }

  async updateGroup(id, data) {
    return this._patch(api.patch(`${FAMILY_BASE}/groups/${id}/`, data));
  }

  async inviteMember(groupId, data) {
    return this._post(api.post(`${FAMILY_BASE}/groups/${groupId}/invite/`, data));
  }
}

export const familyAgent = new FamilyAgent();
