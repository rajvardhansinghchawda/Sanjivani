const STORAGE_KEY = 'medadhere_offline_dose_queue';

class OfflineDoseQueue {
  async enqueue(payload) {
    const queue = this.read();
    queue.push({ ...payload, queuedAt: new Date().toISOString() });
    this.write(queue);
  }

  async flush() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    // Keep a simple local queue for now.
    // Replay behavior can be added when a dedicated sync endpoint is available.
    this.write([]);
  }

  read() {
    if (typeof window === 'undefined') return [];

    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  write(queue) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }
}

export const offlineDoseQueue = new OfflineDoseQueue();
