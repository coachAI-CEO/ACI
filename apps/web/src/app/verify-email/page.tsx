"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailPageContent() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`${apiBase}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok && data.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
          
          // Update user in localStorage if logged in
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            try {
              const user = JSON.parse(storedUser);
              user.emailVerified = true;
              localStorage.setItem("user", JSON.stringify(user));
              window.dispatchEvent(new Event("userLogin"));
            } catch (e) {
              // Ignore
            }
          }
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed");
        }
      } catch (error: any) {
        setStatus("error");
        setMessage(error.message || "Failed to verify email");
      }
    };

    verifyEmail();
  }, [searchParams, apiBase]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-emerald-400">Email Verification</h1>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
          {status === "loading" && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-4"></div>
              <p className="text-slate-300">Verifying your email...</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-emerald-400 font-semibold mb-2">Email Verified!</p>
              <p className="text-slate-300 text-sm mb-6">{message}</p>
              <Link
                href="/app"
                className="inline-block rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition"
              >
                Go to App
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="text-4xl mb-4">❌</div>
              <p className="text-red-400 font-semibold mb-2">Verification Failed</p>
              <p className="text-slate-300 text-sm mb-6">{message}</p>
              <div className="space-y-2">
                <Link
                  href="/login"
                  className="block rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition text-center"
                >
                  Go to Login
                </Link>
                <p className="text-xs text-slate-400">
                  Need a new verification link?{" "}
                  <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
                    Log in to resend
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
