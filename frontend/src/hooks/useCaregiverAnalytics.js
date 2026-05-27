import { useQuery } from '@tanstack/react-query';
import { caregiverAgent } from '@/agents/caregiver.agent';

export function useCaregiverDashboardSummary() {
  return useQuery({
    queryKey: ['caregiver', 'dashboard', 'summary'],
    queryFn: () => caregiverAgent.getDashboardSummary(),
    staleTime: 60_000,
  });
}

export function useCaregiverCohort() {
  return useQuery({
    queryKey: ['caregiver', 'dashboard', 'cohort'],
    queryFn: () => caregiverAgent.getPatientCohort(),
    staleTime: 60_000,
  });
}
