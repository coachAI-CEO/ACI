/**
 * API re-export of @aci/shared board-elements.
 *
 * Canonical source: `packages/shared/src/board/elements.ts`.
 * The API has callers (`board-diagram-schema.ts`, `web-diagram-v1.ts`)
 * that historically imported `BoardElement` / `BOARD_ELEMENT_KINDS` /
 * `BOARD_ELEMENT_MAX` / `mergePracticeElements` / `parseBoardElementKind` /
 * `conesFromElements` from this file. All of those names now resolve to
 * the shared package via this re-export.
 */
export * from "@aci/shared";
