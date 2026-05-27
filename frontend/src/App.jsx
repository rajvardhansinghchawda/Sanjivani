import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppRouter } from '@/routes';
import { frontendOrchestrator } from '@/agents/orchestrator';
import { tabSync } from '@/lib/tabSync';
import { useAuthStore } from '@/stores/auth.store';
import { axiosInstance } from '@/lib/axios';

export default function App() {
  useEffect(() => {
    // Bootstrap the event bus and cross-tab syncing
    frontendOrchestrator.bootstrap();
    tabSync.init();

    // Request browser notification permission once
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const initAuth = async () => {
      const { accessToken, refreshToken, user, setSession, setInitialized } = useAuthStore.getState();

      // If we already have a valid access token, we're good
      if (accessToken && user) {
        setInitialized(true);
        return;
      }

      // If we have a refresh token, try to get a new access token
      if (refreshToken && user) {
        try {
          const res = await axiosInstance.post('/auth/refresh/', { refresh: refreshToken }, { _retry: true });
          const access = res?.data?.data?.access;
          if (access) {
            // Update only the access token, keep everything else
            setSession({ accessToken: access, refreshToken, user });
            setInitialized(true);
            return;
          }
        } catch (err) {
          console.error('Token refresh failed:', err?.message);
          // Only clear stale tokens if the user hasn't already logged in concurrently
          // (race condition: user submits login form while initAuth refresh is in-flight)
          if (!useAuthStore.getState().accessToken) {
            useAuthStore.getState().clearSession();
          }
        }
      }

      // No valid session, mark as initialized so login page can show
      if (!useAuthStore.getState().accessToken) {
        setInitialized(true);
      }
    };

    initAuth();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}
