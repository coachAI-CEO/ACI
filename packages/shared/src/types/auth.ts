export type UsageLimit = {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
};

export type UserFeatures = {
  canExportPDF: boolean;
  canGenerateSeries: boolean;
  canUseAdvancedFilters: boolean;
  canAccessCalendar: boolean;
  canCreatePlayerPlans: boolean;
  canGenerateWeeklySummaries: boolean;
  canInviteCoaches: boolean;
  canManageOrganization: boolean;
};

export type ClubMembershipSummary = {
  id: string;
  clubId: string;
  clubName: string;
  role: string;
  gameModelId?: string | null;
};

export type BoardStamp = {
  clubId: string | null;
  clubName: string | null;
  gameModelId: string | null;
};

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  adminRole: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  coachLevel: string | null;
  organizationName: string | null;
  teamAgeGroups: string[];
  sessionsGeneratedThisMonth: number;
  drillsGeneratedThisMonth: number;
  trialEndDate: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  limits: {
    sessions: UsageLimit;
    drills: UsageLimit;
  };
  features: UserFeatures;
  clubMemberships?: ClubMembershipSummary[];
  enforcedGameModelId?: string | null;
  clubId?: string | null;
  clubName?: string | null;
  clubPhilosophy?: string | null;
  boardStamp?: BoardStamp | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthPayload = {
  user: CurrentUser;
  tokens: AuthTokens;
};

export type AuthUserSummary = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  subscriptionPlan: string;
  adminRole: string | null;
  emailVerified: boolean;
};
