#!/usr/bin/env node
/**
 * Post-build step: let the compiled API load @aci/shared at runtime.
 *
 * `tsc` compiles packages/shared into dist/packages/shared/src/*.js, but the
 * compiled API still does `require("@aci/shared")`, which Node resolves through
 * the pnpm workspace link to packages/shared/src/index.ts -- raw TypeScript with
 * extension-less imports, which Node cannot load (ERR_MODULE_NOT_FOUND at startup).
 *
 * Node looks in dist/node_modules before apps/api/node_modules, so a one-file
 * package here that points at the compiled output wins. No dependency, no change
 * to packages/shared (the web app keeps consuming its TypeScript source).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const compiled = path.join(dist, 'packages/shared/src/index.js');

if (!fs.existsSync(compiled)) {
  console.error(
    `link-shared-runtime: ${path.relative(process.cwd(), compiled)} is missing. ` +
      'tsc did not emit packages/shared; the compiled API would not start.'
  );
  process.exit(1);
}

const pkgDir = path.join(dist, 'node_modules/@aci/shared');
fs.mkdirSync(pkgDir, { recursive: true });
// dist/node_modules/@aci/shared -> ../../../ is dist/
fs.writeFileSync(
  path.join(pkgDir, 'package.json'),
  JSON.stringify({ name: '@aci/shared', version: '0.0.0', main: '../../../packages/shared/src/index.js' }, null, 2) + '\n'
);
console.log('link-shared-runtime: dist/node_modules/@aci/shared -> compiled packages/shared');
