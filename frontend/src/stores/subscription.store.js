import { create } from 'zustand';

export const useSubscriptionStore = create((set, get) => ({
  plan: 'free',
  status: null, // 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED'
  renewsAt: null,
  features: {
    max_medications: 3,
    max_caregivers: 1,
    ai_risk_score: false,
    ai_insights_weekly: false,
    ai_insights_realtime: false,
    caregiver_alerts: false,
    hardware_linking: false,
    whatsapp_reminders: false,
    voice_call_reminders: false,
    report_history_days: 7,
    data_export: false,
    pharmacy_auto_refill: false,
    geofence: false,
    reminder_channels: ['push'],
  },

  setSubscription: (sub) => set({
    plan: sub.plan_name,
    status: sub.status,
    renewsAt: sub.renews_at,
    features: sub.features,
  }),

  hasFeature: (key) => {
    const val = get().features[key];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val > 0;
    return false;
  },

  getLimit: (key) => {
    const val = get().features[key];
    if (typeof val === 'number') return val;
    return val === true ? Infinity : 0;
  },

  isAtLimit: (key, currentCount) => {
    const limit = get().getLimit(key);
    return currentCount >= limit;
  },

  isPremium: () => get().plan === 'premium',
  isFreemium: () => ['freemium', 'premium'].includes(get().plan),
  isFree: () => get().plan === 'free',
}));
