import { useAuthStore } from '@/stores/auth.store';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useNotificationStore } from '@/stores/notification.store';
import { tabSync, TAB_EVENTS } from '@/lib/tabSync';
import { offlineDoseQueue } from '@/lib/offline';

export const ORC_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  DOSE_LOGGED: 'DOSE_LOGGED',
  SUBSCRIPTION_CHANGED: 'SUBSCRIPTION_CHANGED',
  WS_CONNECTED: 'WS_CONNECTED',
  WS_DISCONNECTED: 'WS_DISCONNECTED',
  POLL_FALLBACK: 'POLL_FALLBACK',
  PROMPT_NOTIF_PERMISSION: 'PROMPT_NOTIF_PERMISSION',
  
  // WebSocket events
  DOSE_STATUS_UPDATE: 'DOSE_STATUS_UPDATE',
  HIGH_RISK_ALERT: 'HIGH_RISK_ALERT',
  ESCALATION_TRIGGERED: 'ESCALATION_TRIGGERED',
  DEVICE_LOW_BATTERY: 'DEVICE_LOW_BATTERY',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  NEW_DIGITAL_RX: 'NEW_DIGITAL_RX',
  SUBSCRIPTION_UPGRADED: 'SUBSCRIPTION_UPGRADED',
  CAREGIVER_ALERT: 'CAREGIVER_ALERT',
};

class FrontendOrchestrator {
  _handlers = {};
  _firstDoseLogged = false;

  on(event, handler) {
    if (!this._handlers[event]) {
      this._handlers[event] = new Set();
    }
    this._handlers[event].add(handler);
    return () => this._handlers[event].delete(handler);
  }

  emit(event, payload = {}) {
    this._handlers[event]?.forEach((fn) => {
      try { fn(payload); }
      catch (err) { console.error(`[Orchestrator] Handler error for ${event}:`, err); }
    });
  }

  bootstrap() {
    this.on(ORC_EVENTS.LOGIN_SUCCESS, ({ user, subscription }) => {
      offlineDoseQueue.flush();
      if (subscription) {
        useSubscriptionStore.getState().setSubscription(subscription);
      }
      tabSync.emit(TAB_EVENTS.LOGIN, { user });
    });

    this.on(ORC_EVENTS.LOGOUT, () => {
      useNotificationStore.getState().clear();
      // queryClient.clear() should ideally be injected or called from here if possible, 
      // but to avoid circular deps we might do it where the queryClient is instantiated.
    });

    this.on(ORC_EVENTS.DOSE_LOGGED, () => {
      if (!this._firstDoseLogged) {
        this._firstDoseLogged = true;
        setTimeout(() => this.emit(ORC_EVENTS.PROMPT_NOTIF_PERMISSION), 2000);
      }
    });

    this.on(ORC_EVENTS.HIGH_RISK_ALERT, (alert) => {
      useNotificationStore.getState().push({ type: 'high_risk', ...alert });
    });

    this.on(ORC_EVENTS.NEW_DIGITAL_RX, (rx) => {
      useNotificationStore.getState().push({ type: 'digital_rx', ...rx });
    });

    this.on(ORC_EVENTS.SUBSCRIPTION_UPGRADED, (sub) => {
      useSubscriptionStore.getState().setSubscription(sub);
      tabSync.emit(TAB_EVENTS.SUBSCRIPTION_CHANGED, sub);
    });

    // TabSync bindings
    tabSync.on(TAB_EVENTS.SUBSCRIPTION_CHANGED, (sub) => {
      useSubscriptionStore.getState().setSubscription(sub);
    });
    
    tabSync.on(TAB_EVENTS.LOGOUT, () => {
      useAuthStore.getState().clearSession();
      // React Router's ProtectedRoute handles the /login redirect automatically.
      // window.location.href caused a hard reload that wiped fresh tokens mid-navigation.
    });
    
    tabSync.on(TAB_EVENTS.TOKEN_REFRESHED, ({ accessToken }) => {
      useAuthStore.getState().setAccessToken(accessToken);
    });
  }
}

export const frontendOrchestrator = new FrontendOrchestrator();
