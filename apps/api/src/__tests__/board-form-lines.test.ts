import {
  placePhaseSnapshot,
  applyPlayOutSequenceToDiagram,
} from '../services/board-phase-placement';
import {
  repairBoardDiagramWithSequence,
  buildAskReadings,
  messageWithReadingLocks,
} from '../services/board-ai-chat';
import {
  separateOverlappingPlayers,
  unstackDiagram,
  SOLVER_MIN_PLAYER_GAP,
} from '../services/board-layout-solver';
import { defaultMatchBoardDiagram, type WebDiagramV1 } from '../services/web-diagram-v1';
import { scoreFormLines, yDriftIssues } from '../services/board-form-lines';
import type { FormationId11 } from '../services/formation-principles';

const ASK = 'play out through the 6, 8 and 10';

function eleven(): WebDiagramV1 {
  return defaultMatchBoardDiagram('11V11');
}

function expectFormLines(players: WebDiagramV1['players'], att: FormationId11, def: FormationId11) {
  const issues = scoreFormLines(players, { attFormation: att, defFormation: def });
  expect(issues).toEqual([]);
}

describe('FORM_LINES — 11v11 chassis is last writer', () => {
  test('A1: 4-3-3 vs 4-2-3-1 goal-kick chassis keeps shape', () => {
    const placed = placePhaseSnapshot({
      roster: eleven().players,
      subPhase: 'goal_kick',
      attFormation: '4-3-3',
      defFormation: '4-2-3-1',
      channelX: 50,
    });
    expectFormLines(placed.players, '4-3-3', '4-2-3-1');
  });

  test('A2: width-only unstack does not drift BACK/MID y', () => {
    const placed = placePhaseSnapshot({
      roster: eleven().players,
      subPhase: 'goal_kick',
      attFormation: '4-3-3',
      defFormation: '4-2-3-1',
      channelX: 50,
    });
    const after = separateOverlappingPlayers(placed.players);
    expect(yDriftIssues(placed.players, after)).toEqual([]);
    expectFormLines(after, '4-3-3', '4-2-3-1');
  });

  test('C2: applyPlayOutSequenceToDiagram keeps FORM_LINES on all 3 frames', () => {
    const after = applyPlayOutSequenceToDiagram(eleven(), ASK);
    const frames = after.sequence?.frames || [];
    expect(frames.length).toBeGreaterThanOrEqual(3);
    for (const f of frames.slice(0, 3)) {
      expectFormLines(f.players || [], '4-3-3', '4-2-3-1');
    }
  });

  test('C3: repairBoardDiagramWithSequence — play out through 6-8-10', () => {
    const after = repairBoardDiagramWithSequence(eleven(), ASK);
    const frames = after.sequence?.frames || [];
    expect(frames.length).toBeGreaterThanOrEqual(3);
    for (const f of frames.slice(0, 3)) {
      expectFormLines(f.players || [], '4-3-3', '4-2-3-1');
    }
    expectFormLines(after.players, '4-3-3', '4-2-3-1');
  });

  test('C3: option 3 bounce off the 8 still keeps FORM_LINES', () => {
    const board = eleven();
    const readings = buildAskReadings(ASK, board);
    const bounce = readings.find((r) => /bounce off the 8/i.test(r.title)) || readings[2];
    const draw = messageWithReadingLocks(ASK, bounce);
    expect(draw).toMatch(/play out/i);
    const after = repairBoardDiagramWithSequence(board, draw);
    const frames = after.sequence?.frames || [];
    expect(frames.length).toBeGreaterThanOrEqual(3);
    for (const f of frames.slice(0, 3)) {
      expectFormLines(f.players || [], '4-3-3', '4-2-3-1');
    }
  });

  test('compact high press survives unstack (tripwire if gap returns to 8%)', () => {
    const placed = placePhaseSnapshot({
      roster: eleven().players,
      subPhase: 'goal_kick',
      attFormation: '4-3-3',
      defFormation: '4-2-3-1',
      channelX: 50,
      defBlock: 'high',
    });
    const before = placed.players;
    const after = unstackDiagram({ ...eleven(), players: before }).players;
    expect(yDriftIssues(before, after)).toEqual([]);
    expectFormLines(after, '4-3-3', '4-2-3-1');
    expect(SOLVER_MIN_PLAYER_GAP).toBeLessThanOrEqual(4);
  });

  test.each<[FormationId11, FormationId11]>([
    ['4-3-3', '4-2-3-1'],
    ['4-3-3', '4-4-2'],
    ['4-4-2', '4-3-3'],
    ['4-2-3-1', '4-4-2'],
    ['3-5-2', '4-2-3-1'],
  ])('goal-kick %s vs %s keeps GK homes and back-line flats', (att, def) => {
    const placed = placePhaseSnapshot({
      roster: eleven().players,
      subPhase: 'goal_kick',
      attFormation: att,
      defFormation: def,
      channelX: 50,
    });
    const issues = scoreFormLines(placed.players, { attFormation: att, defFormation: def });
    expect(issues.filter((i) => i.startsWith('GK_HOME') || i.startsWith('ATT_CB_FLAT'))).toEqual([]);
  });
});
