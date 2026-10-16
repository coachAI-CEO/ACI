import {
  BOARD_DIAGRAM_MAX_FRAMES,
  parseWebDiagramV1,
} from '../services/board-diagram-schema';
import { toWebDiagramV1 } from '../services/web-diagram-v1';

const pitch = { variant: 'FULL' as const, orientation: 'HORIZONTAL' as const, format: '7V7' as const };
const player = {
  id: 'p1',
  team: 'ATT' as const,
  number: 9,
  name: 'Striker',
  group: 'g-front',
  x: 40,
  y: 50,
};
const arrow = {
  id: 'a1',
  from: { playerId: 'p1' },
  to: { x: 80, y: 50 },
  type: 'pass' as const,
  style: 'solid' as const,
  weight: 'normal' as const,
};

function layers() {
  return {
    players: [player],
    arrows: [arrow],
    areas: [{ id: 'z1', label: 'box', x: 70, y: 40, width: 20, height: 20, shape: 'rect' as const }],
    labels: [{ id: 'l1', text: 'Switch', x: 50, y: 20 }],
    balls: [{ id: 'b1', x: 48, y: 50 }],
  };
}

function diagramWithFrames(count: number, note?: string) {
  const frames = Array.from({ length: count }, (_, i) => ({
    id: `f-${i + 1}`,
    title: `Frame ${i + 1}`,
    note,
    durationMs: 1600,
    ...layers(),
  }));
  return {
    pitch,
    ...layers(),
    sequence: { activeFrameId: frames[0].id, frames },
  };
}

describe('board session-next schema', () => {
  test('keeps player name/group and object ids', () => {
    const web = toWebDiagramV1({
      pitch,
      players: [player],
      arrows: [arrow],
      areas: [{ id: 'z1', x: 10, y: 10, width: 8, height: 8 }],
      labels: [{ id: 'l1', text: 'Go', x: 1, y: 1 }],
      balls: [{ id: 'b1', x: 50, y: 50 }],
    });
    expect(web?.players[0].name).toBe('Striker');
    expect(web?.players[0].group).toBe('g-front');
    expect(web?.arrows[0].id).toBe('a1');
    expect(web?.areas[0].id).toBe('z1');
    expect(web?.labels[0].id).toBe('l1');
    expect(web?.balls?.[0].id).toBe('b1');
    const parsed = parseWebDiagramV1(web);
    expect(parsed.ok).toBe(true);
  });

  test(`accepts ${BOARD_DIAGRAM_MAX_FRAMES} frames and a 500-char note`, () => {
    const note = 'n'.repeat(500);
    const result = parseWebDiagramV1(diagramWithFrames(BOARD_DIAGRAM_MAX_FRAMES, note));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diagram.sequence?.frames).toHaveLength(BOARD_DIAGRAM_MAX_FRAMES);
      expect(result.diagram.sequence?.frames[0].note).toHaveLength(500);
    }
  });

  test(`rejects ${BOARD_DIAGRAM_MAX_FRAMES + 1} frames`, () => {
    const result = parseWebDiagramV1(diagramWithFrames(BOARD_DIAGRAM_MAX_FRAMES + 1));
    expect(result.ok).toBe(false);
  });

  test('rejects a 501-char coaching note', () => {
    const result = parseWebDiagramV1(diagramWithFrames(2, 'n'.repeat(501)));
    expect(result.ok).toBe(false);
  });

  test('assigns missing ids on arrows, areas, labels, and balls', () => {
    const web = toWebDiagramV1({
      pitch,
      players: [{ id: 'p1', team: 'ATT', x: 10, y: 10 }],
      arrows: [
        {
          from: { x: 1, y: 1 },
          to: { x: 2, y: 2 },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
      ],
      areas: [{ x: 3, y: 3, width: 4, height: 4 }],
      labels: [{ text: 'Go', x: 5, y: 5 }],
      balls: [{ x: 50, y: 50 }],
    });
    expect(web?.arrows[0].id).toBe('a-0');
    expect(web?.areas[0].id).toBe('z-0');
    expect(web?.labels[0].id).toBe('l-0');
    expect(web?.balls?.[0].id).toBe('b-0');
    expect(parseWebDiagramV1(web).ok).toBe(true);
  });
});
