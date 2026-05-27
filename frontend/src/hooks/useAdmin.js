import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';

const ADMIN_API = '/admin';

// Let's check axiosInstance definition
// Actually, I can just export functions directly
export const adminApi = {
  getOverviewMetrics: async () => {
    // If axiosInstance baseURL is /api/v1, we need to pass the absolute path, but it's simpler to just overwrite it or use a raw axios
    // Assuming we can just use the regular instance if we pass the full path or configure it.
    // Let's assume axiosInstance baseURL is standard so we might need to handle the URL correctly.
    // I will use relative to origin just in case or assume baseURL is just empty or standard.
    // Wait, the API endpoint is /admin/api/v1/
    const { data } = await axiosInstance.get(`${ADMIN_API}/metrics/overview/`);
    return data?.data || data;
  },
  getAdherenceMetrics: async () => {
    const { data } = await axiosInstance.get(`${ADMIN_API}/metrics/adherence/`);
    return data?.data || data;
  },
  getUsers: async () => {
    const { data } = await axiosInstance.get(`${ADMIN_API}/users/`);
    return data?.data || data;
  },
  deactivateUser: async (id) => {
    const { data } = await axiosInstance.patch(`${ADMIN_API}/users/${id}/deactivate/`);
    return data?.data || data;
  },
  getSubscriptions: async () => {
    const { data } = await axiosInstance.get(`${ADMIN_API}/subscriptions/`);
    return data?.data || data;
  },
  extendSubscription: async ({ id, days }) => {
    const { data } = await axiosInstance.patch(`${ADMIN_API}/subscriptions/${id}/extend/`, { days });
    return data?.data || data;
  },
  getDeviceInventory: async () => {
    const { data } = await axiosInstance.get(`${ADMIN_API}/devices/inventory/`);
    return data?.data || data;
  },
  generateDeviceIds: async (payload) => {
    const { data } = await axiosInstance.post(`${ADMIN_API}/devices/generate-ids/`, payload);
    return data?.data || data;
  },
  getSystemJobs: async () => {
    const { data } = await axiosInstance.get(`${ADMIN_API}/system/jobs/`);
    return data?.data || data;
  },
  getNotificationRates: async () => {
    const { data } = await axiosInstance.get(`${ADMIN_API}/notifications/delivery-rates/`);
    return data?.data || data;
  },
  testNotification: async (payload) => {
    const { data } = await axiosInstance.post(`${ADMIN_API}/notifications/test/`, payload);
    return data?.data || data;
  }
};

export const useAdminMetrics = () => {
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: adminApi.getOverviewMetrics,
  });
};

export const useAdminAdherence = () => {
  return useQuery({
    queryKey: ['admin-adherence'],
    queryFn: adminApi.getAdherenceMetrics,
  });
};

export const useAdminUsers = () => {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getUsers,
  });
};

export const useAdminDeactivateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
};

export const useAdminSubscriptions = () => {
  return useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: adminApi.getSubscriptions,
  });
};

export const useAdminExtendSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.extendSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
  });
};

export const useAdminDeviceInventory = () => {
  return useQuery({
    queryKey: ['admin-device-inventory'],
    queryFn: adminApi.getDeviceInventory,
  });
};

export const useAdminGenerateDeviceIds = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.generateDeviceIds,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-device-inventory'] });
    },
  });
};

export const useAdminSystemJobs = () => {
  return useQuery({
    queryKey: ['admin-system-jobs'],
    queryFn: adminApi.getSystemJobs,
  });
};

export const useAdminNotificationRates = () => {
  return useQuery({
    queryKey: ['admin-notification-rates'],
    queryFn: adminApi.getNotificationRates,
  });
};

export const useAdminTestNotification = () => {
  return useMutation({
    mutationFn: adminApi.testNotification,
  });
};
