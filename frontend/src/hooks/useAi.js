import { useQuery } from '@tanstack/react-query';
import { aiAgent } from '@/agents/ai.agent';
import { qk, STALE } from './qk';
import { useSubscriptionStore } from '@/stores/subscription.store';

export const useRiskScore = (patientId) => {
  const hasFeature = useSubscriptionStore((state) => state.hasFeature);
  return useQuery({
    queryKey: qk.ai.riskScore(patientId),
    queryFn: () => aiAgent.getRiskScore(patientId),
    staleTime: STALE.RISK_SCORE,
    enabled: hasFeature('ai_risk_score'),
  });
};

export const useInsights = (patientId) => {
  const hasFeature = useSubscriptionStore((state) => state.hasFeature);
  return useQuery({
    queryKey: qk.ai.insights(patientId),
    queryFn: () => aiAgent.getInsights(patientId),
    staleTime: STALE.AI_INSIGHTS,
    enabled: hasFeature('ai_insights_weekly'),
  });
};

export const useRecommendations = (patientId) => {
  const hasFeature = useSubscriptionStore((state) => state.hasFeature);
  return useQuery({
    queryKey: ['ai', 'recommendations', patientId],
    queryFn: () => aiAgent.getRecommendations(patientId),
    staleTime: STALE.AI_INSIGHTS,
    enabled: hasFeature('ai_insights_weekly'),
  });
};
