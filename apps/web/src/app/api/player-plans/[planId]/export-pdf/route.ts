import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const body = await request.text();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const res = await fetch(`${API_BASE}/player-plans/${planId}/export-pdf`, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: errorData.error || "Failed to export PDF" },
        { status: res.status }
      );
    }

    // Return the PDF blob
    const pdfBlob = await res.blob();
    return new NextResponse(pdfBlob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": res.headers.get("Content-Disposition") || `attachment; filename="player_plan.pdf"`,
      },
    });
  } catch (e: any) {
    console.error("[PLAYER_PLANS_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to export PDF" },
      { status: 500 }
    );
  }
}
