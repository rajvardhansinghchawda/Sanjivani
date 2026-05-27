const CHANNEL_NAME = 'medadhere-tab-sync';

export const TAB_EVENTS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  SUBSCRIPTION_CHANGED: 'SUBSCRIPTION_CHANGED',
};

class TabSync {
  constructor() {
    this.handlers = new Map();
    this.channel = null;
    this.boundStorageHandler = this.onStorageEvent.bind(this);
  }

  init() {
    if (typeof window === 'undefined') return;

    if (typeof BroadcastChannel !== 'undefined' && !this.channel) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => this.dispatch(event.data);
    }

    window.addEventListener('storage', this.boundStorageHandler);
  }

  on(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName).add(handler);

    return () => {
      this.handlers.get(eventName)?.delete(handler);
    };
  }

  emit(eventName, payload = {}) {
    const message = { eventName, payload, ts: Date.now() };

    if (this.channel) {
      this.channel.postMessage(message);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(CHANNEL_NAME, JSON.stringify(message));
      localStorage.removeItem(CHANNEL_NAME);
    }

    this.dispatch(message);
  }

  onStorageEvent(event) {
    if (event.key !== CHANNEL_NAME || !event.newValue) return;

    try {
      const message = JSON.parse(event.newValue);
      this.dispatch(message);
    } catch {
      // Ignore malformed cross-tab payloads.
    }
  }

  dispatch(message) {
    const eventHandlers = this.handlers.get(message?.eventName);
    if (!eventHandlers) return;

    eventHandlers.forEach((handler) => {
      try {
        handler(message.payload);
      } catch (err) {
        console.error('[tabSync] handler error:', err);
      }
    });
  }
}

export const tabSync = new TabSync();
