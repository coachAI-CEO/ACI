import fs from 'fs';
import { buildGolden, GOLDEN_PATH } from '../scripts/board-placement-golden';

describe('board placement golden baseline', () => {
  test('every phase/formation/block/channel scenario still lands where the baseline says', () => {
    delete process.env.BOARD_PRESS_RELATIVE;
    const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')) as Record<string, [string, number, number][]>;
    const now = buildGolden();
    expect(Object.keys(now).sort()).toEqual(Object.keys(golden).sort());
    const drift: string[] = [];
    for (const key of Object.keys(golden)) {
      const a = golden[key];
      const b = now[key];
      a.forEach(([id, x, y], i) => {
        const [bid, bx, by] = b[i];
        if (bid !== id || Math.abs(bx - x) > 0.05 || Math.abs(by - y) > 0.05) drift.push(`${key} ${id}: (${x},${y}) -> (${bx},${by})`);
      });
    }
    expect(drift.slice(0, 10)).toEqual([]);
  });
});
