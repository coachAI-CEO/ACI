/**
 * Feature checking utilities for subscription plans
 */

import { fetchAuthMe } from "@/lib/auth-me";

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
  /** API feature flag TACTICAL_BOARD_V1 — not subscription-tied. */
  tacticalBoardV1?: boolean;
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
    tacticalBoardV1: false,
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
    tacticalBoardV1: false,
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
    tacticalBoardV1: false,
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
    tacticalBoardV1: false,
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
    tacticalBoardV1: false,
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
    tacticalBoardV1: false,
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
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!accessToken) {
      return getFeaturesForPlan("FREE");
    }

    const data = await fetchAuthMe();
    if (!data?.ok) {
      return getFeaturesForPlan("FREE");
    }

    if (data.user?.features && typeof data.user.features === "object") {
      return data.user.features as UserFeatures;
    }

    if (typeof data.user?.subscriptionPlan === "string") {
      return getFeaturesForPlan(data.user.subscriptionPlan);
    }

    return getFeaturesForPlan("FREE");
  } catch (error) {
    console.error("Error fetching user features:", error);
    return getFeaturesForPlan("FREE");
  }
}
