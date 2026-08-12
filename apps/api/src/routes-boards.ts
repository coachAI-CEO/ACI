import express from 'express';
import { authenticate, AuthRequest } from './middleware/auth';
import { prisma } from './prisma';
import { isTacticalBoardV1Enabled } from './services/board-club-stamp';
import {
  TacticalBoardError,
  createBlankBoard,
  createForkBoard,
  deleteBoard,
  getBoardForUser,
  listOwnedBoards,
  patchBoard,
} from './services/tactical-boards';

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

    if (mode === 'BLANK') {
      const board = await createBlankBoard(req.userId, req.body);
      return res.status(201).json({ ok: true, board });
    }

    return res.status(400).json({
      ok: false,
      error: 'INVALID_MODE',
      message: 'mode must be BLANK or FORK_DRILL',
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
