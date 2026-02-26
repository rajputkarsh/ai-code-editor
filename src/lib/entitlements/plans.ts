import type { Entitlements, SubscriptionPlan } from './types';

const PLAN_MATRIX: Record<SubscriptionPlan, Omit<Entitlements, 'plan'>> = {
  free: {
    canUseAgentMode: false,
    maxAiTokensPerMonth: 100_000,
    canAccessPrivateRepos: false,
    maxWorkspaces: 1,
    canUseTeamFeatures: false,
  },
  pro: {
    canUseAgentMode: true,
    maxAiTokensPerMonth: 1_000_000,
    canAccessPrivateRepos: true,
    maxWorkspaces: 25,
    canUseTeamFeatures: false,
  },
  team: {
    canUseAgentMode: true,
    maxAiTokensPerMonth: 3_000_000,
    canAccessPrivateRepos: true,
    maxWorkspaces: 100,
    canUseTeamFeatures: true,
  },
};

export function buildEntitlements(plan: SubscriptionPlan): Entitlements {
  return {
    plan,
    ...PLAN_MATRIX[plan],
  };
}

