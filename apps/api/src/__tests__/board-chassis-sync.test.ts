import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// apps/api/src/__tests__ -> repo root
const ROOT = path.resolve(__dirname, '../../../..');

describe('board chassis web copies', () => {
  test('are in sync with the API sources (run `pnpm sync:board-chassis` to fix)', () => {
    let output = '';
    try {
      output = execFileSync('node', ['scripts/sync-board-chassis.mjs', '--check'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      throw new Error(`Board chassis web copies are stale:\n${err.stderr || err.stdout || err.message}`);
    }
    expect(output).toMatch(/in sync/);
  });

  test('generated files say they are generated', () => {
    for (const f of ['board-phase-placement.ts', 'board-press-relative.ts', 'formation-principles.ts']) {
      const text = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/chassis', f), 'utf8');
      expect(text).toMatch(/GENERATED FILE -- do not edit by hand/);
    }
  });
});
