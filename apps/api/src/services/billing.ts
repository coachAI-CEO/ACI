import { SubscriptionPlan, SubscriptionStatus, UserRole } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../prisma";
import { BILLING_PLAN_MAP, BillingPlanKey, getAppPlanFromPriceId, getStripePriceId } from "../config/billing-plans";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appUrl =
  process.env.APP_URL || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Missing STRIPE_SECRET_KEY.");
  }
  return stripe;
}

function resolveRoleForPlan(plan: SubscriptionPlan): UserRole {
  if (plan === "CLUB_STANDARD" || plan === "CLUB_PREMIUM") return "CLUB";
  if (plan === "COACH_BASIC" || plan === "COACH_PRO") return "COACH";
  if (plan === "TRIAL") return "TRIAL";
  return "FREE";
}

function resolveStatusFromStripe(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "trialing") return "TRIAL";
  if (status === "active") return "ACTIVE";
  return "CANCELLED";
}

function fromUnix(seconds?: number | null): Date | null {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

async function findUserByStripeCustomer(customerId: string, fallbackEmail?: string | null) {
  const stripeClient = requireStripe();
  const customer = await stripeClient.customers.retrieve(customerId);

  if (typeof customer !== "string" && !("deleted" in customer && customer.deleted)) {
    const metadataUserId = customer.metadata?.userId;
    if (metadataUserId) {
      const byId = await prisma.user.findUnique({ where: { id: metadataUserId } });
      if (byId) return byId;
    }
    const email = customer.email || fallbackEmail || null;
    if (email) {
      const byEmail = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (byEmail) return byEmail;
    }
  }

  if (fallbackEmail) {
    return prisma.user.findFirst({
      where: { email: { equals: fallbackEmail, mode: "insensitive" } },
    });
  }

  return null;
}

async function upsertUserSubscriptionFromStripeSubscription(
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null
) {
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const subscriptionItem = subscription.items.data[0];
  const stripePriceId = subscriptionItem?.price?.id || null;
  const mappedPlan = stripePriceId ? getAppPlanFromPriceId(stripePriceId) : null;

  let user = fallbackUserId ? await prisma.user.findUnique({ where: { id: fallbackUserId } }) : null;
  if (!user) {
    user = await findUserByStripeCustomer(stripeCustomerId);
  }
  if (!user) {
    console.warn("[BILLING] Unable to resolve user for subscription", {
      stripeCustomerId,
      subscriptionId: subscription.id,
    });
    return;
  }

  const status = resolveStatusFromStripe(subscription.status);
  const subscriptionPlan = mappedPlan ?? user.subscriptionPlan;
  const role = resolveRoleForPlan(subscriptionPlan);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role,
      subscriptionPlan,
      subscriptionStatus: status,
      subscriptionStartDate: fromUnix(subscription.start_date),
      subscriptionEndDate: fromUnix(subscription.cancel_at),
      trialEndDate: fromUnix(subscription.trial_end),
    },
  });
}

export async function createCheckoutSessionForUser(input: {
  userId: string;
  plan: BillingPlanKey;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const stripeClient = requireStripe();
  const priceId = getStripePriceId(input.plan);
  if (!priceId) {
    throw new Error(
      `Stripe price not configured for plan "${input.plan}". Set ${BILLING_PLAN_MAP[input.plan].envPriceKey}.`
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true, subscriptionPlan: true },
  });
  if (!user || !user.email) {
    throw new Error("Authenticated user with email is required for checkout.");
  }

  const isStarter = input.plan === "starter";
  const trialDays = BILLING_PLAN_MAP[input.plan].trialDays;
  const hasHadPaidPlan = !["FREE", "TRIAL"].includes(user.subscriptionPlan);
  const shouldApplyTrial = isStarter && !hasHadPaidPlan && trialDays > 0;

  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: input.successUrl || `${appUrl}/pricing?checkout=success`,
    cancel_url: input.cancelUrl || `${appUrl}/pricing?checkout=cancelled`,
    metadata: {
      userId: user.id,
      plan: input.plan,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        plan: input.plan,
      },
      ...(shouldApplyTrial ? { trial_period_days: trialDays } : {}),
    },
  });

  return session;
}

export async function createBillingPortalSessionForUser(input: { userId: string; returnUrl?: string }) {
  const stripeClient = requireStripe();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user || !user.email) {
    throw new Error("Authenticated user with email is required for billing portal.");
  }

  const customers = await stripeClient.customers.list({ email: user.email, limit: 10 });
  let customer = customers.data.find((c) => c.metadata?.userId === user.id) || customers.data[0];

  if (!customer) {
    customer = await stripeClient.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: { userId: user.id },
    });
  } else if (customer.metadata?.userId !== user.id) {
    customer = await stripeClient.customers.update(customer.id, {
      metadata: { ...(customer.metadata || {}), userId: user.id },
    });
  }

  const portal = await stripeClient.billingPortal.sessions.create({
    customer: customer.id,
    return_url: input.returnUrl || `${appUrl}/pricing`,
  });

  return portal;
}

export function constructStripeEvent(payload: Buffer, signature: string): Stripe.Event {
  const stripeClient = requireStripe();
  if (!stripeWebhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET. Cannot verify webhook signature.");
  }
  return stripeClient.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
}

export async function processStripeEvent(event: Stripe.Event) {
  const stripeClient = requireStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
      await upsertUserSubscriptionFromStripeSubscription(subscription, session.client_reference_id);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertUserSubscriptionFromStripeSubscription(subscription);
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const user = await findUserByStripeCustomer(customerId);
      if (!user) return;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: "FREE",
          subscriptionPlan: "FREE",
          subscriptionStatus: "EXPIRED",
          subscriptionEndDate: new Date(),
        },
      });
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const user = await findUserByStripeCustomer(customerId, invoice.customer_email || null);
      if (!user) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: "CANCELLED",
        },
      });
      return;
    }

    default:
      return;
  }
}
