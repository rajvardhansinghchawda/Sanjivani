import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { qk, STALE } from './qk';

/**
 * Fetch all patient conditions
 */
export function useConditions() {
  return useQuery({
    queryKey: qk.patient.conditions(),
    queryFn: async () => {
      const res = await axiosInstance.get('/patients/me/conditions/');
      const data = res.data?.data ?? res.data;
      return Array.isArray(data) ? data : [];
    },
    staleTime: STALE.USER_PROFILE,
  });
}

/**
 * Create a new condition
 */
export function useCreateCondition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post('/patients/me/conditions/', data);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.patient.conditions() });
    },
  });
}

/**
 * Delete a condition
 */
export function useDeleteCondition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conditionId) => {
      const res = await axiosInstance.delete(`/patients/me/conditions/${conditionId}/`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.patient.conditions() });
    },
  });
}

/**
 * Mark patient as hospitalized
 */
export function useHospitalize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.patch('/patients/me/hospitalize/', data);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.patient.profile() });
    },
  });
}

/**
 * Mark patient as discharged
 */
export function useDischarge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.patch('/patients/me/discharge/');
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.patient.profile() });
    },
  });
}

/**
 * Fetch patient profile to check hospitalization status
 */
export function usePatientHospitalizationStatus() {
  return useQuery({
    queryKey: qk.patient.profile(),
    queryFn: async () => {
      const res = await axiosInstance.get('/patients/me/');
      return res.data?.data ?? res.data;
    },
    staleTime: STALE.USER_PROFILE,
  });
}
