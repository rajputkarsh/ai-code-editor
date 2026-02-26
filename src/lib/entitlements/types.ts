export type SubscriptionPlan = 'free' | 'pro' | 'team';

export interface Entitlements {
  plan: SubscriptionPlan;
  canUseAgentMode: boolean;
  maxAiTokensPerMonth: number;
  canAccessPrivateRepos: boolean;
  maxWorkspaces: number;
  canUseTeamFeatures: boolean;
}
