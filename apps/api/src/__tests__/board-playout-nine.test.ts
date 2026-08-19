import {
  applyPlayOutSequenceToDiagram,
  isPlayOutRequest,
  wantsCentralNinePlayOut,
} from '../services/board-phase-placement';
import { shouldComposeAttackingCombo } from '../services/board-combo-composer';
import { wantsFrozenPlayers } from '../services/board-ai-chat';
import { defaultMatchBoardDiagram } from '../services/web-diagram-v1';
import { parseWebDiagramV1 } from '../services/board-diagram-schema';

const ASK = 'show me a good playout centrally to engage the 9';

describe('central play-out to engage the 9', () => {
  const eleven = defaultMatchBoardDiagram('11V11');

  test('playout as one word is a play-out, not a frozen combo', () => {
    expect(isPlayOutRequest(ASK)).toBe(true);
    expect(wantsCentralNinePlayOut(ASK)).toBe(true);
    expect(shouldComposeAttackingCombo(ASK)).toBe(false);
    expect(wantsFrozenPlayers(ASK)).toBe(false);
  });

  test('does not steal a named passing sequence', () => {
    const combo =
      'based on our board, create a passing sequence from the 6 to 8/10 to the 9 and then the 11';
    expect(isPlayOutRequest(combo)).toBe(false);
    expect(shouldComposeAttackingCombo(combo)).toBe(true);
  });

  test('replaces a leftover combo filmstrip instead of drawing on it', () => {
    const comboish: typeof eleven = {
      ...eleven,
      sequence: {
        activeFrameId: 'f-2',
        frames: [
          {
            id: 'f-start',
            title: '1. Start (board)',
            players: eleven.players,
            arrows: [],
            areas: [],
            labels: [],
          },
          {
            id: 'f-2',
            title: '2. Play',
            players: eleven.players,
            arrows: [
              {
                from: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 4)?.id },
                to: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 6)?.id },
                type: 'pass',
                style: 'solid',
                weight: 'bold',
              },
            ],
            areas: [],
            labels: [],
          },
        ],
      },
    };
    const out = applyPlayOutSequenceToDiagram(comboish, ASK);
    expect(out.sequence?.frames.length).toBeGreaterThanOrEqual(3);
    expect(out.sequence?.frames[0]?.title).not.toMatch(/Start \(board\)/i);
    const nine = out.players.find((p) => p.team === 'ATT' && p.number === 9);
    const active =
      out.sequence?.frames.find((f) => f.id === out.sequence?.activeFrameId) ||
      out.sequence?.frames[2];
    expect(active?.arrows.some((a) => a.type === 'pass' && a.to.playerId === nine?.id)).toBe(true);
  });

  test('restacks and plays into ATT #9 on the teaching frame', () => {
    const out = applyPlayOutSequenceToDiagram(eleven, ASK);
    const frames = out.sequence?.frames || [];
    expect(frames.length).toBeGreaterThanOrEqual(3);
    const active =
      frames.find((f) => f.id === out.sequence?.activeFrameId) || frames[frames.length - 1];
    const nine = active.players.find((p) => p.team === 'ATT' && p.number === 9);
    expect(nine).toBeTruthy();
    const intoNine = active.arrows.filter(
      (a) => a.type === 'pass' && a.to.playerId === nine?.id
    );
    expect(intoNine.length).toBeGreaterThanOrEqual(1);
    expect(active.arrows.some((a) => a.from.playerId === nine?.id && a.type === 'run')).toBe(
      false
    );
    const parsed = parseWebDiagramV1(out);
    expect(parsed.ok).toBe(true);
  });
});
