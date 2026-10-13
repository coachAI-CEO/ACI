// Resolve hook for running the board testers on native Node type-stripping.
// @aci/shared (and the web re-exports) use extension-less relative imports, which
// Node's ESM loader rejects; fall back to `<spec>.ts` and `<spec>/index.ts`.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const notFound = err && (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ERR_UNSUPPORTED_DIR_IMPORT');
    if (!notFound || !specifier.startsWith('.') || !context.parentURL) throw err;
    const base = new URL(specifier, context.parentURL).href;
    for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate, context);
    }
    throw err;
  }
}
