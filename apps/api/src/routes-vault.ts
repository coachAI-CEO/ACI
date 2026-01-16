import express from "express";
import { z } from "zod";
import { prisma } from "./prisma";
import {
  findSimilarSessions,
  saveSessionToVault,
  removeSessionFromVault,
  getVaultSessions,
  getVaultSeries,
  saveSeriesToVault,
} from "./services/vault";

const r = express.Router();

r.post("/vault/sessions/:sessionId/save", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await saveSessionToVault(sessionId);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/vault/sessions/:sessionId/remove", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await removeSessionFromVault(sessionId);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/vault/sessions", async (req, res) => {
  try {
    const filters = {
      gameModelId: req.query.gameModelId as string | undefined,
      ageGroup: req.query.ageGroup as string | undefined,
      phase: req.query.phase as string | undefined,
      zone: req.query.zone as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    const result = await getVaultSessions(filters);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/vault/series", async (req, res) => {
  try {
    const series = await getVaultSeries();
    return res.json({ ok: true, series });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/vault/series/save", async (req, res) => {
  try {
    const schema = z.object({
      seriesId: z.string().optional(),
      sessionIds: z.array(z.string().uuid()),
    });
    const body = schema.parse(req.body);
    const result = await saveSeriesToVault(body.seriesId || "", body.sessionIds);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/vault/sessions/similar", async (req, res) => {
  try {
    const schema = z.object({
      gameModelId: z.string(),
      ageGroup: z.string(),
      phase: z.string().optional(),
      zone: z.string().optional(),
      formationAttacking: z.string(),
      formationDefending: z.string(),
      playerLevel: z.string(),
      coachLevel: z.string(),
      numbersMin: z.number(),
      numbersMax: z.number(),
      goalsAvailable: z.number(),
      spaceConstraint: z.string(),
      durationMin: z.number(),
      threshold: z.number().min(0).max(1).optional(),
    });

    const input = schema.parse(req.body);
    const threshold = input.threshold || 0.85;
    const similar = await findSimilarSessions(
      {
        gameModelId: input.gameModelId,
        ageGroup: input.ageGroup,
        phase: input.phase,
        zone: input.zone,
        formationAttacking: input.formationAttacking,
        formationDefending: input.formationDefending,
        playerLevel: input.playerLevel,
        coachLevel: input.coachLevel,
        numbersMin: input.numbersMin,
        numbersMax: input.numbersMax,
        goalsAvailable: input.goalsAvailable,
        spaceConstraint: input.spaceConstraint,
        durationMin: input.durationMin,
      },
      threshold
    );

    return res.json({ ok: true, matches: similar, count: similar.length });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/vault/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }
    return res.json({ ok: true, session });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/vault/sessions/:sessionId/status", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, savedToVault: true },
    });
    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }
    return res.json({ ok: true, savedToVault: session.savedToVault });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
