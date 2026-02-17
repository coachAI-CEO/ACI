import { SubscriptionPlan } from "@prisma/client";

export type BillingPlanKey = "starter" | "club_pro";

export const BILLING_PLAN_MAP: Record<
  BillingPlanKey,
  {
    appPlan: SubscriptionPlan;
    envPriceKey: string;
    trialDays: number;
  }
> = {
  starter: {
    appPlan: "COACH_BASIC",
    envPriceKey: "STRIPE_PRICE_STARTER",
    trialDays: 7,
  },
  club_pro: {
    appPlan: "CLUB_STANDARD",
    envPriceKey: "STRIPE_PRICE_CLUB_PRO",
    trialDays: 0,
  },
};

export function getStripePriceId(plan: BillingPlanKey): string | null {
  const envKey = BILLING_PLAN_MAP[plan].envPriceKey;
  const priceId = process.env[envKey];
  return priceId || null;
}

export function getAppPlanFromPriceId(priceId: string): SubscriptionPlan | null {
  const entries = Object.entries(BILLING_PLAN_MAP) as Array<
    [BillingPlanKey, (typeof BILLING_PLAN_MAP)[BillingPlanKey]]
  >;

  for (const [, config] of entries) {
    if (process.env[config.envPriceKey] === priceId) {
      return config.appPlan;
    }
  }

  return null;
}
