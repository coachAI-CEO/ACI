import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const SCRIPT = path.resolve(__dirname, '../../scripts/link-shared-runtime.mjs');

// The script resolves ../dist relative to its own location, so run a copy inside a temp "apps/api".
function setup(emitShared: boolean) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'link-shared-'));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts/link-shared-runtime.mjs'));
  if (emitShared) {
    fs.mkdirSync(path.join(root, 'dist/packages/shared/src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist/packages/shared/src/index.js'), 'module.exports = { ok: 1 };');
  } else {
    fs.mkdirSync(path.join(root, 'dist'));
  }
  const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/link-shared-runtime.mjs')], { encoding: 'utf8' });
  return { root, run };
}

describe('link-shared-runtime post-build step', () => {
  test('writes a stub package that resolves @aci/shared to the compiled output', () => {
    const { root, run } = setup(true);
    expect(run().status).toBe(0);
    const stub = path.join(root, 'dist/node_modules/@aci/shared');
    expect(JSON.parse(fs.readFileSync(path.join(stub, 'package.json'), 'utf8')).main).toBe('../../../packages/shared/src/index.js');
    // Node resolution from a compiled file under dist/ must land on the compiled index.
    const req = require('module').createRequire(path.join(root, 'dist/apps/api/src/index.js'));
    expect(req('@aci/shared')).toEqual({ ok: 1 });
  });

  test('fails the build loudly when tsc did not emit packages/shared', () => {
    const { run } = setup(false);
    const res = run();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('link-shared-runtime');
  });
});
