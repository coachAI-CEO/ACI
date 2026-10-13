/**
 * Web view of @aci/shared board-lines.
 *
 * Canonical source: `packages/shared/src/board/lines.ts`.
 * This file is kept so the existing `from "@/lib/board-lines"` imports across
 * the web app keep working. Everything is re-exported; `createLineArrow` is
 * re-typed because the web `DiagramArrow` requires an `id` and the shared
 * function always sets one.
 */
import * as shared from "@aci/shared";
import type { DiagramArrow } from "@/types/diagram";

export * from "@aci/shared";

export const createLineArrow = shared.createLineArrow as unknown as (
  input: Parameters<typeof shared.createLineArrow>[0]
) => DiagramArrow | null;
