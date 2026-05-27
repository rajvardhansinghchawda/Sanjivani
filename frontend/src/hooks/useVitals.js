import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vitalsAgent } from '@/agents/vitals.agent';
import { qk, STALE } from './qk';

// ─── Readings ─────────────────────────────────────────────────────────────────

export const useVitalReadings = (params = {}) => {
  return useQuery({
    queryKey: qk.vitals.history(params.vital_type ?? 'all'),
    queryFn: () => vitalsAgent.getReadings(params),
    staleTime: STALE.ADHERENCE_RATE,
    select: (res) => {
      const items = Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);
      return items;
    },
  });
};

export const useAddVitalReading = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => vitalsAgent.addReading(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.vitals.all() });
    },
  });
};

export const useDeleteVitalReading = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => vitalsAgent.deleteReading(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.vitals.all() });
    },
  });
};

// ─── Targets ──────────────────────────────────────────────────────────────────

export const useVitalTargets = () => {
  return useQuery({
    queryKey: qk.vitals.targets(),
    queryFn: () => vitalsAgent.getTargets(),
    staleTime: STALE.MEDICATION_LIST,
    select: (res) => {
      const items = Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);
      return items;
    },
  });
};

export const useSetVitalTarget = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => vitalsAgent.setTarget(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.vitals.targets() });
    },
  });
};

export const useUpdateVitalTarget = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => vitalsAgent.updateTarget(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.vitals.targets() });
    },
  });
};
