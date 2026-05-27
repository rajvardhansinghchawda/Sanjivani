import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamificationAgent } from '@/agents/gamification.agent';
import { qk, STALE } from './qk';

export const useGamificationSummary = () => {
  return useQuery({
    queryKey: ['gamification', 'summary'],
    queryFn: () => gamificationAgent.getSummary(),
    staleTime: STALE.USER_PROFILE,
  });
};

export const useBadges = () => {
  return useQuery({
    queryKey: qk.gamification.badges(),
    queryFn: () => gamificationAgent.getBadges(),
    staleTime: STALE.USER_PROFILE,
  });
};

export const useScores = () => {
  return useQuery({
    queryKey: qk.gamification.score(),
    queryFn: () => gamificationAgent.getScores(),
    staleTime: STALE.USER_PROFILE,
  });
};

export const usePingStreak = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gamificationAgent.pingStreak(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
};
