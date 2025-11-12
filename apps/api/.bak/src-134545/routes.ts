import { Router } from "express";
import { pingGemini } from "./gemini";
const r = Router();

r.get("/ai/ping", async (_req, res) => {
  try {
    const text = await pingGemini();
    res.json({ ok: true, text });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
});

export default r;
