"use client";

import { useState } from "react";

interface DrillActionsProps {
  drillId?: string;
  refCode?: string | null;
  drill: any;
}

export default function DrillActions({ drillId, refCode, drill }: DrillActionsProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSaveToVault = async () => {
    if (!drillId) {
      return;
    }

    setSaving(true);
    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch(`http://localhost:4000/vault/drills/${drillId}/save`, {
        method: "POST",
        headers,
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setSaved(true);
      } else {
        alert(data.error || "Failed to save drill to vault");
      }
    } catch (error: any) {
      alert("Failed to save drill to vault: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch("http://localhost:4000/ai/export-drill-pdf", {
        method: "POST",
        headers,
        body: JSON.stringify({ drill }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to export PDF" }));
        throw new Error(error.error || "Failed to export PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(drill.title || drill.json?.title || "drill").replace(/[^a-z0-9]/gi, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert("Failed to export PDF: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyRefCode = () => {
    if (refCode) {
      navigator.clipboard.writeText(refCode);
      alert(`Reference code ${refCode} copied to clipboard!`);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-700/50 mt-4">
      {/* Identifier */}
      {refCode && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Reference:</span>
          <button
            onClick={handleCopyRefCode}
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
            title="Click to copy"
          >
            {refCode}
          </button>
        </div>
      )}

      {/* Save to Vault */}
      {drillId && (
        <button
          onClick={handleSaveToVault}
          disabled={saving || saved}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            saved
              ? "bg-emerald-600 text-white cursor-not-allowed"
              : saving
              ? "bg-slate-700 text-slate-300 cursor-not-allowed"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
        >
          {saved ? "✓ Saved to Vault" : saving ? "Saving..." : "Save to Vault"}
        </button>
      )}

      {/* Print to PDF */}
      <button
        onClick={handleExportPDF}
        disabled={exporting}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
          exporting
            ? "bg-slate-700 text-slate-300 cursor-not-allowed"
            : "bg-blue-500 text-white hover:bg-blue-600"
        }`}
      >
        {exporting ? "Exporting..." : "Print to PDF"}
      </button>
    </div>
  );
}
