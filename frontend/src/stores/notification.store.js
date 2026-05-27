import { create } from 'zustand';

export const useNotificationStore = create((set) => ({
  notifications: [], // max 50 in memory
  unreadCount: 0,

  push: (notification) => set((state) => {
    const newNotif = {
      id: notification.id ?? crypto.randomUUID(),
      title: notification.title,
      body: notification.body,
      type: notification.type,
      data: notification.data,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [newNotif, ...state.notifications].slice(0, 50);
    return {
      notifications: updated,
      unreadCount: state.unreadCount + 1,
    };
  }),

  markRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),

  markAllRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  dismiss: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
    unreadCount: state.notifications.find((n) => n.id === id && !n.read)
      ? Math.max(0, state.unreadCount - 1)
      : state.unreadCount,
  })),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
