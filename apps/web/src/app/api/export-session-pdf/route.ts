import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = body.session;
    console.log("[PDF_FRONTEND] Forwarding to backend:", {
      title: session?.title,
      drillsCount: session?.drills?.length,
      drillsWithDiagrams: session?.drills?.filter((d: any) => d.diagram || d.diagramV1).length,
      firstDrillHasDiagram: !!(session?.drills?.[0]?.diagram || session?.drills?.[0]?.diagramV1),
    });
    
    // Forward authorization header to backend
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }
    
    const res = await fetch("http://localhost:4000/ai/export-session-pdf", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: errorData?.error || `API error: ${res.status}` },
        { status: res.status }
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
