import { Router } from "express";
import { dbHealth } from "./db";
const r = Router();

r.get("/db/health", async (_req, res) => {
  try {
    const info = await dbHealth();
    res.json({ ok: true, ...info });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
});

export default r;
