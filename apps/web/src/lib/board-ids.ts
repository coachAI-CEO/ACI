/**
 * Web re-export of @aci/shared board ids.
 *
 * Canonical source: `packages/shared/src/board/ids.ts`.
 * The functions are generic, so passing the web `DiagramV1` (required ids)
 * returns the same web type.
 */
export { newObjectId, ensureLayerObjectIds, ensureDiagramObjectIds } from "@aci/shared";
export type { LayerIdInherit } from "@aci/shared";
