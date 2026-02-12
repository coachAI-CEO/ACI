/**
 * Feature checking utilities for subscription plans
 */

export type SubscriptionPlan = 'FREE' | 'COACH_BASIC' | 'COACH_PRO' | 'CLUB_STANDARD' | 'CLUB_PREMIUM' | 'TRIAL';

export interface UserFeatures {
  canExportPDF: boolean;
  canGenerateSeries: boolean;
  canUseAdvancedFilters: boolean;
  canAccessCalendar: boolean;
  canCreatePlayerPlans: boolean;
  canGenerateWeeklySummaries: boolean;
  canInviteCoaches: boolean;
  canManageOrganization: boolean;
}

// Feature mapping - must match backend SUBSCRIPTION_LIMITS
const FEATURES_BY_PLAN: Record<SubscriptionPlan, UserFeatures> = {
  FREE: {
    canExportPDF: false,
    canGenerateSeries: false,
    canUseAdvancedFilters: false,
    canAccessCalendar: false,
    canCreatePlayerPlans: false,
    canGenerateWeeklySummaries: false,
    canInviteCoaches: false,
    canManageOrganization: false,
  },
  COACH_BASIC: {
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: false,
    canManageOrganization: false,
  },
  COACH_PRO: {
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: false,
    canManageOrganization: false,
  },
  CLUB_STANDARD: {
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: true,
    canManageOrganization: true,
  },
  CLUB_PREMIUM: {
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: true,
    canManageOrganization: true,
  },
  TRIAL: {
    canExportPDF: true,
    canGenerateSeries: true,
    canUseAdvancedFilters: true,
    canAccessCalendar: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canInviteCoaches: false,
    canManageOrganization: false,
  },
};

/**
 * Get features for a subscription plan
 */
export function getFeaturesForPlan(plan: SubscriptionPlan | string | null | undefined): UserFeatures {
  const planKey = (plan || 'FREE') as SubscriptionPlan;
  return FEATURES_BY_PLAN[planKey] || FEATURES_BY_PLAN.FREE;
}

/**
 * Fetch user features from API
 */
export async function fetchUserFeatures(): Promise<UserFeatures | null> {
  try {
    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!accessToken) {
      return getFeaturesForPlan('FREE');
    }

    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return getFeaturesForPlan('FREE');
    }

    const data = await response.json();
    if (data.ok && data.user?.features) {
      return data.user.features;
    }

    // Fallback to plan-based features
    if (data.ok && data.user?.subscriptionPlan) {
      return getFeaturesForPlan(data.user.subscriptionPlan);
    }

    return getFeaturesForPlan('FREE');
  } catch (error) {
    console.error('Error fetching user features:', error);
    return getFeaturesForPlan('FREE');
  }
}
