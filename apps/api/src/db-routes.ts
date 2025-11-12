import { Router } from "express";
import { dbHealth } from "./db";
const r = Router();

r.get("/db/health", async (_req, res) => {
  try {
    const info = await dbHealth();
    const { ok: dbOk, ...rest } = (info as any) || {};
    res.json({ ok: (dbOk ?? true), ...rest });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
});

export default r;
