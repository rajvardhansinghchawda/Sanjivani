import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorAgent } from '@/agents/doctor.agent';
import { qk, STALE } from './qk';

/** List patients linked to the authenticated doctor. */
export function useDoctorPatients() {
  return useQuery({
    queryKey: qk.doctor.patients(),
    queryFn:  () => doctorAgent.getLinkedPatients(),
    staleTime: STALE.MEDICATION_LIST,
    select: (res) => {
      const raw = Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);
      return raw.map(link => ({
        id:           link.id,
        patientId:    link.patient,
        name:         link.patient_name ?? 'Unknown',
        patientCode:  link.patient_code ?? '',
        canViewAdherence: link.can_view_adherence ?? true,
        canReceiveAlerts: link.can_receive_alerts ?? true,
        linkedAt:     link.linked_at,
      }));
    },
  });
}

/** Doctor profile(s) */
export function useDoctorProfile() {
  return useQuery({
    queryKey: qk.doctor.profile(),
    queryFn:  () => doctorAgent.getProfile(),
    staleTime: STALE.USER_PROFILE,
    select: (res) => {
      const items = Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);
      return items[0] ?? null;
    },
  });
}

/**
 * Parallel-fetch adherence and alert data for ALL patients linked to the doctor.
 * Returns { [linkId]: { adherence, alerts, isLoading, isError } }
 */
export function useDoctorPatientsData(patients = []) {
  const queries = useQueries({
    queries: patients.flatMap(p => [
      {
        queryKey: qk.doctor.adherence(p.id),
        queryFn:  () => doctorAgent.getPatientAdherence(p.id),
        staleTime: STALE.ADHERENCE_RATE,
        enabled: !!p.id && p.canViewAdherence !== false,
      },
      {
        queryKey: qk.doctor.alerts(p.id),
        queryFn:  () => doctorAgent.getPatientAlerts(p.id),
        staleTime: STALE.CAREGIVER_ALERTS,
        enabled: !!p.id,
      },
    ]),
  });

  const result = {};
  patients.forEach((p, index) => {
    const adherenceQuery = queries[index * 2];
    const alertsQuery    = queries[index * 2 + 1];
    result[p.id] = {
      adherence: adherenceQuery?.data,
      alerts:    alertsQuery?.data || [],
      isLoading: adherenceQuery?.isLoading || alertsQuery?.isLoading,
      isError:   adherenceQuery?.isError   || alertsQuery?.isError,
    };
  });

  return result;
}

/** Create a digital prescription for a patient. */
export function useCreateDigitalPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => doctorAgent.createDigitalPrescription(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor', 'prescriptions'] });
    },
  });
}
