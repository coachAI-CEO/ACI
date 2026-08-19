import { inferFormationsFromMessage } from '../services/formation-principles';
import {
  applyPlayOutSequenceToDiagram,
  inferFormationFromPlayers,
  isPlayOutRequest,
  needsPlayOutMotifClarification,
  hasPlayOutMotifLock,
  placePhaseSnapshot,
} from '../services/board-phase-placement';
import { build11v11FormationPlayers } from '../services/web-diagram-v1';

const PROGRESS_VS_4231 =
  "based on whats in the board, whats the optional way to progress to midfield vs a 4231 in the central channel";

function attOf(
  players: { team?: string; number?: number; x: number; y: number }[],
  n: number
) {
  return players.find((p) => p.team === 'ATT' && p.number === n);
}

describe('isPlayOutRequest', () => {
  test('treats progress-to-midfield vs a named press as play-out', () => {
    expect(isPlayOutRequest(PROGRESS_VS_4231)).toBe(true);
  });

  test('treats build-to-midfield from the current board as play-out', () => {
    expect(
      isPlayOutRequest(
        'best way to build to midfield using the central channel based on how the board is setup'
      )
    ).toBe(true);
  });

  test('does not treat a final-third finish question as play-out', () => {
    expect(isPlayOutRequest('how should #9 finish the cross in their box')).toBe(false);
  });
});

describe('play-out motif lock', () => {
  const boardAsk =
    'best way to build to midfield using the central channel based on how the board is setup';
  const offer = {
    role: 'assistant' as const,
    content:
      'That’s a known Rocklin build-out.\n1. #6 drop (default) — Split CBs.\nReply **1** (playbook default), **2**, or “just draw it”.',
  };

  test('asks before drawing a vague board-based build-out', () => {
    expect(needsPlayOutMotifClarification(boardAsk, [])).toBe(true);
    expect(hasPlayOutMotifLock(boardAsk, [])).toBe(false);
  });

  test('locks when the coach names the #6 drop', () => {
    expect(needsPlayOutMotifClarification('draw the #6 drop vs their 10', [])).toBe(false);
    expect(hasPlayOutMotifLock('draw the #6 drop vs their 10', [])).toBe(true);
  });

  test('locks when the coach confirms option 1 after the offer', () => {
    expect(hasPlayOutMotifLock('1', [offer])).toBe(true);
    expect(needsPlayOutMotifClarification('1', [offer])).toBe(false);
  });

  test('just draw it skips the motif question', () => {
    expect(hasPlayOutMotifLock('just draw it', [])).toBe(true);
    expect(needsPlayOutMotifClarification(boardAsk + ' — just draw it', [])).toBe(false);
  });
});

describe('inferFormationsFromMessage', () => {
  test('vs a 4231 is DEF only — does not steal ATT', () => {
    const { att, def } = inferFormationsFromMessage('progress vs a 4231 in the central channel');
    expect(def).toBe('4-2-3-1');
    expect(att).toBeNull();
  });

  test('433 vs 4231 names both sides', () => {
    const { att, def } = inferFormationsFromMessage('4-3-3 vs 4-2-3-1');
    expect(att).toBe('4-3-3');
    expect(def).toBe('4-2-3-1');
  });
});

describe('4-3-3 vs 4-2-3-1 goal-kick chassis', () => {
  const roster = [
    ...build11v11FormationPlayers('4-3-3', 'ATT'),
    ...build11v11FormationPlayers('4-2-3-1', 'DEF'),
  ];

  test('infers ATT 4-3-3 and DEF 4-2-3-1 from roster roles', () => {
    expect(inferFormationFromPlayers(roster, 'ATT')).toBe('4-3-3');
    expect(inferFormationFromPlayers(roster, 'DEF')).toBe('4-2-3-1');
  });

  test('#6 drops between split CBs; fullbacks are high-wide not on the goal line', () => {
    const placed = placePhaseSnapshot({
      roster,
      subPhase: 'goal_kick',
      attFormation: '4-3-3',
      defFormation: '4-2-3-1',
      channelX: 50,
      defBlock: 'high',
      includeMotifArrows: true,
    });

    const six = attOf(placed.players, 6)!;
    const four = attOf(placed.players, 4)!;
    const five = attOf(placed.players, 5)!;
    const two = attOf(placed.players, 2)!;
    const three = attOf(placed.players, 3)!;

    const cbMinX = Math.min(four.x, five.x);
    const cbMaxX = Math.max(four.x, five.x);
    expect(cbMaxX - cbMinX).toBeGreaterThan(20);
    expect(six.x).toBeGreaterThan(cbMinX);
    expect(six.x).toBeLessThan(cbMaxX);
    expect(Math.abs(six.y - (four.y + five.y) / 2)).toBeLessThan(6);

    expect(two.y).toBeLessThan(85);
    expect(three.y).toBeLessThan(85);
    expect(two.x).toBeGreaterThan(80);
    expect(three.x).toBeLessThan(20);
  });

  test('progress vs 4231 sequence keeps #6 between CBs on the first teaching frame', () => {
    const diagram = {
      pitch: { variant: 'FULL' as const, orientation: 'HORIZONTAL' as const, format: '11V11' as const },
      players: roster,
      arrows: [],
      areas: [],
      labels: [],
      balls: [{ x: 50, y: 90 }],
    };
    const next = applyPlayOutSequenceToDiagram(diagram, PROGRESS_VS_4231);
    const frame = next.sequence?.frames?.[0];
    expect(frame).toBeTruthy();
    const six = attOf(frame!.players || [], 6)!;
    const four = attOf(frame!.players || [], 4)!;
    const five = attOf(frame!.players || [], 5)!;
    expect(Math.abs(six.y - (four.y + five.y) / 2)).toBeLessThan(6);
    expect(six.x).toBeGreaterThan(Math.min(four.x, five.x));
    expect(six.x).toBeLessThan(Math.max(four.x, five.x));
  });

  test('build-to-midfield from the board applies the same first-line chassis', () => {
    const diagram = {
      pitch: { variant: 'FULL' as const, orientation: 'HORIZONTAL' as const, format: '11V11' as const },
      players: roster,
      arrows: [],
      areas: [],
      labels: [
        { text: 'Blue attacking · Def third · Center', x: 20, y: 20 },
        { text: 'ATT #6 between/ beside CBs', x: 20, y: 28 },
      ],
      balls: [{ x: 50, y: 90 }],
    };
    const next = applyPlayOutSequenceToDiagram(
      diagram,
      'best way to build to midfield using the central channel based on how the board is setup'
    );
    expect(next.sequence?.frames?.length).toBeGreaterThanOrEqual(3);
    const six = attOf(next.sequence!.frames[0].players || [], 6)!;
    const four = attOf(next.sequence!.frames[0].players || [], 4)!;
    const five = attOf(next.sequence!.frames[0].players || [], 5)!;
    expect(Math.abs(six.y - (four.y + five.y) / 2)).toBeLessThan(6);
    expect(six.x).toBeGreaterThan(Math.min(four.x, five.x));
    expect(six.x).toBeLessThan(Math.max(four.x, five.x));
  });
});
