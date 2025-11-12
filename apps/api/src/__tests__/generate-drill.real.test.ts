import request from 'supertest';
import app from '../app';

// Mock the service so we don't call external LLMs:
jest.mock('../services/drill', () => ({
  generateAndReviewDrill: async (_body: any) => ({
    drill: { json: { goalMode: 'LARGE', equipment: ['Cones','Bibs (2 colors)','Soccer balls','1 Full-size goal'], diagram: { miniGoals: 0, teams: [{label:'Attack'},{label:'Defend'},{label:'GK'}] } } },
    qa: { pass: true, scores: {} },
    raw: {}
  })
}));

describe('REAL path (stubbed service)', () => {
  const old = process.env.FAST_E2E;
  beforeAll(() => { process.env.FAST_E2E = '0'; });
  afterAll(() => { process.env.FAST_E2E = old; });

  it('uses services/drill when FAST_E2E=0', async () => {
    const res = await request(app).post('/ai/generate-drill').send({ goalsAvailable:1 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.drill.json.goalMode).toBe('LARGE');
  });
});
