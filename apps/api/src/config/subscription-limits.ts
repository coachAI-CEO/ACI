export const SUBSCRIPTION_LIMITS = {
  FREE: {
    sessionsPerMonth: 5,
    drillsPerMonth: 10,
    vaultSessions: 10,
    vaultDrills: 20,
    canExportPDF: false,
    canGenerateSeries: false,
    canUseAdvancedFilters: false,
    canAccessCalendar: false,
    canCreatePlayerPlans: false,
    canGenerateWeeklySummaries: false,
    canInviteCoaches: false,
    canManageOrganization: false,
    maxFavorites: 20,
  },
  COACH_BASIC: {
    sessionsPerMonth: 30,
    drillsPerMonth: 100,
    vaultSessions: 100,
    vaultDrills: 500,
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: false,
    canManageOrganization: false,
    maxFavorites: 500,
  },
  COACH_PRO: {
    sessionsPerMonth: 100,
    drillsPerMonth: 500,
    vaultSessions: 1000,
    vaultDrills: 5000,
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: false,
    canManageOrganization: false,
    maxFavorites: 5000,
  },
  CLUB_STANDARD: {
    sessionsPerMonth: 200,
    drillsPerMonth: 1000,
    vaultSessions: 5000,
    vaultDrills: 10000,
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: true,
    canManageOrganization: true,
    maxFavorites: 10000,
    maxCoaches: 5,
  },
  CLUB_PREMIUM: {
    sessionsPerMonth: -1, // Unlimited
    drillsPerMonth: -1,
    vaultSessions: -1,
    vaultDrills: -1,
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: true,
    canManageOrganization: true,
    maxFavorites: -1,
    maxCoaches: -1,
  },
  TRIAL: {
    sessionsPerMonth: 10,
    drillsPerMonth: 20,
    vaultSessions: 20,
    vaultDrills: 40,
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: false,
    canManageOrganization: false,
    maxFavorites: 50,
    trialDays: 7,
  },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_LIMITS;

const FEATURE_KEYS = [
  "canExportPDF",
  "canGenerateSeries",
  "canUseAdvancedFilters",
  "canAccessCalendar",
  "canCreatePlayerPlans",
  "canGenerateWeeklySummaries",
  "canInviteCoaches",
  "canManageOrganization",
] as const;

export type SubscriptionFeatureKey = typeof FEATURE_KEYS[number];
export type SubscriptionFeatures = Record<SubscriptionFeatureKey, boolean>;

export function getFeaturesForPlan(
  plan: SubscriptionPlan | string | null | undefined
): SubscriptionFeatures {
  const planKey = (plan && plan in SUBSCRIPTION_LIMITS ? plan : "FREE") as SubscriptionPlan;
  const limits = SUBSCRIPTION_LIMITS[planKey];
  return {
    canExportPDF: limits.canExportPDF,
    canGenerateSeries: limits.canGenerateSeries,
    canUseAdvancedFilters: limits.canUseAdvancedFilters,
    canAccessCalendar: limits.canAccessCalendar,
    canCreatePlayerPlans: limits.canCreatePlayerPlans,
    canGenerateWeeklySummaries: limits.canGenerateWeeklySummaries,
    canInviteCoaches: limits.canInviteCoaches,
    canManageOrganization: limits.canManageOrganization,
  };
}

export function getFeaturesForUser(input: {
  subscriptionPlan?: SubscriptionPlan | string | null;
  adminRole?: string | null;
}): SubscriptionFeatures {
  if (input.adminRole === "SUPER_ADMIN") {
    return {
      canExportPDF: true,
      canGenerateSeries: true,
      canUseAdvancedFilters: true,
      canAccessCalendar: true,
      canCreatePlayerPlans: true,
      canGenerateWeeklySummaries: true,
      canInviteCoaches: true,
      canManageOrganization: true,
    };
  }
  return getFeaturesForPlan(input.subscriptionPlan);
}
