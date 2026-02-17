import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  (process.env.API_URL && !process.env.API_URL.includes("localhost"))
    ? process.env.API_URL
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const res = await fetch(`${API_BASE}/billing/customer-portal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[BILLING_PROXY] POST /billing/customer-portal error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to open billing portal" },
      { status: 503 }
    );
  }
}
