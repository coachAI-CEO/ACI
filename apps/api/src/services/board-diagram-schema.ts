import { z } from 'zod';
import type { WebDiagramV1 } from './web-diagram-v1';

export const BOARD_DIAGRAM_MAX_PLAYERS = 30;
export const BOARD_DIAGRAM_MAX_ARROWS = 40;
export const BOARD_DIAGRAM_MAX_LABELS = 20;
export const BOARD_DIAGRAM_MAX_AREAS = 20;
export const BOARD_DIAGRAM_MAX_FRAMES = 8;
/** Raised to fit multi-frame sequences (still capped by frame count). */
export const BOARD_DIAGRAM_MAX_BYTES = 192 * 1024;
export const BOARD_TITLE_MAX_LEN = 120;
export const BOARD_DIAGRAM_MAX_ELEMENTS = 40;

const BoardElementSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(['mini-goal', 'cone', 'mannequin', 'pole']),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    rotation: z.number().min(0).max(360).optional(),
    color: z.string().max(32).optional(),
    width: z.number().optional(),
  })
  .strict();

const PointRefSchema = z
  .object({
    playerId: z.string().max(64).optional(),
    x: z.number().min(0).max(100).optional(),
    y: z.number().min(0).max(100).optional(),
  })
  .strict();

export const WebDiagramV1Schema = z
  .object({
    pitch: z
      .object({
        variant: z.enum(['FULL', 'HALF', 'THIRD']),
        orientation: z.enum(['HORIZONTAL', 'VERTICAL']),
        format: z.enum(['7V7', '9V9', '11V11']).optional(),
        showZones: z.boolean().optional(),
        showThirds: z.boolean().optional(),
        zones: z
          .object({
            leftWide: z.boolean().optional(),
            leftHalfSpace: z.boolean().optional(),
            centralChannel: z.boolean().optional(),
            rightHalfSpace: z.boolean().optional(),
            rightWide: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    players: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            number: z.number().int().min(0).max(99).optional(),
            team: z.enum(['ATT', 'DEF', 'NEUTRAL']),
            role: z.string().max(64).optional(),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            relativePosition: z.string().max(64).optional(),
            facingAngle: z.number().optional(),
            labelStyle: z.enum(['number-only', 'number-and-role']).optional(),
          })
          .strict()
      )
      .max(BOARD_DIAGRAM_MAX_PLAYERS),
    goals: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            width: z.number().optional(),
            type: z.string().max(32).optional(),
          })
          .strict()
      )
      .max(10)
      .optional(),
    coach: z
      .object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        label: z.string().max(64).optional(),
        note: z.string().max(500).optional(),
      })
      .strict()
      .optional(),
    balls: z
      .array(
        z
          .object({
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
          })
          .strict()
      )
      .max(20)
      .optional(),
    cones: z
      .array(
        z
          .object({
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            color: z.string().max(32).optional(),
          })
          .strict()
      )
      .max(40)
      .optional(),
    elements: z.array(BoardElementSchema).max(BOARD_DIAGRAM_MAX_ELEMENTS).optional(),
    arrows: z
      .array(
        z
          .object({
            from: PointRefSchema,
            to: PointRefSchema,
            type: z.enum(['pass', 'run', 'press', 'cover', 'transition']),
            style: z.enum(['solid', 'dashed', 'dotted']),
            weight: z.enum(['normal', 'bold']),
            arrowhead: z.boolean().optional(),
            control: z
              .object({
                x: z.number().min(0).max(100),
                y: z.number().min(0).max(100),
              })
              .strict()
              .optional(),
            path: z
              .array(
                z
                  .object({
                    x: z.number().min(0).max(100),
                    y: z.number().min(0).max(100),
                  })
                  .strict()
              )
              .max(100)
              .optional(),
            order: z.number().int().min(1).max(12).optional(),
          })
          .strict()
      )
      .max(BOARD_DIAGRAM_MAX_ARROWS),
    areas: z
      .array(
        z
          .object({
            label: z.string().max(120).optional(),
            x: z.number().min(0).max(100).optional(),
            y: z.number().min(0).max(100).optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            shape: z.enum(['rect', 'circle', 'spotlight']).optional(),
          })
          .strict()
      )
      .max(BOARD_DIAGRAM_MAX_AREAS),
    labels: z
      .array(
        z
          .object({
            text: z.string().min(1).max(200),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
          })
          .strict()
      )
      .max(BOARD_DIAGRAM_MAX_LABELS),
    sequence: z
      .object({
        activeFrameId: z.string().min(1).max(64),
        frames: z
          .array(
            z
              .object({
                id: z.string().min(1).max(64),
                title: z.string().max(80).optional(),
                note: z.string().max(300).optional(),
                durationMs: z.number().int().min(400).max(12000).optional(),
                players: z
                  .array(
                    z
                      .object({
                        id: z.string().min(1).max(64),
                        number: z.number().int().min(0).max(99).optional(),
                        team: z.enum(['ATT', 'DEF', 'NEUTRAL']),
                        role: z.string().max(64).optional(),
                        x: z.number().min(0).max(100),
                        y: z.number().min(0).max(100),
                        relativePosition: z.string().max(64).optional(),
                        facingAngle: z.number().optional(),
                        labelStyle: z.enum(['number-only', 'number-and-role']).optional(),
                      })
                      .strict()
                  )
                  .max(BOARD_DIAGRAM_MAX_PLAYERS),
                arrows: z
                  .array(
                    z
                      .object({
                        from: PointRefSchema,
                        to: PointRefSchema,
                        type: z.enum(['pass', 'run', 'press', 'cover', 'transition']),
                        style: z.enum(['solid', 'dashed', 'dotted']),
                        weight: z.enum(['normal', 'bold']),
                        arrowhead: z.boolean().optional(),
                        control: z
                          .object({
                            x: z.number().min(0).max(100),
                            y: z.number().min(0).max(100),
                          })
                          .strict()
                          .optional(),
                        path: z
                          .array(
                            z
                              .object({
                                x: z.number().min(0).max(100),
                                y: z.number().min(0).max(100),
                              })
                              .strict()
                          )
                          .max(100)
                          .optional(),
                        order: z.number().int().min(1).max(12).optional(),
                      })
                      .strict()
                  )
                  .max(BOARD_DIAGRAM_MAX_ARROWS),
                areas: z
                  .array(
                    z
                      .object({
                        label: z.string().max(120).optional(),
                        x: z.number().min(0).max(100).optional(),
                        y: z.number().min(0).max(100).optional(),
                        width: z.number().optional(),
                        height: z.number().optional(),
                        shape: z.enum(['rect', 'circle', 'spotlight']).optional(),
                      })
                      .strict()
                  )
                  .max(BOARD_DIAGRAM_MAX_AREAS),
                labels: z
                  .array(
                    z
                      .object({
                        text: z.string().min(1).max(200),
                        x: z.number().min(0).max(100),
                        y: z.number().min(0).max(100),
                      })
                      .strict()
                  )
                  .max(BOARD_DIAGRAM_MAX_LABELS),
                balls: z
                  .array(
                    z
                      .object({
                        x: z.number().min(0).max(100),
                        y: z.number().min(0).max(100),
                      })
                      .strict()
                  )
                  .max(20)
                  .optional(),
                goals: z
                  .array(
                    z
                      .object({
                        id: z.string().min(1).max(64),
                        x: z.number().min(0).max(100),
                        y: z.number().min(0).max(100),
                        width: z.number().optional(),
                        type: z.string().max(32).optional(),
                      })
                      .strict()
                  )
                  .max(10)
                  .optional(),
                coach: z
                  .object({
                    x: z.number().min(0).max(100),
                    y: z.number().min(0).max(100),
                    label: z.string().max(64).optional(),
                    note: z.string().max(500).optional(),
                  })
                  .strict()
                  .optional(),
                cones: z
                  .array(
                    z
                      .object({
                        x: z.number().min(0).max(100),
                        y: z.number().min(0).max(100),
                        color: z.string().max(32).optional(),
                      })
                      .strict()
                  )
                  .max(40)
                  .optional(),
                elements: z.array(BoardElementSchema).max(BOARD_DIAGRAM_MAX_ELEMENTS).optional(),
              })
              .strict()
          )
          .min(1)
          .max(BOARD_DIAGRAM_MAX_FRAMES),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ParsedWebDiagramV1 = z.infer<typeof WebDiagramV1Schema>;

export function parseWebDiagramV1(input: unknown): {
  ok: true;
  diagram: WebDiagramV1;
} | {
  ok: false;
  error: string;
  details?: unknown;
} {
  const bytes = Buffer.byteLength(JSON.stringify(input ?? null), 'utf8');
  if (bytes > BOARD_DIAGRAM_MAX_BYTES) {
    return {
      ok: false,
      error: `Diagram exceeds ${BOARD_DIAGRAM_MAX_BYTES} byte limit`,
    };
  }

  const parsed = WebDiagramV1Schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Invalid diagram',
      details: parsed.error.flatten(),
    };
  }

  return { ok: true, diagram: parsed.data as WebDiagramV1 };
}
