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

// Belt and braces: also rewrite the compiled requires to a relative path, so startup
// never depends on node_modules resolution (Render's runtime still loaded the raw
// TypeScript workspace copy even with the stub above).
let rewritten = 0;
const SPEC = /require\((["'])@aci\/shared\1\)/g;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) {
      const src = fs.readFileSync(full, 'utf8');
      if (!SPEC.test(src)) continue;
      SPEC.lastIndex = 0;
      let rel = path.relative(path.dirname(full), compiled).split(path.sep).join('/');
      if (!rel.startsWith('.')) rel = './' + rel;
      fs.writeFileSync(full, src.replace(SPEC, `require(${JSON.stringify(rel)})`));
      rewritten++;
    }
  }
}
if (fs.existsSync(path.join(dist, 'apps'))) walk(path.join(dist, 'apps'));
console.log(`link-shared-runtime: stub written, ${rewritten} compiled file(s) now require the compiled packages/shared directly`);
