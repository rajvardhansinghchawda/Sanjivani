import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorAgent } from '@/agents/doctor.agent';

export function useConsultations() {
  return useQuery({
    queryKey: ['doctor-consultations'],
    queryFn: () => doctorAgent.getConsultations(),
  });
}

export function useAllDoctors() {
  return useQuery({
    queryKey: ['all-doctors'],
    queryFn: () => doctorAgent.getAllDoctors(),
  });
}

export function useMyDoctorPrescriptions() {
  return useQuery({
    queryKey: ['my-doctor-prescriptions'],
    queryFn: () => doctorAgent.getMyDoctorPrescriptions(),
  });
}

export function useRequestConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doctorProfileId) => doctorAgent.requestConsultation(doctorProfileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-consultations'] }),
  });
}

export function useAcceptConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId) => doctorAgent.acceptConsultation(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-consultations'] }),
  });
}

export function useRejectConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId) => doctorAgent.rejectConsultation(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-consultations'] }),
  });
}

export function useEndConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, notes }) => doctorAgent.endConsultation(sessionId, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-consultations'] }),
  });
}

export function useRespondToPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prescriptionId, accepted }) => doctorAgent.respondToPrescription(prescriptionId, accepted),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-doctor-prescriptions'] }),
  });
}
