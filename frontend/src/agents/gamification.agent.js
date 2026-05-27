import { AgentBase } from './base.agent';
import { axiosInstance as api } from '@/lib/axios';

const GAMIFICATION_BASE = '/gamification';

class GamificationAgent extends AgentBase {
  async getSummary() {
    return this._get(api.get(`${GAMIFICATION_BASE}/summary/`));
  }

  async getBadges() {
    return this._get(api.get(`${GAMIFICATION_BASE}/badges/`));
  }

  async getScores() {
    return this._get(api.get(`${GAMIFICATION_BASE}/scores/`));
  }

  async pingStreak() {
    return this._post(api.post(`${GAMIFICATION_BASE}/ping/`));
  }
}

export const gamificationAgent = new GamificationAgent();
