import { create } from 'zustand';

export const useUiStore = create((set) => ({
  // Layout
  sidebarOpen: false,
  sidebarPinned: false, // desktop: pinned vs hover

  // Active patient context (caregiver switches between patients)
  activePatientId: null,

  // Theme
  theme: 'light', // 'light' | 'dark' | 'system'
  elderlyMode: false, // increases font sizes + touch targets

  // Language
  language: 'en',

  // Offline indicator
  isOnline: navigator.onLine,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActivePatient: (id) => set({ activePatientId: id }),
  setTheme: (t) => set({ theme: t }),
  setElderlyMode: (v) => set({ elderlyMode: v }),
  setLanguage: (l) => set({ language: l }),
  setOnline: (v) => set({ isOnline: v }),
}));
