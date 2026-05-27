import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pharmacyAgent } from '@/agents/pharmacy.agent';
import { STALE } from './qk';

const pharmacyKeys = {
  all:          () => ['pharmacy'],
  partners:     (f) => ['pharmacy', 'partners', f],
  refillOrders: (f) => ['pharmacy', 'refill-orders', f],
  autoRefill:   () => ['pharmacy', 'auto-refill'],
};

export const usePharmacyPartners = (params = {}) => {
  return useQuery({
    queryKey: pharmacyKeys.partners(params),
    queryFn:  () => pharmacyAgent.getPartners(params),
    staleTime: STALE.MEDICATION_LIST,
    select: (res) => Array.isArray(res) ? res : (res?.data ?? res?.results ?? []),
  });
};

export const useRefillOrders = (params = {}) => {
  return useQuery({
    queryKey: pharmacyKeys.refillOrders(params),
    queryFn:  () => pharmacyAgent.getRefillOrders(params),
    staleTime: STALE.ADHERENCE_RATE,
    select: (res) => Array.isArray(res) ? res : (res?.data ?? res?.results ?? []),
  });
};

export const useCreateRefillOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => pharmacyAgent.createRefillOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pharmacyKeys.all() });
    },
  });
};

export const useAutoRefillSettings = () => {
  return useQuery({
    queryKey: pharmacyKeys.autoRefill(),
    queryFn:  () => pharmacyAgent.getAutoRefillSettings(),
    staleTime: STALE.MEDICATION_LIST,
  });
};

export const useToggleAutoRefill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => pharmacyAgent.toggleAutoRefill(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pharmacyKeys.autoRefill() });
    },
  });
};
