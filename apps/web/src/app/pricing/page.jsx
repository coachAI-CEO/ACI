"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    accountType: "Starter Coach",
    price: "$10",
    period: "/month",
    description: "Best for individual coaches getting organized with smart planning.",
    features: [
      "Up to 150 drills/month",
      "Up to 40 sessions/month",
      "Vault + favorites access",
      "Calendar planning",
      "AI coach assistant",
    ],
    cta: "Start Starter",
    actionType: "checkout",
    billingPlanKey: "starter",
    featured: false,
  },
  {
    accountType: "Club Pro",
    price: "$40",
    period: "/month",
    description: "Built for serious clubs with up to 5 coaches and shared standards.",
    features: [
      "Unlimited drills",
      "Unlimited sessions",
      "Up to 5 coach seats",
      "Progressive series builder",
      "Club-wide content vault",
      "Advanced analytics",
    ],
    cta: "Start Pro",
    actionType: "checkout",
    billingPlanKey: "club_pro",
    featured: true,
  },
  {
    accountType: "Academy Elite",
    price: "Custom",
    period: "",
    description: "For high-performance environments. Pricing is evaluated based on usage traffic and scope.",
    features: [
      "Everything in Club Pro",
      "Custom club wrapping",
      "Customized gallery of drills",
      "Customized game model for unity",
      "Custom DC dashboard",
    ],
    cta: "Talk to Sales",
    actionType: "contact",
    href: "mailto:admin@tacticaledge.app",
    featured: false,
  },
];

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState("Club Pro");
  const [loadingPlan, setLoadingPlan] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("accessToken");
    setHasToken(Boolean(token));
  }, []);

  const startCheckout = async (planKey) => {
    if (typeof window === "undefined") return;
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      window.location.href = "/register?next=/pricing";
      return;
    }

    setBillingError("");
    setLoadingPlan(planKey);
    try {
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to start checkout");
      }
      window.location.href = data.url;
    } catch (error) {
      setBillingError(error.message || "Unable to start checkout right now.");
      setLoadingPlan("");
    }
  };

  const openBillingPortal = async () => {
    if (typeof window === "undefined") return;
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      window.location.href = "/login?next=/pricing";
      return;
    }

    setBillingError("");
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/customer-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/pricing` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to open billing portal");
      }
      window.location.href = data.url;
    } catch (error) {
      setBillingError(error.message || "Unable to open billing portal right now.");
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050605] px-6 pb-16 pt-24 text-white">
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=2000')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-transparent to-[#050605]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
            <Link href="/landing" className="flex items-center gap-3">
              <div className="logo-spin-wrap h-14 w-14 overflow-hidden rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.png" alt="Tactical Edge" className="logo-coin h-full w-full scale-[1.35] object-cover" />
              </div>
              <span className="text-lg font-black uppercase tracking-tight text-white">
                Tactical<span className="text-[#ADFF2F]">Edge</span>
              </span>
            </Link>
            <Link href="/landing" className="text-sm font-semibold text-gray-300 transition hover:text-[#ADFF2F]">
              Back to landing
            </Link>
          </div>
        </nav>

        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ADFF2F]/30 bg-[#ADFF2F]/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#ADFF2F]">
            <Sparkles size={14} />
            Plans
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">
            Choose Your <span className="text-[#ADFF2F]">Account</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            Side-by-side plans built for individual coaches, growing clubs, and elite academies.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-[#ADFF2F]/35 bg-[#ADFF2F]/10 p-5 text-center backdrop-blur-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ADFF2F]">Free Trial</p>
          <p className="mt-2 text-lg font-semibold text-white">Start with a 7-day free trial on Starter Coach.</p>
          <Link
            href="/register"
            className="mt-4 inline-flex rounded-md bg-[#ADFF2F] px-5 py-2.5 text-xs font-black uppercase text-black transition hover:bg-[#c6ff5f]"
          >
            Start Free Trial
          </Link>
          {hasToken && (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="ml-3 mt-4 inline-flex rounded-md border border-white/30 bg-black/40 px-5 py-2.5 text-xs font-black uppercase text-white transition hover:border-[#ADFF2F]/60 hover:text-[#ADFF2F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {portalLoading ? "Opening..." : "Manage Billing"}
            </button>
          )}
          {billingError && <p className="mt-3 text-sm text-red-300">{billingError}</p>}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.accountType}
              onClick={() => setSelectedPlan(plan.accountType)}
              className={`group flex min-h-[640px] cursor-pointer flex-col rounded-2xl border border-white/15 bg-black/55 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#ADFF2F]/60 hover:bg-black/65 hover:shadow-[0_14px_40px_rgba(0,0,0,0.45)] active:-translate-y-1 active:scale-[0.99] ${
                selectedPlan === plan.accountType
                  ? "border-[#ADFF2F] bg-[#ADFF2F]/10 -translate-y-1 shadow-[0_16px_45px_rgba(173,255,47,0.28)]"
                  : ""
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300 transition-colors group-hover:text-white">{plan.accountType}</p>
              <div className="mt-5 flex items-end gap-1">
                <span className="text-5xl font-black text-white">{plan.price}</span>
                <span className="pb-1 text-gray-300">{plan.period}</span>
              </div>
              <p className="mt-4 min-h-[72px] text-sm text-gray-300">{plan.description}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-gray-200">
                    <Check size={16} className="mt-0.5 text-[#ADFF2F]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.actionType === "contact" ? (
                <a
                  href={plan.href}
                  onClick={(e) => e.stopPropagation()}
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-black uppercase transition ${
                    selectedPlan === plan.accountType
                      ? "bg-[#ADFF2F] text-black hover:bg-[#c6ff5f]"
                      : "border border-white/20 bg-black/40 text-white hover:border-[#ADFF2F]/55 hover:text-[#ADFF2F]"
                  }`}
                >
                  {plan.cta}
                </a>
              ) : (
                <button
                  type="button"
                  disabled={loadingPlan === plan.billingPlanKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    startCheckout(plan.billingPlanKey);
                  }}
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-black uppercase transition ${
                    selectedPlan === plan.accountType
                      ? "bg-[#ADFF2F] text-black hover:bg-[#c6ff5f]"
                      : "border border-white/20 bg-black/40 text-white hover:border-[#ADFF2F]/55 hover:text-[#ADFF2F]"
                  }`}
                >
                  {loadingPlan === plan.billingPlanKey ? "Loading..." : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/landing" className="text-sm text-gray-300 underline-offset-4 hover:text-[#ADFF2F] hover:underline">
            Back to landing
          </Link>
        </div>
      </div>
    </div>
  );
}
