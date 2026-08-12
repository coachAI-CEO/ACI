import {
  BOARD_DIAGRAM_MAX_PLAYERS,
  parseWebDiagramV1,
} from '../services/board-diagram-schema';
import {
  BLANK_BOARD_DIAGRAM,
  isDiagramThinForFork,
  toWebDiagramV1,
} from '../services/web-diagram-v1';

describe('toWebDiagramV1', () => {
  test('keeps THIRD pitch variant', () => {
    const web = toWebDiagramV1({
      pitch: { variant: 'THIRD', orientation: 'HORIZONTAL', showZones: false },
      players: [{ id: 'a1', team: 'ATT', x: 10, y: 20 }],
      arrows: [],
    });
    expect(web?.pitch.variant).toBe('THIRD');
    expect(web?.players).toHaveLength(1);
    expect(web?.arrows).toEqual([]);
    expect(web?.areas).toEqual([]);
    expect(web?.labels).toEqual([]);
  });

  test('coerces QUARTER and CUSTOM to HALF', () => {
    expect(
      toWebDiagramV1({
        pitch: { variant: 'QUARTER', orientation: 'VERTICAL' },
        players: [{ id: 'p1', team: 'DEF', x: 1, y: 2 }],
      })?.pitch.variant
    ).toBe('HALF');
    expect(
      toWebDiagramV1({
        pitch: { variant: 'CUSTOM', orientation: 'HORIZONTAL' },
        players: [{ id: 'p1', team: 'DEF', x: 1, y: 2 }],
      })?.pitch.variant
    ).toBe('HALF');
  });

  test('drops players without numeric x/y', () => {
    const web = toWebDiagramV1({
      pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
      players: [
        { id: 'ok', team: 'ATT', x: 40, y: 50 },
        { id: 'bad', team: 'ATT', x: 'nope', y: 50 },
        { id: 'missing' },
      ],
    });
    expect(web?.players.map((p) => p.id)).toEqual(['ok']);
  });

  test('maps safeZones into areas', () => {
    const web = toWebDiagramV1({
      pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
      players: [{ id: 'p', team: 'ATT', x: 10, y: 10 }],
      safeZones: [{ label: 'press', x: 20, y: 30, width: 10, height: 10 }],
    });
    expect(web?.areas).toHaveLength(1);
    expect(web?.areas[0].label).toBe('press');
  });
});

describe('isDiagramThinForFork', () => {
  test('thin when missing or no players', () => {
    expect(isDiagramThinForFork(null)).toBe(true);
    expect(isDiagramThinForFork({ players: [], arrows: [{ type: 'pass' }] })).toBe(true);
  });

  test('thin when players exist but no arrows', () => {
    expect(
      isDiagramThinForFork({
        players: [{ id: 'a', x: 1, y: 2 }],
        arrows: [],
      })
    ).toBe(true);
  });

  test('not thin when players and arrows present', () => {
    expect(
      isDiagramThinForFork({
        players: [{ id: 'a', x: 1, y: 2 }],
        arrows: [{ type: 'pass', from: {}, to: {} }],
      })
    ).toBe(false);
  });
});

describe('parseWebDiagramV1', () => {
  test('accepts blank template', () => {
    const result = parseWebDiagramV1(BLANK_BOARD_DIAGRAM);
    expect(result.ok).toBe(true);
  });

  test('rejects too many players', () => {
    const players = Array.from({ length: BOARD_DIAGRAM_MAX_PLAYERS + 1 }, (_, i) => ({
      id: `p${i}`,
      team: 'ATT' as const,
      x: 10,
      y: 10,
    }));
    const result = parseWebDiagramV1({
      pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
      players,
      arrows: [],
      areas: [],
      labels: [],
    });
    expect(result.ok).toBe(false);
  });

  test('rejects oversized JSON payload', () => {
    const hugeLabel = 'x'.repeat(70_000);
    const result = parseWebDiagramV1({
      pitch: { variant: 'HALF', orientation: 'HORIZONTAL' },
      players: [{ id: 'p1', team: 'ATT', x: 1, y: 1 }],
      arrows: [],
      areas: [],
      labels: [{ text: hugeLabel, x: 1, y: 1 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/byte limit/i);
    }
  });
});
