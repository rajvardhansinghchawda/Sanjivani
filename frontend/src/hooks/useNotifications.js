import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { qk } from './qk';

/**
 * Fetch notifications for the logged in user
 */
export function useNotifications(params = {}) {
  return useQuery({
    queryKey: [...qk.notification.history(params.page || 1), params],
    queryFn: async () => {
      const res = await axiosInstance.get('/notifications/', { params });
      // The backend returns a paginated response with a list of results and unread_count
      const data = res.data?.results ?? res.data?.data?.results ?? res.data?.data ?? [];
      const unreadCount = res.data?.unread_count ?? res.data?.data?.unread_count ?? 0;
      return {
        results: Array.isArray(data) ? data : [],
        unreadCount,
      };
    },
    refetchInterval: 30_000, // Poll every 30s to keep it real-time
  });
}

/**
 * Mark a single notification as read
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await axiosInstance.patch(`/notifications/${id}/read/`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification'] });
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.patch('/notifications/read-all/');
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification'] });
    },
  });
}

/**
 * Delete a notification
 */
export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await axiosInstance.delete(`/notifications/${id}/`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification'] });
    },
  });
}
