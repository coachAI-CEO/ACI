import express from "express";
import { SeasonPhase } from "@prisma/client";
import { authenticate, AuthRequest } from "./middleware/auth";
import {
  CoachCenterError,
  createGameDay,
  createTeam,
  gameDayPdfBuffer,
  getCoachCenterAccess,
  getTeamCalendar,
  getTeamOverview,
  listChat,
  listGameDays,
  recommendSessions,
  sendChat,
  updateGameDay,
  updateTeam,
} from "./services/coach-center";

const r = express.Router();
r.use(authenticate);

function sendError(res: express.Response, error: unknown) {
  if (error instanceof CoachCenterError) {
    return res.status(error.status).json({ ok: false, error: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("[COACH_CENTER]", message);
  return res.status(500).json({ ok: false, error: message });
}

r.get("/coach-center/access", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const data = await getCoachCenterAccess(req.userId);
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

r.post("/coach-center/teams", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const team = await createTeam(req.userId, req.body || {});
    return res.json({ ok: true, team });
  } catch (error) {
    return sendError(res, error);
  }
});

r.patch("/coach-center/teams/:teamId", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const phase = req.body?.phase;
    const team = await updateTeam(req.userId, req.params.teamId, {
      name: req.body?.name,
      notes: req.body?.notes,
      seasonLabel: req.body?.seasonLabel,
      playerLevel: req.body?.playerLevel === undefined ? undefined : req.body?.playerLevel,
      phase: phase && Object.values(SeasonPhase).includes(phase) ? phase : undefined,
    });
    return res.json({ ok: true, team });
  } catch (error) {
    return sendError(res, error);
  }
});

r.get("/coach-center/teams/:teamId/overview", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const data = await getTeamOverview(req.userId, req.params.teamId);
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

r.get("/coach-center/teams/:teamId/calendar", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
    if (!weekStart) return res.status(400).json({ ok: false, error: "weekStart required" });
    const data = await getTeamCalendar(req.userId, req.params.teamId, weekStart);
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

r.get("/coach-center/teams/:teamId/recommendations", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const weekRaw = typeof req.query.weekIndex === "string" ? Number(req.query.weekIndex) : NaN;
    const recommendations = await recommendSessions(
      req.userId,
      req.params.teamId,
      Number.isFinite(weekRaw) ? weekRaw : null
    );
    return res.json({ ok: true, recommendations });
  } catch (error) {
    return sendError(res, error);
  }
});

r.get("/coach-center/teams/:teamId/chat", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const messages = await listChat(req.userId, req.params.teamId);
    return res.json({ ok: true, messages });
  } catch (error) {
    return sendError(res, error);
  }
});

r.post("/coach-center/teams/:teamId/chat", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const message = await sendChat(req.userId, req.params.teamId, String(req.body?.message || ""));
    return res.json({ ok: true, message });
  } catch (error) {
    return sendError(res, error);
  }
});

r.get("/coach-center/teams/:teamId/game-days", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const items = await listGameDays(req.userId, req.params.teamId);
    return res.json({ ok: true, items });
  } catch (error) {
    return sendError(res, error);
  }
});

r.post("/coach-center/teams/:teamId/game-days", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const item = await createGameDay(req.userId, req.params.teamId, req.body || {});
    return res.json({ ok: true, item });
  } catch (error) {
    return sendError(res, error);
  }
});

r.patch("/coach-center/teams/:teamId/game-days/:gameDayId", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const item = await updateGameDay(req.userId, req.params.teamId, req.params.gameDayId, req.body || {});
    return res.json({ ok: true, item });
  } catch (error) {
    return sendError(res, error);
  }
});

r.get("/coach-center/teams/:teamId/game-days/:gameDayId/pdf", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ ok: false, error: "Authentication required" });
    const pdf = await gameDayPdfBuffer(req.userId, req.params.teamId, req.params.gameDayId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="game-day-${req.params.gameDayId}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    return sendError(res, error);
  }
});

export default r;
