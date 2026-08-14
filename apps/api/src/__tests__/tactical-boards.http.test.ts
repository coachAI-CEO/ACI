/**
 * HTTP-level flag gate for /boards.
 */
process.env.TACTICAL_BOARD_V1 = '0';

jest.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    clubMembership: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    tacticalBoard: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: { findUnique: jest.fn() },
    club: { findFirst: jest.fn() },
  },
}));

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    req.user = { id: 'user-1', role: 'COACH' };
    next();
  },
}));

import request from 'supertest';
import express from 'express';
import boardsRoutes from '../routes-boards';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(boardsRoutes);
  return app;
}

describe('boards HTTP flag gate', () => {
  test('flag off → 404', async () => {
    process.env.TACTICAL_BOARD_V1 = '0';
    const res = await request(buildApp()).get('/boards');
    expect(res.status).toBe(404);
  });

  test('flag on → reaches handler (200 empty list)', async () => {
    process.env.TACTICAL_BOARD_V1 = '1';
    const { prisma } = require('../prisma');
    prisma.tacticalBoard.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/boards');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.boards).toEqual([]);
  });
});
