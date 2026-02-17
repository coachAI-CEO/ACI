import express from "express";
import Stripe from "stripe";
import { z } from "zod";
import { authenticate } from "./middleware/auth";
import {
  constructStripeEvent,
  createBillingPortalSessionForUser,
  createCheckoutSessionForUser,
  processStripeEvent,
} from "./services/billing";

const r = express.Router();

const CheckoutSchema = z.object({
  plan: z.enum(["starter", "club_pro"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

r.post("/billing/checkout-session", authenticate, async (req: any, res) => {
  try {
    const body = CheckoutSchema.parse(req.body || {});
    const session = await createCheckoutSessionForUser({
      userId: req.userId,
      plan: body.plan,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    return res.json({
      ok: true,
      id: session.id,
      url: session.url,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ ok: false, error: "Invalid checkout payload", details: error.errors });
    }
    console.error("[BILLING] checkout-session error", error);
    return res.status(400).json({ ok: false, error: error?.message || "Failed to create checkout session" });
  }
});

r.post("/billing/customer-portal", authenticate, async (req: any, res) => {
  try {
    const returnUrl = typeof req.body?.returnUrl === "string" ? req.body.returnUrl : undefined;
    const portal = await createBillingPortalSessionForUser({
      userId: req.userId,
      returnUrl,
    });
    return res.json({ ok: true, url: portal.url });
  } catch (error: any) {
    console.error("[BILLING] customer-portal error", error);
    return res.status(400).json({ ok: false, error: error?.message || "Failed to create billing portal session" });
  }
});

r.get("/billing/subscription-status", authenticate, async (req: any, res) => {
  try {
    return res.json({
      ok: true,
      subscription: {
        role: req.user?.role || null,
        plan: req.user?.subscriptionPlan || null,
        status: req.user?.subscriptionStatus || null,
        trialEndDate: req.user?.trialEndDate || null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || "Failed to fetch subscription status" });
  }
});

r.post("/billing/stripe/webhook", async (req: any, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    let event: Stripe.Event;

    if (typeof signature === "string" && req.rawBody) {
      event = constructStripeEvent(req.rawBody, signature);
    } else {
      // Fallback for local/dev when signature validation is not configured.
      event = req.body as Stripe.Event;
    }

    await processStripeEvent(event);
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("[BILLING] webhook error", error);
    return res.status(400).json({ ok: false, error: error?.message || "Webhook processing failed" });
  }
});

export default r;
