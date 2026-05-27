import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adherenceAgent } from '@/agents/adherence.agent';
import { qk, STALE } from './qk';

export function useTodayReminders() {
  return useQuery({
    queryKey: qk.adherence.today('me'),
    queryFn: () => adherenceAgent.getTodaySchedule(),
    staleTime: STALE.TODAY_SCHEDULE,
    refetchInterval: 60_000,
  });
}

export function useUpcomingReminders(days = 7) {
  return useQuery({
    queryKey: ['reminders', 'upcoming', days],
    queryFn: () => adherenceAgent.getUpcomingReminders({ days }),
    staleTime: STALE.TODAY_SCHEDULE,
  });
}

export function useReminderActions() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.adherence.today('me') });
    qc.invalidateQueries({ queryKey: ['reminders', 'upcoming'] });
    qc.invalidateQueries({ queryKey: qk.adherence.rate('me') });
    qc.invalidateQueries({ queryKey: qk.adherence.streak('me') });
  };

  const logDose = useMutation({
    mutationFn: (data) => adherenceAgent.logDose(data),
    onSuccess: invalidate,
  });

  const snooze = useMutation({
    mutationFn: ({ reminderId, minutes }) => adherenceAgent.snoozeReminder(reminderId, minutes),
    onSuccess: invalidate,
  });

  const manualDose = useMutation({
    mutationFn: (data) => adherenceAgent.logManualDose(data),
    onSuccess: invalidate,
  });

  return { logDose, snooze, manualDose };
}
