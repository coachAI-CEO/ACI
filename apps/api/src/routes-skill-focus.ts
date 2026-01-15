import express from "express";
import { z } from "zod";
import {
  generateSkillFocusForSession,
  generateSkillFocusForSeries,
  getSkillFocusForSession,
  getSkillFocusForSeries,
} from "./services/skill-focus";

const r = express.Router();

r.post("/skill-focus/session", async (req, res) => {
  try {
    const schema = z.object({ sessionId: z.string().uuid() });
    const body = schema.parse(req.body);
    const result = await generateSkillFocusForSession(body.sessionId);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/skill-focus/series", async (req, res) => {
  try {
    const schema = z.object({
      seriesId: z.string().optional(),
      sessionIds: z.array(z.string().uuid()).optional(),
    });
    const body = schema.parse(req.body);
    const result = await generateSkillFocusForSeries({
      seriesId: body.seriesId,
      sessionIds: body.sessionIds,
    });
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/skill-focus/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const focus = await getSkillFocusForSession(sessionId);
    return res.json({ ok: true, focus });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/skill-focus/series/:seriesId", async (req, res) => {
  try {
    const { seriesId } = req.params;
    const focus = await getSkillFocusForSeries(seriesId);
    return res.json({ ok: true, focus });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
