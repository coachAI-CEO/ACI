import { Router } from "express";
const r = Router();

r.get("/ai/models", async (_req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing");
    const url = "https://generativelanguage.googleapis.com/v1/models?key=" + key;
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`ListModels failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    res.json({ ok: true, models: data.models?.map((m:any) => m.name) ?? [] });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
});

export default r;
