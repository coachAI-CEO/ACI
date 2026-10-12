#!/usr/bin/env node
/**
 * Single source of truth for the board placement "chassis".
 *
 * The API owns these files. The browser needs the same logic so the editor's
 * Setup phase/zone/channel does not wait on an API round-trip, so the web copies
 * are GENERATED from the API sources instead of being edited by hand (they used
 * to drift: the web copy fell behind on spacing, channel handling and play-out).
 *
 *   node scripts/sync-board-chassis.mjs          write the web copies
 *   node scripts/sync-board-chassis.mjs --check  exit 1 if any web copy is stale
 *
 * Edit the API files only. web-diagram-v1.ts is NOT synced: the web has its own
 * adapter with the same name, and the synced files import it by that name.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(root, 'apps/api/src');
const WEB = path.join(root, 'apps/web/src/lib/chassis');

const banner = (source) =>
  `/**\n * GENERATED FILE -- do not edit by hand.\n * Source: ${source}\n * Regenerate with: pnpm sync:board-chassis\n */\n\n`;

/** [source relative to apps/api/src, destination file name in the web chassis, transform] */
const TARGETS = [
  ['services/board-phase-placement.ts', 'board-phase-placement.ts', (s) => s],
  ['services/board-press-relative.ts', 'board-press-relative.ts', (s) => s],
  [
    'services/formation-principles.ts',
    'formation-principles.ts',
    (s) => s.replace("'../data/formation-principles-v2.json'", "'./formation-principles-v2.json'"),
  ],
  ['data/formation-principles-v2.json', 'formation-principles-v2.json', (s) => s, { banner: false }],
];

const check = process.argv.includes('--check');
const stale = [];

for (const [srcRel, destName, transform, opts] of TARGETS) {
  const src = fs.readFileSync(path.join(API, srcRel), 'utf8');
  const body = transform(src);
  const out = opts?.banner === false ? body : banner(`apps/api/src/${srcRel}`) + body;
  const destPath = path.join(WEB, destName);
  const current = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf8') : null;
  if (current === out) continue;
  if (check) {
    stale.push(path.relative(root, destPath));
  } else {
    fs.writeFileSync(destPath, out);
    console.log(`wrote ${path.relative(root, destPath)}`);
  }
}

if (check) {
  if (stale.length) {
    console.error('Board chassis copies are out of date with the API sources:');
    for (const f of stale) console.error(`  ${f}`);
    console.error('Run: pnpm sync:board-chassis');
    process.exit(1);
  }
  console.log('Board chassis copies are in sync.');
} else {
  console.log('Board chassis synced.');
}
