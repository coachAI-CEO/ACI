\"use client\";

import { FormEvent, useState } from \"react\";
import Link from \"next/link\";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(\"\");
  const [message, setMessage] = useState(\"\");
  const [error, setError] = useState(\"\");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(\"\");
    setMessage(\"\");
    setLoading(true);

    try {
      const res = await fetch(\"http://localhost:4000/auth/password/forgot\", {
        method: \"POST\",
        headers: { \"Content-Type\": \"application/json\" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || \"Failed to request password reset\");
      }

      setMessage(
        data.message ||
          \"If an account with that email exists, a password reset link has been sent.\"
      );
    } catch (err: any) {
      setError(err.message || \"Failed to request password reset\");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className=\"min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6 py-12\">
      <div className=\"w-full max-w-md space-y-8\">
        <div className=\"text-center\">
          <h1 className=\"text-3xl font-bold text-emerald-400\">Reset your password</h1>
          <p className=\"mt-2 text-sm text-slate-400\">
            Enter the email associated with your account and we&apos;ll send you a reset
            link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className=\"space-y-6\">
          {message && (
            <div className=\"rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-200\">
              {message}
            </div>
          )}
          {error && !message && (
            <div className=\"rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200\">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor=\"email\"
              className=\"block text-sm font-medium text-slate-300 mb-2\"
            >
              Email
            </label>
            <input
              id=\"email\"
              type=\"email\"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className=\"w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition\"
              placeholder=\"you@example.com\"
              disabled={loading}
            />
          </div>

          <button
            type=\"submit\"
            disabled={loading}
            className=\"w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition\"
          >
            {loading ? \"Sending reset link...\" : \"Send reset link\"}
          </button>
        </form>

        <div className=\"text-center text-sm text-slate-400 space-y-1\">
          <div>
            Remembered your password?{\" "}
            <Link
              href=\"/login\"
              className=\"text-emerald-400 hover:text-emerald-300 font-medium\"
            >
              Back to login
            </Link>
          </div>
          <div>
            <Link href=\"/\" className=\"text-xs text-slate-500 hover:text-slate-400\">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

