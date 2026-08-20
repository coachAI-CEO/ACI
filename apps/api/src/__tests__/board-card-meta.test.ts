import { summarizeBoardCardMeta } from '../services/board-card-meta';
import { build11v11FormationPlayers, defaultMatchBoardDiagram } from '../services/web-diagram-v1';

describe('summarizeBoardCardMeta', () => {
  test('reads phase, zone, and channel from setup caption', () => {
    const meta = summarizeBoardCardMeta({
      labels: [{ text: 'Blue attacking · Def third · Center', x: 80, y: 76 }],
      players: [],
      areas: [],
      balls: [{ x: 50, y: 80 }],
    });
    expect(meta.phase).toBe('ATTACKING');
    expect(meta.zone).toBe('DEFENSIVE_THIRD');
    expect(meta.channel).toBe('CENTER');
  });

  test('infers formations from 11v11 shirts', () => {
    const meta = summarizeBoardCardMeta({
      labels: [],
      areas: [],
      players: [
        ...build11v11FormationPlayers('4-3-3', 'ATT'),
        ...build11v11FormationPlayers('4-2-3-1', 'DEF'),
      ],
      balls: [{ x: 50, y: 80 }],
    });
    expect(meta.attFormation).toBe('4-3-3');
    expect(meta.defFormation).toBe('4-2-3-1');
    expect(meta.zone).toBe('DEFENSIVE_THIRD');
    expect(meta.channel).toBe('CENTER');
  });

  test('does not invent zone on an empty board', () => {
    const meta = summarizeBoardCardMeta({
      labels: [],
      players: [],
      areas: [],
      balls: [{ x: 50, y: 50 }],
    });
    expect(meta.phase).toBeNull();
    expect(meta.zone).toBeNull();
    expect(meta.channel).toBeNull();
    expect(meta.attFormation).toBeNull();
    expect(meta.defFormation).toBeNull();
  });

  test('7v7 seed is 2-3-1 vs 3-2-1, not 4-3-3', () => {
    const meta = summarizeBoardCardMeta(defaultMatchBoardDiagram('7V7'));
    expect(meta.attFormation).toBe('2-3-1');
    expect(meta.defFormation).toBe('3-2-1');
  });

  test('9v9 seed is 3-2-3 vs 2-3-2-1, not 4-3-3 vs 4-2-3-1', () => {
    const meta = summarizeBoardCardMeta(defaultMatchBoardDiagram('9V9'));
    expect(meta.attFormation).toBe('3-2-3');
    expect(meta.defFormation).toBe('2-3-2-1');
  });
});
