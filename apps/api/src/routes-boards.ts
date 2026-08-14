import express from 'express';
import { authenticate, AuthRequest } from './middleware/auth';
import { prisma } from './prisma';
import { isTacticalBoardV1Enabled } from './services/board-club-stamp';
import {
  TacticalBoardError,
  createBlankBoard,
  createForkBoard,
  createForkSessionBoard,
  deleteBoard,
  getBoardForUser,
  listOwnedBoards,
  patchBoard,
} from './services/tactical-boards';
import { runBoardAiChat } from './services/board-ai-chat';
import { applySetupPhaseToDiagram } from './services/board-phase-placement';
import { parseWebDiagramV1 } from './services/board-diagram-schema';
import { toWebDiagramV1 } from './services/web-diagram-v1';

const r = express.Router();

function requireBoardFlag(_req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (!isTacticalBoardV1Enabled()) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }
  return next();
}

function sendBoardError(res: express.Response, error: unknown) {
  if (error instanceof TacticalBoardError) {
    return res.status(error.status).json({
      ok: false,
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error('[boards]', error);
  return res.status(500).json({ ok: false, error: message });
}

r.use(authenticate as any, requireBoardFlag);

r.get('/boards', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
    const result = await listOwnedBoards(req.userId, {
      limit: Number.isFinite(limit) ? limit : 50,
      cursor,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendBoardError(res, error);
  }
});

r.post('/boards', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const mode = String(req.body?.mode || 'BLANK').toUpperCase();
    const admin = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { adminRole: true },
    });
    const isSuperAdmin = admin?.adminRole === 'SUPER_ADMIN';

    if (mode === 'FORK_DRILL') {
      const board = await createForkBoard(req.userId, req.body, isSuperAdmin);
      return res.status(201).json({ ok: true, board });
    }

    if (mode === 'FORK_SESSION') {
      const board = await createForkSessionBoard(req.userId, req.body, isSuperAdmin);
      return res.status(201).json({ ok: true, board });
    }

    if (mode === 'BLANK') {
      const board = await createBlankBoard(req.userId, req.body);
      return res.status(201).json({ ok: true, board });
    }

    return res.status(400).json({
      ok: false,
      error: 'INVALID_MODE',
      message: 'mode must be BLANK, FORK_DRILL, or FORK_SESSION',
    });
  } catch (error) {
    return sendBoardError(res, error);
  }
});

r.get('/boards/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const board = await getBoardForUser(req.params.id, req.userId);
    return res.json({ ok: true, board });
  } catch (error) {
    return sendBoardError(res, error);
  }
});

r.patch('/boards/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const board = await patchBoard(req.params.id, req.userId, req.body);
    return res.json({ ok: true, board });
  } catch (error) {
    return sendBoardError(res, error);
  }
});

r.post('/boards/:id/ai-chat', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const board = await getBoardForUser(req.params.id, req.userId);
    if (!board.canEdit) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: 'View-only board' });
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ ok: false, error: 'MISSING_MESSAGE', message: 'message required' });
    }

    const fromBody = req.body?.diagram ? toWebDiagramV1(req.body.diagram) : null;
    const currentDiagram =
      fromBody || toWebDiagramV1(board.diagram) || (board.diagram as any);
    const parsedCurrent = parseWebDiagramV1(currentDiagram);
    if (!parsedCurrent.ok) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_DIAGRAM',
        message: parsedCurrent.error,
        details: parsedCurrent.details,
      });
    }

    const historyRaw = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = historyRaw
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-8)
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 2000) }));

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { coachLevel: true },
    });

    const result = await runBoardAiChat({
      diagram: parsedCurrent.diagram,
      message,
      history,
      ageGroup: board.ageGroup,
      gameModelId: board.gameModelId,
      clubId: board.clubId,
      coachLevel: user?.coachLevel || null,
      userId: req.userId,
    });

    return res.json({
      ok: true,
      reply: result.reply,
      applied: result.applied,
      diagram: result.diagram,
      coachLevel: result.coachLevel,
      playerLevel: result.playerLevel,
      sessionBridge: result.sessionBridge || null,
    });
  } catch (error) {
    return sendBoardError(res, error);
  }
});

/** Place Setup phase/zone/channel using the shared 11v11 chassis (no DB write). */
r.post('/boards/:id/phase-place', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const board = await getBoardForUser(req.params.id, req.userId);
    if (!board.canEdit) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: 'View-only board' });
    }

    const fromBody = req.body?.diagram ? toWebDiagramV1(req.body.diagram) : null;
    const currentDiagram =
      fromBody || toWebDiagramV1(board.diagram) || (board.diagram as any);
    const parsedCurrent = parseWebDiagramV1(currentDiagram);
    if (!parsedCurrent.ok) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_DIAGRAM',
        message: parsedCurrent.error,
        details: parsedCurrent.details,
      });
    }

    const phase = String(req.body?.phase || 'ATTACKING').toUpperCase();
    const zone = String(req.body?.zone || 'MIDDLE_THIRD').toUpperCase();
    const channel = String(req.body?.channel || 'CENTER').toUpperCase();
    if (!['ATTACKING', 'DEFENDING', 'TRANSITION'].includes(phase)) {
      return res.status(400).json({ ok: false, error: 'INVALID_PHASE', message: 'Invalid phase' });
    }
    if (!['DEFENSIVE_THIRD', 'MIDDLE_THIRD', 'ATTACKING_THIRD'].includes(zone)) {
      return res.status(400).json({ ok: false, error: 'INVALID_ZONE', message: 'Invalid zone' });
    }
    if (!['LEFT', 'CENTER', 'RIGHT'].includes(channel)) {
      return res
        .status(400)
        .json({ ok: false, error: 'INVALID_CHANNEL', message: 'Invalid channel' });
    }

    const placed = applySetupPhaseToDiagram(parsedCurrent.diagram, {
      phase: phase as 'ATTACKING' | 'DEFENDING' | 'TRANSITION',
      zone: zone as 'DEFENSIVE_THIRD' | 'MIDDLE_THIRD' | 'ATTACKING_THIRD',
      channel: channel as 'LEFT' | 'CENTER' | 'RIGHT',
      attFormation: req.body?.attFormation,
      defFormation: req.body?.defFormation,
      defBlock: req.body?.defBlock,
      showOpposition: req.body?.showOpposition !== false && req.body?.showOpposition !== 'false',
    });

    const validated = parseWebDiagramV1(placed);
    if (!validated.ok) {
      return res.status(500).json({
        ok: false,
        error: 'PLACE_INVALID',
        message: validated.error,
        details: validated.details,
      });
    }

    return res.json({ ok: true, diagram: validated.diagram });
  } catch (error) {
    return sendBoardError(res, error);
  }
});

r.delete('/boards/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    await deleteBoard(req.params.id, req.userId);
    return res.json({ ok: true });
  } catch (error) {
    return sendBoardError(res, error);
  }
});

export default r;
