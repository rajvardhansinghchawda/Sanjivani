import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prescriptionAgent } from '@/agents/prescription.agent';
import { STALE } from './qk';

// ─── Query keys (extend global qk) ──────────────────────────────────────────

const prescriptionKeys = {
  all:    ()     => ['prescriptions'],
  list:   (f)    => ['prescriptions', 'list', f ?? 'all'],
  detail: (id)   => ['prescriptions', 'detail', id],
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** List all prescriptions for the logged-in patient. */
export function usePrescriptions({ isActive } = {}) {
  return useQuery({
    queryKey: prescriptionKeys.list({ isActive }),
    queryFn:  () => prescriptionAgent.list({ isActive }),
    staleTime: STALE.MEDICATION_LIST,
    // Normalise: backend wraps in APIResponse.success → { data: [...] } or raw array
    select: (res) => {
      const items = Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);
      return items;
    },
  });
}

/** Create a new prescription. */
export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => prescriptionAgent.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prescriptionKeys.all() });
    },
  });
}

/** Patch an existing prescription (e.g. pause/resume via is_active). */
export function usePatchPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => prescriptionAgent.patch(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prescriptionKeys.all() });
    },
  });
}

/** Soft-delete a prescription. */
export function useDeletePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => prescriptionAgent.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prescriptionKeys.all() });
    },
  });
}
