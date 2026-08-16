import {
  buildAskReadings,
  formatAskReadingsReply,
  assistantOfferedAskReadings,
  needsAskReadings,
  needsBoardClarification,
  parseImportReviewAnswers,
  parsePickedReadingIndex,
  readBoardSetup,
  wantsTacticalReadings,
  wantsKeepPriorFrame,
  ensureSequenceStartsFromOriginal,
  lockDslForTurn,
  nudgeAttSixHigher,
  dropNamedShirt,
  retargetNamedRunArrows,
  lockSequencePlayersToOriginal,
  looksLikeFunctionPractice,
  scrubCoachReply,
  scrubImportOrganisation,
  wantsFrozenPlayers,
  wantsScaleToEleven,
  retargetDeliveryTowardGoal,
  nudgeRondoCorrection,
} from '../services/board-ai-chat';
import { inferFormationsFromMessage } from '../services/formation-principles';
import { buildBoardSessionParams, vaultRecommendationFitsPicture } from '../services/board-session-bridge';
import { defaultMatchBoardDiagram, build11v11FormationPlayers } from '../services/web-diagram-v1';
import { ensureDslEquipmentFromMessage, ensureRondoRosterFromMessage, inferGridIntentFromMessage, lockDslFormat, lockDslSeed, parseBoardSymbolicDsl } from '../services/board-symbolic-dsl';
import { solveBoardLayout } from '../services/board-layout-solver';
import type { WebDiagramV1 } from '../services/web-diagram-v1';

const eleven = defaultMatchBoardDiagram('11V11');

function rondoDiagram(): WebDiagramV1 {
  return {
    pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format: '7V7', showZones: false },
    players: Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      number: i + 2,
      team: i < 4 ? 'ATT' : i < 8 ? 'DEF' : 'NEUTRAL',
      x: 40 + (i % 5) * 4,
      y: 45,
    })),
    arrows: [],
    areas: [{ label: 'rondo', x: 28, y: 38, width: 44, height: 24, shape: 'rect' }],
    labels: [],
    elements: [
      { id: 'mg-1', kind: 'mini-goal', x: 30, y: 50 },
      { id: 'mg-2', kind: 'mini-goal', x: 70, y: 50 },
    ],
  };
}

describe('needsAskReadings — draw by default', () => {
  const emptyHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  test('high press follow-up draws, does not offer apply-mode', () => {
    expect(
      needsAskReadings({
        message: 'High press in their third.',
        history: emptyHistory,
        diagram: eleven,
      })
    ).toBe(false);
    expect(wantsTacticalReadings('High press in their third.')).toBe(false);
  });

  test('show me how we press draws, it is not a readings ask', () => {
    const msg = 'Ok forget the rondo — show me how we press them in their third after we lose it.';
    expect(wantsTacticalReadings(msg)).toBe(false);
    expect(
      needsAskReadings({
        message: msg,
        history: emptyHistory,
        diagram: eleven,
      })
    ).toBe(false);
  });

  test('from this board press draws', () => {
    expect(
      needsAskReadings({
        message: 'Keep these players. From this board, show a high press in their third.',
        history: emptyHistory,
        diagram: eleven,
      })
    ).toBe(false);
  });

  test('just draw it never offers readings', () => {
    expect(
      needsAskReadings({
        message: '7v7 2-3-1 vs 3-2-1. Just draw it.',
        history: emptyHistory,
        diagram: eleven,
      })
    ).toBe(false);
  });

  test('coach asking for press readings gets tactical options, not apply-mode', () => {
    const msg = 'Give me 2 or 3 readings of how we could press';
    expect(wantsTacticalReadings(msg)).toBe(true);
    expect(needsAskReadings({ message: msg, history: emptyHistory, diagram: eleven })).toBe(true);
    const readings = buildAskReadings(msg, eleven);
    expect(readings.map((r) => r.title)).toEqual(['Jump the 6', 'Trap wide', 'Squeeze the 9']);
  });

  test('best way to play out still offers play-out readings', () => {
    const msg = 'Best way to play out against a 4-4-2 — give me numbered readings first';
    expect(needsAskReadings({ message: msg, history: emptyHistory, diagram: eleven })).toBe(true);
    const readings = buildAskReadings(msg, eleven);
    expect(readings.map((r) => r.title)).toEqual([
      'Split CBs, 6 drops',
      'Wide fullback triangle',
      'Bounce off the 8',
    ]);
    expect(readings[1].reshape).toBe(true);
    expect(readings[1].playCount).toBe(2);
  });
});

describe('draw as written — no 11v11 clarify', () => {
  test('mid block on a 9v9 board draws', () => {
    const nine = defaultMatchBoardDiagram('9V9');
    expect(needsBoardClarification('Show a mid block in our half', [], nine)).toBe(false);
  });

  test('high press follow-up on a match board keeps the filmstrip', () => {
    const press = solveBoardLayout(
      lockDslSeed(
        {
          activity: 'match_scenario',
          seed: 'current',
          grid: { intent: 'third_left', format: '11V11' },
          entities: [],
          equipment: [],
          actions: [{ type: 'press', from_id: 'def-9', to_id: 'att-6' }],
          moves: [],
        },
        { fromCurrentBoard: true }
      ),
      eleven
    );
    const sequenced = ensureSequenceStartsFromOriginal(
      press,
      eleven,
      'Keep these players. From this board, show a high press in their third.'
    );
    expect(sequenced.sequence?.frames.length).toBeGreaterThanOrEqual(2);
    expect(sequenced.sequence?.frames[0].players.length).toBe(22);
  });

  test('same-roster correction keeps an existing 2-frame strip', () => {
    const start = eleven;
    const play: WebDiagramV1 = {
      ...eleven,
      players: eleven.players.map((p) =>
        p.team === 'ATT' && p.number === 8 ? { ...p, y: Math.max(8, p.y - 12) } : p
      ),
      sequence: {
        frames: [
          {
            id: 'f-start',
            title: '1. Start (board)',
            durationMs: 1600,
            players: eleven.players,
            arrows: [],
            areas: eleven.areas || [],
            labels: [],
            elements: eleven.elements || [],
          },
          {
            id: 'f-2',
            title: '2. Play',
            durationMs: 1600,
            players: eleven.players,
            arrows: [],
            areas: eleven.areas || [],
            labels: [],
            elements: eleven.elements || [],
          },
        ],
        activeFrameId: 'f-2',
      },
    };
    const correction: WebDiagramV1 = {
      ...play,
      sequence: undefined,
    };
    const sequenced = ensureSequenceStartsFromOriginal(
      correction,
      play,
      'That’s not it — they are jumping the 6 so the bounce has to go into the 8, not back to the GK.'
    );
    expect(sequenced.sequence?.frames.length).toBe(2);
    expect(sequenced.sequence?.frames[0].id).toBe('f-start');
  });
});

describe('scrub coach reply', () => {
  test('strips home-9-9 ids and ball coords', () => {
    expect(scrubCoachReply('Press with home-9-9. Ball @(50,50).')).toBe('Press with #9.');
  });

  test('strips home-10 style ids', () => {
    expect(scrubCoachReply('Added a passing action from #6 to home-10 or #9')).toBe(
      'Added a passing action from #6 to #10 or #9'
    );
  });
});

describe('6 higher is toward their goal', () => {
  test('nudges ATT 6 to a lower y, not toward our goal', () => {
    const seven = defaultMatchBoardDiagram('7V7');
    const six = seven.players.find((p) => p.team === 'ATT' && p.number === 6);
    expect(six).toBeTruthy();
    const after = nudgeAttSixHigher(
      seven,
      "No that's too deep. I want the 6 higher, receiving in front of their first line."
    );
    const moved = after.players.find((p) => p.team === 'ATT' && p.number === 6);
    expect(moved?.y).toBeLessThan(six!.y);
  });
});

describe('pitch format lock', () => {
  test('9v9 rondo stays 9V9 even if the DSL names 2-3-1 / 7V7', () => {
    const nine = defaultMatchBoardDiagram('9V9');
    const dsl = lockDslFormat(
      lockDslSeed(
        {
          activity: 'rondo',
          seed: 'blank',
          grid: { intent: 'rondo', format: '7V7', attFormation: '2-3-1' },
          entities: [
            { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
            { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
          ],
          equipment: [],
          actions: [],
          moves: [],
        },
        {}
      ),
      { currentFormat: nine.pitch.format, message: '4v4+2 rondo in the middle third' }
    );
    const after = solveBoardLayout(dsl, nine);
    expect(after.pitch.format).toBe('9V9');
    expect(dsl.grid.format).toBe('9V9');
  });
});

describe('freeze this board', () => {
  test('detects keep-prior-frame, not shirt freeze', () => {
    expect(wantsKeepPriorFrame('Freeze this board and show a 4v4+2 rondo in the middle third')).toBe(
      true
    );
  });

  test('rondo from a match keeps Frame 1 as the saved picture', () => {
    const rondo = solveBoardLayout(
      lockDslSeed(
        {
          activity: 'rondo',
          seed: 'blank',
          grid: { intent: 'rondo', format: '7V7' },
          entities: [
            { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
            { id: 'att-5', team: 'ATT', number: 5, relative_position: 'perimeter' },
            { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
          ],
          equipment: [],
          actions: [],
          moves: [],
        },
        { keepPriorFrame: true }
      ),
      eleven
    );
    const sequenced = ensureSequenceStartsFromOriginal(
      rondo,
      eleven,
      'Freeze this board and show a 4v4+2 rondo'
    );
    expect(sequenced.sequence?.frames.length).toBeGreaterThanOrEqual(2);
    expect(sequenced.sequence?.frames[0].players.length).toBe(22);
    expect(sequenced.sequence?.frames[0].note).toMatch(/frozen board/i);
  });
});

describe('session recs match the live picture', () => {
  test('10-player rondo does not recommend 18–22 / 4-3-3 / U13', () => {
    const params = buildBoardSessionParams({
      message: 'How should we train this?',
      history: [
        {
          role: 'user',
          content: '7v7 2-3-1 vs 3-2-1 attacking build-up. Just draw it.',
        },
      ],
      diagram: rondoDiagram(),
      ageGroup: null,
    });
    expect(params.numbersMax).toBe(10);
    expect(params.numbersMin).toBeLessThanOrEqual(10);
    expect(params.ageGroup).toBe('U10');
    expect(params.topic.toLowerCase()).toMatch(/rondo/);
    expect(params.formationAttacking).not.toBe('4-3-3');
    expect(params.formationAttacking).not.toBe('2-3-1');
    expect(params.goalsAvailable).toBe(2);
  });

  test('2v2+2 rondo with a stray mini-goal still recs Goals 0', () => {
    const rondo = {
      ...rondoDiagram(),
      players: rondoDiagram().players.slice(0, 6),
      elements: [{ id: 'mg-1', kind: 'mini-goal' as const, x: 30, y: 50 }],
    };
    const params = buildBoardSessionParams({
      message: 'train this',
      history: [{ role: 'user' as const, content: '2v2+2 rondo in a 10 by 15' }],
      diagram: rondo,
      ageGroup: 'U10',
    });
    expect(params.formationAttacking).toBe('as-drawn');
    expect(params.goalsAvailable).toBe(0);
  });

  test('9v9 high press recs the press, not an earlier play-out', () => {
    const nine = defaultMatchBoardDiagram('9V9');
    const params = buildBoardSessionParams({
      message: 'How should we train this?',
      history: [
        { role: 'user', content: 'Play out from the back vs a 4-4-2' },
        { role: 'assistant', content: 'Drawn a play-out sequence.' },
      ],
      diagram: {
        ...nine,
        areas: [{ label: 'third_left', x: 8, y: 8, width: 84, height: 28, shape: 'rect' }],
        arrows: [
          {
            from: { playerId: nine.players.find((p) => p.team === 'DEF' && p.number === 9)?.id },
            to: { playerId: nine.players.find((p) => p.team === 'ATT' && p.number === 6)?.id },
            type: 'press',
            style: 'dashed',
            weight: 'normal',
          },
        ],
      },
      ageGroup: 'U12',
    });
    expect(params.phase).toBe('DEFENDING');
    expect(params.zone).toBe('ATTACKING_THIRD');
    expect(params.topic.toLowerCase()).toMatch(/press/);
    expect(params.formationAttacking).toBe('3-2-3');
    expect(params.formationDefending).toBe('2-3-2-1');
  });

  test('11v11 4-4-2 picture names 4-4-2, not 4-2-3-1', () => {
    const board = defaultMatchBoardDiagram('11V11');
    const with442 = {
      ...board,
      players: [
        ...board.players.filter((p) => p.team === 'ATT'),
        ...build11v11FormationPlayers('4-4-2', 'DEF'),
      ],
    };
    const params = buildBoardSessionParams({
      message: 'How should we train this?',
      history: [{ role: 'user', content: '11v11 4-3-3 vs 4-2-3-1 play out' }],
      diagram: with442,
      ageGroup: 'U13',
    });
    expect(params.formationDefending).toBe('4-4-2');
  });

  test('recs skip the Start frame and train the last teaching picture', () => {
    const press = {
      ...eleven,
      areas: [{ label: 'third_left', x: 8, y: 8, width: 84, height: 28, shape: 'rect' as const }],
      arrows: [
        {
          from: { playerId: eleven.players.find((p) => p.team === 'DEF' && p.number === 9)?.id },
          to: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 6)?.id },
          type: 'press' as const,
          style: 'dashed' as const,
          weight: 'normal' as const,
        },
      ],
    };
    const playOut = {
      ...eleven,
      areas: [{ label: 'half_att', x: 8, y: 62, width: 84, height: 30, shape: 'rect' as const }],
      arrows: [
        {
          from: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 1)?.id },
          to: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 4)?.id },
          type: 'pass' as const,
          style: 'solid' as const,
          weight: 'normal' as const,
        },
      ],
    };
    const params = buildBoardSessionParams({
      message: 'How should we train this?',
      history: [
        { role: 'user', content: 'Best way to play out against a 4-4-2 — give me numbered readings first' },
        { role: 'assistant', content: 'Here are 2–3 ways to play that.' },
        { role: 'user', content: '2' },
      ],
      diagram: {
        ...press,
        sequence: {
          frames: [
            {
              id: 'f-start',
              title: '1. Start (board)',
              durationMs: 1600,
              players: press.players,
              arrows: press.arrows,
              areas: press.areas,
              labels: [],
            },
            {
              id: 'f-2',
              title: '2. Play',
              durationMs: 1600,
              players: playOut.players,
              arrows: playOut.arrows,
              areas: playOut.areas,
              labels: [],
            },
          ],
          activeFrameId: 'f-start',
        },
      },
      ageGroup: 'U13',
    });
    expect(params.topic.toLowerCase()).toMatch(/play|build/);
    expect(params.phase).toBe('ATTACKING');
    expect(params.zone).toBe('DEFENSIVE_THIRD');
  });
});

describe('blank board format seed', () => {
  test('7v7 / 9v9 / 11v11 defaults have the right shirt counts', () => {
    expect(defaultMatchBoardDiagram('7V7').players).toHaveLength(14);
    expect(defaultMatchBoardDiagram('7V7').pitch.format).toBe('7V7');
    expect(defaultMatchBoardDiagram('9V9').players).toHaveLength(18);
    expect(defaultMatchBoardDiagram('11V11').players).toHaveLength(22);
  });
});

describe('live picture reading', () => {
  test('press arrows + their-third box is defending, not attacking progression', () => {
    const board: WebDiagramV1 = {
      ...eleven,
      areas: [{ label: 'third_left', x: 8, y: 8, width: 84, height: 28, shape: 'rect' }],
      arrows: [
        {
          from: { playerId: eleven.players.find((p) => p.team === 'DEF' && p.number === 9)?.id },
          to: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 6)?.id },
          type: 'press',
          style: 'dashed',
          weight: 'normal',
        },
      ],
      balls: [{ x: 50, y: 50 }],
    };
    const reading = readBoardSetup(board);
    expect(reading.phase).toMatch(/high press/i);
    expect(reading.focusThird).toBe('ATTACKING');
    expect(reading.summary).not.toMatch(/Ball @/);
  });
});

describe('import review Q1–Q3', () => {
  test('parses compact A A A and just-draw defaults', () => {
    expect(parseImportReviewAnswers('A A A')).toEqual({
      pictures: 'first',
      us: 'coached',
      draw: 'as_written',
      namedHint: null,
    });
    expect(parseImportReviewAnswers('just draw it')?.draw).toBe('as_written');
    expect(parseImportReviewAnswers('Q1 B Q2 A Q3 B')).toMatchObject({
      pictures: 'all',
      us: 'coached',
      draw: 'eleven',
    });
  });

  test('50×50 compactness review that said 6v6+GK is named 7v6+GK', () => {
    const reply = scrubImportOrganisation(
      'What I saw\n- Organisation: 6v6 + GK (yellow #1–#7 vs red #3/#4/#8/#9/#10/#11 + GK) on a 50x50 with mini-goals and compactness / 7v6 attacking triggers.'
    );
    expect(reply).toMatch(/Organisation: 7v6 \+ GK/);
    expect(reply).not.toMatch(/Organisation: 6v6/);
  });

  test('20×20 increasing-pressure 5v1+4 outside floaters is 5v5', () => {
    const reply = scrubImportOrganisation(
      'What I saw\n- Organisation: 5v1 + 4 outside floaters on a 20x20 with inner 10x10 and four mini-goals.'
    );
    expect(reply).toMatch(/Organisation: 5v5/);
    expect(reply).not.toMatch(/5v1 \+ 4/);
  });
});

describe('readings copy', () => {
  test('play-out picker is tactical, not apply-mode plumbing', () => {
    const msg = 'Best way to play out against a 4-4-2 — give me numbered readings first';
    const reply = formatAskReadingsReply({
      ask: msg,
      readings: buildAskReadings(msg, eleven),
    });
    expect(reply).toMatch(/ways to play that/i);
    expect(reply).not.toMatch(/how I can draw that/i);
    expect(reply).toMatch(/Split CBs/);
  });

  test('play-out picker names the asked 4-4-2, not leftover high press', () => {
    const msg = 'Best way to play out against a 4-4-2 — give me numbered readings first';
    const leftoverPress: WebDiagramV1 = {
      ...eleven,
      areas: [{ label: 'third_left', x: 8, y: 8, width: 84, height: 28, shape: 'rect' }],
      arrows: [
        {
          from: { playerId: eleven.players.find((p) => p.team === 'DEF' && p.number === 9)?.id },
          to: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 6)?.id },
          type: 'press',
          style: 'dashed',
          weight: 'normal',
        },
      ],
    };
    const reply = formatAskReadingsReply({
      ask: msg,
      readings: buildAskReadings(msg, leftoverPress),
      board: readBoardSetup(leftoverPress),
    });
    expect(reply).toMatch(/DEF 4-4-2/);
    expect(reply).toMatch(/playing out from the back/);
    expect(reply).not.toMatch(/high press/);
    expect(reply).not.toMatch(/ATT 4-4-2/);
  });

  test('CTA still counts as an offered reading after dropping “to draw”', () => {
    const msg = 'Give me 2 or 3 readings of how we could press';
    const reply = formatAskReadingsReply({
      ask: msg,
      readings: buildAskReadings(msg, eleven),
    });
    expect(assistantOfferedAskReadings([{ role: 'assistant', content: reply }])).toBe(true);
    expect(parsePickedReadingIndex('1')).toBe(1);
    expect(parsePickedReadingIndex('2')).toBe(2);
    expect(parsePickedReadingIndex('just draw it')).toBe(1);
    expect(
      parsePickedReadingIndex("Jump the 6 after we lose it — that's our press.")
    ).toBe(1);
    expect(
      parsePickedReadingIndex(
        "That's not it — they are jumping the 6 so the bounce has to go into the 8, not back to the GK."
      )
    ).toBeNull();
    expect(
      needsAskReadings({
        message:
          "That's not it — they are jumping the 6 so the bounce has to go into the 8, not back to the GK.",
        history: [
          { role: 'user', content: 'Play out from our right against a 4-4-2 that jumps the 6.' },
          { role: 'assistant', content: 'Applied the play-out to the board.' },
        ],
        diagram: eleven,
      })
    ).toBe(false);
    expect(
      !assistantOfferedAskReadings([{ role: 'assistant', content: reply }]) &&
        Boolean(parsePickedReadingIndex('1'))
    ).toBe(false);
  });
});

describe('vault honesty', () => {
  test('rondo picture does not claim a final-third play-out session fits', () => {
    const params = buildBoardSessionParams({
      message: 'How should we train this?',
      diagram: rondoDiagram(),
      ageGroup: 'U10',
    });
    expect(
      vaultRecommendationFitsPicture(
        {
          title: 'Final Third Penetration',
          summary: 'Playing out from the back / attacking third',
          phase: 'ATTACKING',
          zone: 'ATTACKING_THIRD',
          similarity: 0.4,
        },
        params
      )
    ).toBe(false);
  });

  test('possession in a final-third summary is not enough to fit a rondo', () => {
    const params = buildBoardSessionParams({
      message: 'How should we train this?',
      diagram: rondoDiagram(),
      ageGroup: 'U10',
    });
    expect(params.topic.toLowerCase()).toMatch(/rondo/);
    expect(
      vaultRecommendationFitsPicture(
        {
          title: 'Final Third Penetration',
          summary: 'Improve possession and penetration in the attacking third',
          phase: 'ATTACKING',
          zone: 'ATTACKING_THIRD',
          similarity: 0.55,
        },
        params
      )
    ).toBe(false);
  });

  test('play-out recs do not claim a middle-third breaking-lines session fits', () => {
    const playOut: WebDiagramV1 = {
      ...eleven,
      areas: [{ label: 'half_att', x: 8, y: 62, width: 84, height: 30, shape: 'rect' }],
      arrows: [
        {
          from: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 1)?.id },
          to: { playerId: eleven.players.find((p) => p.team === 'ATT' && p.number === 4)?.id },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
      ],
    };
    const params = buildBoardSessionParams({
      message: 'How should we train this?',
      history: [
        {
          role: 'user',
          content: 'Best way to play out against a 4-4-2 — give me numbered readings first',
        },
        { role: 'user', content: '2' },
      ],
      diagram: playOut,
      ageGroup: 'U13',
    });
    expect(params.topic.toLowerCase()).toMatch(/play|build/);
    expect(
      vaultRecommendationFitsPicture(
        {
          title: 'Breaking Lines: Advanced Progression and Penetration in the Middle Third',
          summary: 'Progress through the middle third with penetration',
          phase: 'ATTACKING',
          zone: 'MIDDLE_THIRD',
          similarity: 0.5,
        },
        params
      )
    ).toBe(false);
  });
});

describe('mini-goals when asked', () => {
  test('DSL without kit still places two mini-goals', () => {
    const dsl = ensureDslEquipmentFromMessage(
      lockDslSeed(
        {
          activity: 'rondo',
          seed: 'blank',
          grid: { intent: 'rondo', format: '7V7' },
          entities: [
            { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
            { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
          ],
          equipment: [],
          actions: [],
          moves: [],
        },
        {}
      ),
      '4v4+2 rondo in the middle third with mini-goals'
    );
    expect(dsl.equipment.filter((e) => e.kind === 'mini-goal')).toHaveLength(2);
    const after = solveBoardLayout(dsl);
    expect((after.elements || []).filter((e) => e.kind === 'mini-goal')).toHaveLength(2);
  });

  test('4v4+2 pads ATT/DEF/NEUTRAL when the DSL under-counted', () => {
    const dsl = ensureRondoRosterFromMessage(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '7V7' },
        entities: [
          { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
          { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [],
        moves: [],
      },
      '4v4+2 rondo in the middle third'
    );
    expect(dsl.entities.filter((e) => e.team === 'ATT')).toHaveLength(4);
    expect(dsl.entities.filter((e) => e.team === 'DEF')).toHaveLength(4);
    expect(dsl.entities.filter((e) => e.team === 'NEUTRAL')).toHaveLength(2);
    const after = solveBoardLayout(dsl);
    expect(after.players.filter((p) => p.team === 'NEUTRAL')).toHaveLength(2);
    expect(after.players).toHaveLength(10);
  });

  test('4v4+2 trims extra ATT shirts when the DSL over-counted', () => {
    const dsl = ensureRondoRosterFromMessage(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '7V7' },
        entities: [
          { id: 'att-9', team: 'ATT', number: 9, relative_position: 'perimeter' },
          { id: 'att-6', team: 'ATT', number: 6, relative_position: 'perimeter' },
          { id: 'att-2', team: 'ATT', number: 2, relative_position: 'perimeter' },
          { id: 'att-3', team: 'ATT', number: 3, relative_position: 'perimeter' },
          { id: 'att-7', team: 'ATT', number: 7, relative_position: 'perimeter' },
          { id: 'att-11', team: 'ATT', number: 11, relative_position: 'perimeter' },
          { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
          { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
          { id: 'neu-10', team: 'NEUTRAL', number: 10, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [],
        moves: [],
      },
      '4v4+2 rondo in the middle third'
    );
    expect(dsl.entities.filter((e) => e.team === 'ATT')).toHaveLength(4);
    expect(dsl.entities.filter((e) => e.team === 'DEF')).toHaveLength(4);
    expect(dsl.entities.filter((e) => e.team === 'NEUTRAL')).toHaveLength(2);
    expect(solveBoardLayout(dsl).players).toHaveLength(10);
  });

  test('4v4+2 drops a leftover GK instead of labeling a rondo shirt GK', () => {
    const dsl = ensureRondoRosterFromMessage(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '7V7' },
        entities: [
          { id: 'att-1', team: 'ATT', number: 1, role: 'GK', relative_position: 'perimeter' },
          { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
          { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [],
        moves: [],
      },
      '4v4+2 rondo in the middle third'
    );
    expect(dsl.entities.some((e) => e.number === 1 || String(e.role || '').toUpperCase() === 'GK')).toBe(
      false
    );
    const after = solveBoardLayout(dsl);
    expect(after.players).toHaveLength(10);
    expect(
      after.players.some((p) => p.number === 1 || String(p.role || '').toUpperCase() === 'GK')
    ).toBe(false);
  });
});

describe('mid-block after a function board', () => {
  test('our-half mid-block is a match grid, not a rondo token', () => {
    expect(inferGridIntentFromMessage('Show a mid block in our half')).toBe('half_att');
    expect(inferGridIntentFromMessage('Freeze this board and show a 4v4+2 rondo')).toBe('rondo');
  });

  test('how we could press is their-third, not leftover rondo', () => {
    expect(inferGridIntentFromMessage('Give me 2 or 3 readings of how we could press')).toBe(
      'third_left'
    );
  });

  test('playing out against a high press is our half, not their third', () => {
    expect(
      inferGridIntentFromMessage(
        "We're working on playing out against a high press this week. 2-3-1 vs 3-2-1, in our half."
      )
    ).toBe('half_att');
  });

  test('forget the rondo and press their third is a match third, not a rondo', () => {
    expect(
      inferGridIntentFromMessage(
        'Ok forget the rondo — show me how we press them in their third after we lose it.'
      )
    ).toBe('third_left');
  });

  test('press after a rondo reseeds a match chassis, not the 10-shirt roster', () => {
    const current = rondoDiagram();
    const locked = lockDslForTurn(
      {
        activity: 'match_scenario',
        seed: 'current',
        grid: { intent: 'rondo', format: '7V7' },
        entities: [
          { id: 'att-6', team: 'ATT', number: 6, relative_position: 'inside' },
          { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [{ type: 'press', from_id: 'att-9', to_id: 'def-6' }],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '7V7',
        current,
        message: 'Give me 2 or 3 readings of how we could press. LOCKED READING 1: Jump the 6.',
      }
    );
    expect(locked.activity).toBe('match_scenario');
    expect(locked.seed).toBe('formation');
    expect(locked.grid.intent).toBe('third_left');
    expect(locked.entities).toEqual([]);
    const after = solveBoardLayout(locked, current);
    expect(after.players.length).toBe(14);
  });

  test('forget-the-rondo press reseeds a 14-shirt match, not the rondo token', () => {
    const current = rondoDiagram();
    const msg =
      'Ok forget the rondo — show me how we press them in their third after we lose it.';
    expect(inferGridIntentFromMessage(msg)).toBe('third_left');
    const locked = lockDslForTurn(
      {
        activity: 'rondo',
        seed: 'current',
        grid: { intent: 'rondo', format: '7V7' },
        entities: current.players.map((p, i) => ({
          id: p.id,
          team: p.team,
          number: p.number,
          relative_position: i < 4 ? 'perimeter' : 'inside',
        })),
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '7V7',
        current,
        message: msg,
      }
    );
    expect(locked.activity).toBe('match_scenario');
    expect(locked.seed).toBe('formation');
    expect(locked.grid.intent).toBe('third_left');
    expect(solveBoardLayout(locked, current).players.length).toBe(14);
  });

  test('mid-block after a 9v9 rondo reseeds 18 shirts even if the model asked 11v11', () => {
    const current: WebDiagramV1 = {
      ...rondoDiagram(),
      pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format: '9V9', showZones: false },
      players: rondoDiagram().players.slice(0, 7).map((p) => ({ ...p })),
      areas: [{ label: 'rondo', x: 28, y: 38, width: 44, height: 24, shape: 'rect' }],
      elements: [
        { id: 'mg-1', kind: 'mini-goal', x: 30, y: 50 },
        { id: 'mg-2', kind: 'mini-goal', x: 70, y: 50 },
      ],
    };
    const msg = 'Alright put the teams back. Mid block in our half, compact, no one higher than the ball.';
    const locked = lockDslForTurn(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: {
          intent: 'half_att',
          format: '11V11',
          attFormation: '4-3-3',
          defFormation: '4-4-2',
        },
        entities: [],
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '9V9',
        current,
        message: msg,
      }
    );
    expect(locked.activity).toBe('match_scenario');
    expect(locked.seed).toBe('formation');
    expect(locked.grid.format).toBe('9V9');
    expect(locked.grid.intent).toBe('half_att');
    expect(locked.grid.attFormation).toBe('3-2-3');
    expect(locked.grid.defFormation).toBe('2-3-2-1');
    const after = solveBoardLayout(locked, current);
    expect(after.pitch.format).toBe('9V9');
    expect(after.players.length).toBe(18);
  });
});

describe('frozen Frame 1 survives later applies', () => {
  test('match-sized start is kept when the live picture is a rondo', () => {
    const match = defaultMatchBoardDiagram('7V7');
    const rondo = rondoDiagram();
    const fatRondo: WebDiagramV1 = {
      ...rondo,
      players: [
        ...rondo.players,
        { id: 'p10', number: 2, team: 'ATT', x: 44, y: 48 },
        { id: 'p11', number: 3, team: 'ATT', x: 48, y: 48 },
      ],
    };
    const original: WebDiagramV1 = {
      ...fatRondo,
      sequence: {
        frames: [
          {
            id: 'f-start',
            title: '1. Start (board)',
            durationMs: 1600,
            players: match.players,
            arrows: [],
            areas: [],
            labels: [],
          },
          {
            id: 'f-2',
            title: '2. Play',
            durationMs: 1600,
            players: fatRondo.players,
            arrows: [],
            areas: fatRondo.areas,
            labels: [],
            elements: fatRondo.elements,
          },
        ],
        activeFrameId: 'f-2',
      },
    };
    const next = solveBoardLayout(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: { intent: 'half_att', format: '7V7', attFormation: '2-3-1', defFormation: '3-2-1' },
        entities: [],
        equipment: [],
        actions: [],
        moves: [],
      },
      original
    );
    const sequenced = ensureSequenceStartsFromOriginal(
      next,
      original,
      'Show a mid block in our half.'
    );
    expect(sequenced.sequence?.frames[0].players.length).toBe(14);
    expect(sequenced.sequence?.frames.length).toBeGreaterThanOrEqual(2);
    expect((sequenced.sequence?.frames[1].players.length || 0)).toBeGreaterThanOrEqual(14);
  });

  test('freeze stamp keeps Frame 1 through a later 14-shirt apply', () => {
    const match = defaultMatchBoardDiagram('7V7');
    const later: WebDiagramV1 = {
      ...match,
      players: match.players.map((p) => ({ ...p, x: Math.min(100, p.x + 8) })),
    };
    const original: WebDiagramV1 = {
      ...later,
      sequence: {
        frames: [
          {
            id: 'f-start',
            title: '1. Start (board)',
            note: 'Frozen board — keep this picture as Frame 1 for later teaching sequences.',
            durationMs: 1600,
            players: match.players,
            arrows: [],
            areas: [],
            labels: [],
          },
          {
            id: 'f-2',
            title: '2. Play',
            durationMs: 1600,
            players: later.players,
            arrows: [],
            areas: [],
            labels: [],
          },
        ],
        activeFrameId: 'f-2',
      },
    };
    const sequenced = ensureSequenceStartsFromOriginal(
      later,
      original,
      "Don't move the players. Draw a pass from ATT 6 to a teammate."
    );
    expect(sequenced.sequence?.frames[0].players.map((p) => `${p.id}:${p.x}`)).toEqual(
      match.players.map((p) => `${p.id}:${p.x}`)
    );
    expect(sequenced.sequence?.frames[0].note).toMatch(/frozen board/i);
  });
});

describe('formation ask vs live shirts', () => {
  test('against that 4-4-2 is DEF, not ATT', () => {
    expect(
      inferFormationsFromMessage(
        'Best way to play out against that 4-4-2 — give me numbered readings first'
      )
    ).toEqual({ att: null, def: '4-4-2' });
    expect(
      inferFormationsFromMessage('Play out from our right against a 4-4-2 that jumps the 6.')
    ).toEqual({ att: null, def: '4-4-2' });
  });

  test('4-4-2 out of possession is the defensive block', () => {
    expect(
      inferFormationsFromMessage(
        'No wait, I wanted a mid block not a high press. Compact in the middle, 4-4-2 out of possession.'
      )
    ).toEqual({ att: null, def: '4-4-2' });
  });

  test('4-3-3 vs 4-4-2 still names both', () => {
    expect(inferFormationsFromMessage('4-3-3 vs 4-4-2, play out left channel')).toEqual({
      att: '4-3-3',
      def: '4-4-2',
    });
  });
});

describe('single-shirt edits after freeze', () => {
  test('drop the 8 tucks ATT 8 toward our goal and leaves others', () => {
    const nine = defaultMatchBoardDiagram('9V9');
    const eight = nine.players.find((p) => p.team === 'ATT' && p.number === 8);
    expect(eight).toBeTruthy();
    const drifted: WebDiagramV1 = {
      ...nine,
      players: nine.players.map((p) => ({ ...p, y: Math.max(8, p.y - 6) })),
    };
    const locked = lockSequencePlayersToOriginal(drifted, nine);
    const after = dropNamedShirt(
      locked,
      "That's our 8 too high. Drop the 8 without moving anyone else and show cover."
    );
    const moved = after.players.find((p) => p.team === 'ATT' && p.number === 8);
    expect(moved?.y).toBeGreaterThan(eight!.y);
    for (const orig of nine.players) {
      if (orig.team === 'ATT' && orig.number === 8) continue;
      const live = after.players.find((p) => p.id === orig.id);
      expect(live?.x).toBe(orig.x);
      expect(live?.y).toBe(orig.y);
    }
  });

  test("the 9's run is attached to ATT 9 not 10", () => {
    const nine = eleven.players.find((p) => p.team === 'ATT' && p.number === 9);
    const ten = eleven.players.find((p) => p.team === 'ATT' && p.number === 10);
    expect(nine && ten).toBeTruthy();
    const withRun: WebDiagramV1 = {
      ...eleven,
      arrows: [
        {
          from: { playerId: ten!.id },
          to: { x: 22, y: 18 },
          type: 'run',
          style: 'dashed',
          weight: 'normal',
        },
      ],
    };
    const after = retargetNamedRunArrows(
      withRun,
      "Don't move the players. Pass from 6 to 8, then show the 9's run in behind."
    );
    expect(after.arrows[0].from.playerId).toBe(nine!.id);
  });

  test("injects the 9's run when the freeze apply only drew a pass", () => {
    const nine = eleven.players.find((p) => p.team === 'ATT' && p.number === 9);
    const six = eleven.players.find((p) => p.team === 'ATT' && p.number === 6);
    const eight = eleven.players.find((p) => p.team === 'ATT' && p.number === 8);
    expect(nine && six && eight).toBeTruthy();
    const passOnly: WebDiagramV1 = {
      ...eleven,
      arrows: [
        {
          from: { playerId: six!.id },
          to: { playerId: eight!.id },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        },
      ],
    };
    const after = retargetNamedRunArrows(
      passOnly,
      "Don't move the players. Pass from 6 to 8, then show the 9's run in behind."
    );
    const run = after.arrows.find((a) => a.type === 'run');
    expect(run?.from.playerId).toBe(nine!.id);
    expect(typeof run?.to.y === 'number' ? run.to.y : 100).toBeLessThan(nine!.y);
  });

  test('jump the 6 bounce retargets a pass into att-8', () => {
    const locked = lockDslForTurn(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: { intent: 'half_att', format: '11V11', attFormation: '4-3-3', defFormation: '4-4-2' },
        entities: [],
        equipment: [],
        actions: [
          { type: 'pass', from_id: 'att-4', to_id: 'att-6' },
          { type: 'run', from_id: 'att-8', to_id: 'att-10' },
        ],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        message: 'Play out from our right against a 4-4-2 that jumps the 6.',
      }
    );
    expect(locked.actions.find((a) => a.type === 'pass')?.to_id).toBe('att-8');
  });
});

describe('coach copy scrub', () => {
  test('strips seed internals and doubled shirt labels', () => {
    expect(scrubCoachReply('Pass (#6, #6) with seed set to current, then (#8, #8).')).toBe(
      'Pass #6 then #8.'
    );
  });

  test('does not call a 7v3 rondo 7v7', () => {
    const rondo: WebDiagramV1 = {
      ...eleven,
      players: [
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `a${i}`,
          number: i + 2,
          team: 'ATT' as const,
          x: 40,
          y: 40 + i,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `d${i}`,
          number: i + 4,
          team: 'DEF' as const,
          x: 50,
          y: 44 + i,
        })),
      ],
    };
    expect(scrubCoachReply('This is a 7v7 rondo with pass from att-3 to att-10.', rondo)).toBe(
      'This is a 7v3 rondo with pass from #3 to #10.'
    );
  });
});

describe('vault formation tags', () => {
  test('3-3-2 vault cards do not fit a live 3-2-3 board', () => {
    const nine = defaultMatchBoardDiagram('9V9');
    const params = buildBoardSessionParams({
      message: 'How should we train this?',
      history: [
        {
          role: 'user',
          content: 'Win it in the middle and go. 3-2-3 vs 2-3-2-1, attacking transition.',
        },
      ],
      diagram: nine,
      ageGroup: 'U12',
    });
    expect(params.formationAttacking).toBe('3-2-3');
    expect(
      vaultRecommendationFitsPicture(
        {
          title: 'U12 High Press',
          summary: 'Press after loss in the attacking third',
          phase: 'TRANSITION',
          zone: 'ATTACKING_THIRD',
          similarity: 0.5,
          formationUsed: '3-3-2',
        },
        params
      )
    ).toBe(false);
    expect(
      vaultRecommendationFitsPicture(
        {
          title: 'U12 High Press 3-2-3',
          summary: 'Press after loss in the attacking third',
          phase: 'TRANSITION',
          zone: 'ATTACKING_THIRD',
          similarity: 0.5,
          formationUsed: '3-2-3',
        },
        params
      )
    ).toBe(true);
  });
});

function compactnessSsG(): WebDiagramV1 {
  return {
    pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format: '11V11', showZones: false },
    players: [
      { id: 'att-gk', number: 1, team: 'ATT', role: 'GK', x: 50, y: 92 },
      { id: 'att-2', number: 2, team: 'ATT', x: 22, y: 78 },
      { id: 'att-3', number: 3, team: 'ATT', x: 78, y: 78 },
      { id: 'att-4', number: 4, team: 'ATT', x: 38, y: 80 },
      { id: 'att-5', number: 5, team: 'ATT', x: 62, y: 80 },
      { id: 'att-6', number: 6, team: 'ATT', x: 42, y: 72 },
      { id: 'att-8', number: 8, team: 'ATT', x: 58, y: 72 },
      { id: 'def-7', number: 7, team: 'DEF', x: 78, y: 40 },
      { id: 'def-11', number: 11, team: 'DEF', x: 22, y: 40 },
      { id: 'def-9', number: 9, team: 'DEF', x: 50, y: 48 },
      { id: 'def-10', number: 10, team: 'DEF', x: 50, y: 38 },
    ],
    arrows: [],
    areas: [{ label: 'ssg_grid', x: 18, y: 28, width: 64, height: 50, shape: 'rect' }],
    labels: [],
    elements: [
      { id: 'mg-1', kind: 'mini-goal', x: 28, y: 32 },
      { id: 'mg-2', kind: 'mini-goal', x: 72, y: 32 },
    ],
  };
}

describe('import follow-ups keep the function picture', () => {
  test('freeze that / don’t restack / don’t flip lock shirts', () => {
    expect(
      wantsFrozenPlayers('freeze that, then the 9 plays wide to the 7 and the 7 delivers — don’t restack the teams')
    ).toBe(true);
    expect(wantsFrozenPlayers('keep us defending that big goal, don’t flip it')).toBe(true);
    expect(wantsKeepPriorFrame('Freeze this board and show a 4v4+2 rondo in the middle third')).toBe(true);
    expect(wantsFrozenPlayers('Freeze this board and show a 4v4+2 rondo in the middle third')).toBe(false);
  });

  test('freeze + pass keeps the live 11-shirt SSG, does not restack', () => {
    const current = compactnessSsG();
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-3-3', defFormation: '4-4-2' },
        entities: [
          { id: 'att-4', team: 'ATT', number: 4, relative_position: 'inside' },
          { id: 'def-9', team: 'DEF', number: 9, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [
          { type: 'pass', from_id: 'def-9', to_id: 'def-7' },
        ],
        moves: [{ id: 'att-4', to: 'grid_w' }],
      },
      {
        freeze: true,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: true,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        current,
        message: 'freeze that, then the 9 plays wide to the 7 — don’t restack the teams',
      }
    );
    expect(locked.seed).toBe('current');
    expect(locked.moves).toEqual([]);
    expect(locked.grid.intent).toBe('ssg_grid');
    const after = solveBoardLayout(locked, current);
    expect(after.players.length).toBe(11);
    const gk = after.players.find((p) => p.team === 'ATT' && p.number === 1);
    expect(gk?.y).toBeGreaterThan(85);
    expect((after.elements || []).filter((e) => e.kind === 'mini-goal').length).toBe(2);
    const att4 = after.players.find((p) => p.id === 'att-4');
    const orig4 = current.players.find((p) => p.id === 'att-4');
    expect(att4?.x).toBe(orig4?.x);
    expect(att4?.y).toBe(orig4?.y);
  });

  test('don’t flip does not reseed a match chassis', () => {
    const current = compactnessSsG();
    const locked = lockDslForTurn(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: { intent: 'third_left', format: '11V11', attFormation: '4-3-3', defFormation: '4-4-2' },
        entities: [],
        equipment: [],
        actions: [],
        moves: [{ id: 'att-6', to: 'grid_w' }],
      },
      {
        freeze: true,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: true,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        current,
        message: 'keep us defending that big goal, don’t flip it',
      }
    );
    expect(locked.seed).toBe('current');
    expect(locked.grid.intent).toBe('ssg_grid');
    const after = solveBoardLayout(locked, current);
    expect(after.players.length).toBe(11);
  });

  test('scale the same idea to 11v11 reseeds 22 shirts', () => {
    const current = compactnessSsG();
    const msg = 'ok now scale the same idea to 11v11 on this board';
    expect(wantsScaleToEleven(msg)).toBe(true);
    expect(inferGridIntentFromMessage(msg)).toBe('full_pitch');
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: current.players.map((p) => ({
          id: p.id,
          team: p.team,
          number: p.number,
          relative_position: 'inside' as const,
        })),
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: true,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        current,
        message: msg,
      }
    );
    expect(locked.seed).toBe('formation');
    expect(locked.activity).toBe('match_scenario');
    expect(locked.entities).toEqual([]);
    const after = solveBoardLayout(locked, current);
    expect(after.players.length).toBe(22);
  });

  test('train this on a 7v4 compactness board does not invent 4-3-3', () => {
    const current = compactnessSsG();
    const params = buildBoardSessionParams({
      message: 'train this',
      history: [
        { role: 'user', content: 'keep us defending that big goal, don’t flip it' },
      ],
      diagram: current,
      ageGroup: 'U16',
    });
    expect(params.numbersMax).toBe(11);
    expect(params.formationAttacking).not.toBe('4-3-3');
    expect(params.phase).toBe('DEFENDING');
    expect(params.topic.toLowerCase()).toMatch(/compact|deliver/);
    expect(
      vaultRecommendationFitsPicture(
        {
          title: 'Breaking Lines: Advanced Progression and Penetration in the Middle Third',
          summary: 'Attacking combination play',
          phase: 'ATTACKING',
          zone: 'MIDDLE_THIRD',
          similarity: 0.5,
          formationUsed: '4-3-3',
        },
        params
      )
    ).toBe(false);
  });

  test('2v2+2 from the PDF review paints two amber neutrals', () => {
    const locked = lockDslForTurn(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '7V7' },
        entities: [
          { id: 'att-2', team: 'ATT', number: 2, relative_position: 'perimeter' },
          { id: 'att-3', team: 'ATT', number: 3, relative_position: 'perimeter' },
          { id: 'att-6', team: 'ATT', number: 6, relative_position: 'perimeter' },
          { id: 'att-7', team: 'ATT', number: 7, relative_position: 'perimeter' },
          { id: 'def-4', team: 'DEF', number: 4, relative_position: 'inside' },
          { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: true,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '7V7',
        message: 'A A A',
        rosterHint: 'What I saw: 2v2+2 rondo. Pink neutrals on the short ends.',
      }
    );
    const att = locked.entities.filter((e) => e.team === 'ATT').length;
    const def = locked.entities.filter((e) => e.team === 'DEF').length;
    const neu = locked.entities.filter((e) => e.team === 'NEUTRAL').length;
    expect({ att, def, neu }).toEqual({ att: 2, def: 2, neu: 2 });
  });

  test('pinks-as-neutrals correction promotes two ATT shirts', () => {
    const locked = lockDslForTurn(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '7V7' },
        entities: [
          { id: 'att-2', team: 'ATT', number: 2, relative_position: 'perimeter' },
          { id: 'att-3', team: 'ATT', number: 3, relative_position: 'perimeter' },
          { id: 'att-6', team: 'ATT', number: 6, relative_position: 'perimeter' },
          { id: 'att-7', team: 'ATT', number: 7, relative_position: 'perimeter' },
          { id: 'def-4', team: 'DEF', number: 4, relative_position: 'inside' },
          { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '7V7',
        message: 'the pinks stay on the ends as neutrals, defenders a bit more compact inside',
      }
    );
    expect(locked.entities.filter((e) => e.team === 'NEUTRAL').length).toBe(2);
    expect(locked.entities.filter((e) => e.team === 'ATT').length).toBe(2);
  });

  test('7v6 in the review pads to 7 ATT + 6 DEF, not 6v5', () => {
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: compactnessSsG().players.map((p) => ({
          id: p.id,
          team: p.team,
          number: p.number,
          relative_position: 'inside' as const,
        })),
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: true,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        message: 'A A A',
        rosterHint: 'What I saw: 50x50, 7v6 plus GK, 4v4 attack, two mini-goals.',
      }
    );
    expect(locked.entities.filter((e) => e.team === 'ATT').length).toBe(7);
    expect(locked.entities.filter((e) => e.team === 'DEF').length).toBe(6);
  });

  test('4v4 attack on a 50×50 compactness review still pads 7v6', () => {
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: compactnessSsG().players.map((p) => ({
          id: p.id,
          team: p.team,
          number: p.number,
          relative_position: 'inside' as const,
        })),
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: true,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        message: 'A A A',
        rosterHint: 'What I saw: 50x50 grid, 4v4 attack into delivery, two mini-goals, compactness.',
      }
    );
    expect(locked.entities.filter((e) => e.team === 'ATT').length).toBe(7);
    expect(locked.entities.filter((e) => e.team === 'DEF').length).toBe(6);
    expect(locked.equipment.some((e) => e.kind === 'mini-goal')).toBe(true);
    const after = solveBoardLayout(locked);
    const att = after.players.filter((p) => p.team === 'ATT');
    const def = after.players.filter((p) => p.team === 'DEF');
    const attY = att.reduce((s, p) => s + p.y, 0) / att.length;
    const defY = def.reduce((s, p) => s + p.y, 0) / def.length;
    expect(attY).toBeGreaterThan(defY + 8);
    const ys = new Set(after.players.map((p) => Math.round(p.y / 4)));
    expect(ys.size).toBeGreaterThan(2);
    expect(def.some((p) => p.number === 9)).toBe(true);
  });

  test('4v4 in a 50×50 compactness review still pads 7v6 (not 8 shirts)', () => {
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: [
          { id: 'att-gk', team: 'ATT', number: 1, role: 'GK', relative_position: 'own_gk' },
          { id: 'att-2', team: 'ATT', number: 2, relative_position: 'inside' },
          { id: 'att-3', team: 'ATT', number: 3, relative_position: 'inside' },
          { id: 'att-4', team: 'ATT', number: 4, relative_position: 'inside' },
          { id: 'def-2', team: 'DEF', number: 2, relative_position: 'inside' },
          { id: 'def-3', team: 'DEF', number: 3, relative_position: 'inside' },
          { id: 'def-4', team: 'DEF', number: 4, relative_position: 'inside' },
          { id: 'def-7', team: 'DEF', number: 7, relative_position: 'inside' },
        ],
        equipment: [{ kind: 'mini-goal', placement: 'grid_e', quantity: 1 }],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: true,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        message: 'A A A',
        rosterHint: 'What I saw: Organisation 6v6+GK. 50x50, 4v4 compactness, mini-goals.',
      }
    );
    expect(locked.entities.filter((e) => e.team === 'ATT').length).toBe(7);
    expect(locked.entities.filter((e) => e.team === 'DEF').length).toBe(6);
    expect(locked.entities.some((e) => e.team === 'DEF' && e.number === 9)).toBe(true);
    expect(locked.entities.some((e) => e.team === 'DEF' && e.number === 11)).toBe(true);
    expect(locked.equipment.filter((e) => e.kind === 'mini-goal').reduce((n, e) => n + e.quantity, 0)).toBeGreaterThanOrEqual(2);
    const after = solveBoardLayout(locked);
    expect(after.players.filter((p) => p.team === 'DEF').some((p) => p.number === 9)).toBe(true);
    expect((after.elements || []).filter((e) => e.kind === 'mini-goal').length).toBe(2);
  });

  test('32-P6 5v1+4 outside pads 5v5, four mini-goals, waiters not queued', () => {
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: [
          { id: 'att-7', team: 'ATT', number: 7, relative_position: 'inside' },
          { id: 'att-8', team: 'ATT', number: 8, relative_position: 'inside' },
          { id: 'att-9', team: 'ATT', number: 9, relative_position: 'inside' },
          { id: 'att-10', team: 'ATT', number: 10, relative_position: 'inside' },
          { id: 'att-4', team: 'ATT', number: 4, relative_position: 'inside' },
          { id: 'def-8', team: 'DEF', number: 8, relative_position: 'perimeter' },
          { id: 'def-3', team: 'DEF', number: 3, relative_position: 'perimeter' },
          { id: 'def-4', team: 'DEF', number: 4, relative_position: 'perimeter' },
          { id: 'def-6', team: 'DEF', number: 6, relative_position: 'perimeter' },
        ],
        equipment: [{ kind: 'mini-goal', placement: 'grid_e', quantity: 2 }],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: true,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        message: 'A A A',
        rosterHint:
          'What I saw: Organisation 5v1 + 4 outside floaters. 20x20 with inner 10x10, four mini-goals, increasing pressure.',
      }
    );
    expect(locked.entities.filter((e) => e.team === 'ATT').length).toBe(5);
    expect(locked.entities.filter((e) => e.team === 'DEF').length).toBe(5);
    expect(locked.entities.some((e) => e.team === 'DEF' && e.number === 7)).toBe(true);
    expect(
      locked.equipment.filter((e) => e.kind === 'mini-goal').reduce((n, e) => n + (e.quantity || 1), 0)
    ).toBe(4);
    const after = solveBoardLayout(locked);
    expect(after.players.filter((p) => p.team === 'ATT').length).toBe(5);
    expect(after.players.filter((p) => p.team === 'DEF').length).toBe(5);
    expect((after.elements || []).filter((e) => e.kind === 'mini-goal').length).toBe(4);
    expect((after.areas || []).length).toBeGreaterThanOrEqual(2);
    const defs = after.players.filter((p) => p.team === 'DEF');
    const defYs = new Set(defs.map((p) => Math.round(p.y / 6)));
    expect(defYs.size).toBeGreaterThan(2);
  });

  test('scale to 11v11 does not keep SSG mini-goals or a 50×50 box', () => {
    const current = compactnessSsG();
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: [],
        equipment: [{ kind: 'mini-goal', placement: 'grid_e', quantity: 1 }],
        actions: [{ type: 'press', from_id: 'att-6', to_id: 'def-10' }],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: true,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        current,
        message: 'ok now scale the same idea to 11v11 on this board',
        rosterHint: 'What I saw: 50x50, 7v6 plus GK, two mini-goals, compactness / wide deliveries.',
      }
    );
    expect(locked.grid.intent).toBe('full_pitch');
    expect(locked.equipment.filter((e) => e.kind === 'mini-goal')).toEqual([]);
    expect(locked.actions).toEqual([]);
    const after = solveBoardLayout(locked, current);
    expect(after.players.length).toBe(22);
    expect((after.elements || []).filter((e) => e.kind === 'mini-goal').length).toBe(0);
    expect((after.areas || []).some((a) => /ssg/i.test(String(a.label || '')))).toBe(false);
    expect(after.arrows.length).toBe(0);
  });

  test('scale reply names our 4-4-2 vs their 4-3-3 when that is on the grass', () => {
    const diagram: WebDiagramV1 = {
      ...eleven,
      players: [
        ...build11v11FormationPlayers('4-4-2', 'ATT'),
        ...build11v11FormationPlayers('4-3-3', 'DEF'),
      ],
    };
    const reply = scrubCoachReply(
      'Scaled to 11v11 with a 4-3-3 formation for our attacking unit against their 4-4-2 defensive block.',
      diagram
    );
    expect(reply).toMatch(/4-4-2/);
    expect(reply).toMatch(/4-3-3/);
    expect(reply).not.toMatch(/4-3-3 formation for our/);
    expect(reply).not.toMatch(/against their 4-4-2/);
  });

  test('scale reply names their 4-3-3 instead of attacking shape', () => {
    const diagram: WebDiagramV1 = {
      ...eleven,
      players: [
        ...build11v11FormationPlayers('4-4-2', 'ATT'),
        ...build11v11FormationPlayers('4-3-3', 'DEF'),
      ],
    };
    const reply = scrubCoachReply(
      'Scaled to a full 11v11 with our 4-4-2 block against their attacking shape.',
      diagram
    );
    expect(reply).toMatch(/their 4-3-3/);
    expect(reply).not.toMatch(/their attacking shape/);
  });

  test('SSG apply reply lists the shirts on the grass', () => {
    const reply = scrubCoachReply('Applied the 50x50 compactness picture.', compactnessSsG());
    expect(reply).toMatch(/On the grass:/);
    expect(reply).toMatch(/#9/);
    expect(reply).toMatch(/#11/);
  });

  test('three mini-goals on a 50×50 compactness review cap at two', () => {
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: compactnessSsG().players.map((p) => ({
          id: p.id,
          team: p.team,
          number: p.number,
          relative_position: 'inside' as const,
        })),
        equipment: [
          { kind: 'mini-goal', placement: 'grid_w', quantity: 1 },
          { kind: 'mini-goal', placement: 'grid_e', quantity: 1 },
          { kind: 'mini-goal', placement: 'grid_n', quantity: 1 },
        ],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: true,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        message: 'A A A',
        rosterHint: 'What I saw: 50x50, 7v6 plus GK, two mini-goals, compactness.',
      }
    );
    expect(
      locked.equipment.filter((e) => e.kind === 'mini-goal').reduce((n, e) => n + e.quantity, 0)
    ).toBe(2);
    const after = solveBoardLayout(locked);
    expect((after.elements || []).filter((e) => e.kind === 'mini-goal').length).toBe(2);
  });

  test('freeze 9 plays wide to 7 still emits a pass', () => {
    const current = compactnessSsG();
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'current',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: [],
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: true,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: true,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        current,
        message: 'freeze that, then the 9 plays wide to the 7 and the 7 delivers — don’t restack the teams',
      }
    );
    expect(locked.actions.some((a) => a.type === 'pass' && a.from_id.includes('9') && a.to_id.includes('7'))).toBe(
      true
    );
    expect(locked.actions.some((a) => a.type === 'run' && a.from_id.includes('7'))).toBe(true);
  });

  test('the 7 delivers from a DEF shirt into our RIGHT box', () => {
    const current = compactnessSsG();
    const seven = current.players.find((p) => p.team === 'DEF' && p.number === 7)!;
    const withArrow: WebDiagramV1 = {
      ...current,
      arrows: [
        {
          from: { playerId: seven.id },
          to: { x: seven.x, y: 12 },
          type: 'run',
          style: 'dashed',
          weight: 'normal',
        },
      ],
    };
    const after = retargetDeliveryTowardGoal(
      withArrow,
      'freeze that, then the 9 plays wide to the 7 and the 7 delivers — don’t restack the teams'
    );
    const delivery = after.arrows.find((a) => a.from.playerId === seven.id);
    expect(typeof delivery?.to.y === 'number' ? delivery.to.y : 0).toBeGreaterThan(70);
  });

  test('don’t flip does not invent a Start/Play strip', () => {
    const current = compactnessSsG();
    const sequenced = ensureSequenceStartsFromOriginal(
      current,
      current,
      'keep us defending that big goal, don’t flip it'
    );
    expect(sequenced.sequence?.frames?.length || 0).toBe(0);
  });

  test('scale a defending function puts compactness on us, not a 4-3-3', () => {
    const current = compactnessSsG();
    const locked = lockDslForTurn(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: [],
        equipment: [{ kind: 'mini-goal', placement: 'grid_w', quantity: 2 }],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: true,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        current,
        message: 'ok now scale the same idea to 11v11 on this board',
      }
    );
    expect(locked.seed).toBe('formation');
    expect(locked.grid.attFormation).toBe('4-4-2');
    expect(locked.grid.defFormation).toBe('4-3-3');
    expect(locked.equipment).toEqual([]);
    expect(locked.actions).toEqual([]);
    const after = solveBoardLayout(locked, current);
    expect(after.players.length).toBe(22);
    expect(after.arrows.length).toBe(0);
  });

  test('scale to 11v11 after “don’t flip” still puts compactness on us', () => {
    const leftover = defaultMatchBoardDiagram('11V11');
    const locked = lockDslForTurn(
      {
        activity: 'match_scenario',
        seed: 'formation',
        grid: { intent: 'full_pitch', format: '11V11', attFormation: '4-3-3', defFormation: '4-2-3-1' },
        entities: [],
        equipment: [],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: true,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '11V11',
        current: leftover,
        message: 'ok now scale the same idea to 11v11 on this board',
        rosterHint: 'keep us defending that big goal, don’t flip it\ncompactness / wide deliveries',
      }
    );
    expect(locked.grid.attFormation).toBe('4-4-2');
    expect(locked.grid.defFormation).toBe('4-3-3');
  });

  test('pinks on the ends / compact inside actually moves the rondo', () => {
    const rondo = rondoDiagram();
    const beforeDef = rondo.players.filter((p) => p.team === 'DEF');
    const beforeCx = beforeDef.reduce((s, p) => s + p.x, 0) / beforeDef.length;
    const beforeCy = beforeDef.reduce((s, p) => s + p.y, 0) / beforeDef.length;
    const after = nudgeRondoCorrection(
      rondo,
      'the pinks stay on the ends as neutrals, defenders a bit more compact inside'
    );
    const neus = after.players.filter((p) => p.team === 'NEUTRAL');
    expect(neus).toHaveLength(2);
    const xs = neus.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThan(10);
    expect(Math.abs(neus[0].y - neus[1].y)).toBeLessThan(8);
    const defs = after.players.filter((p) => p.team === 'DEF');
    const cx = defs.reduce((s, p) => s + p.x, 0) / defs.length;
    const cy = defs.reduce((s, p) => s + p.y, 0) / defs.length;
    const box = rondo.areas[0];
    expect(box).toBeTruthy();
    const midX = Number(box?.x) + Number(box?.width) / 2;
    const midY = Number(box?.y) + Number(box?.height) / 2;
    expect(Math.hypot(cx - midX, cy - midY)).toBeLessThan(
      Math.hypot(beforeCx - midX, beforeCy - midY)
    );
  });

  test('pink passes on an SSG do not teleport possession shirts', () => {
    const ssg: WebDiagramV1 = {
      pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format: '11V11', showZones: false },
      players: [
        { id: 'att-4', number: 4, team: 'ATT', x: 70, y: 62 },
        { id: 'att-7', number: 7, team: 'ATT', x: 50, y: 50 },
        { id: 'def-8', number: 8, team: 'DEF', x: 22, y: 30 },
        { id: 'def-3', number: 3, team: 'DEF', x: 22, y: 70 },
      ],
      arrows: [],
      areas: [{ label: 'ssg_grid', x: 20, y: 28, width: 60, height: 44, shape: 'rect' }],
      labels: [],
      elements: [],
      balls: [],
      goals: [],
    };
    const after = nudgeRondoCorrection(
      ssg,
      'Freeze that. After two pink passes the extra blue defender steps in, then if blue wins it they finish the nearest mini-goal.'
    );
    expect(after.players.find((p) => p.id === 'att-4')?.x).toBe(70);
    expect(after.players.find((p) => p.id === 'att-4')?.y).toBe(62);
  });

  test('symbolic parse strips entity x/y instead of aborting the plan', () => {
    const parsed = parseBoardSymbolicDsl({
      activity: 'technical_exercise',
      grid: { intent: 'ssg_grid', format: '11V11' },
      entities: [
        { id: 'att-9', team: 'ATT', number: 9, relative_position: 'inside', x: 40, y: 70 },
        { id: 'def-1', team: 'DEF', number: 1, relative_position: 'own_gk', x: 50, y: 92 },
      ],
      equipment: [{ kind: 'mini-goal', placement: 'grid_e', quantity: 2, x: 80, y: 50 }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.dsl.entities).toHaveLength(2);
    expect(parsed.dsl.equipment[0]?.kind).toBe('mini-goal');
  });

  test('A A A rondo import does not invent mini-goals from the Q3 template', () => {
    const locked = lockDslForTurn(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '7V7' },
        entities: [
          { id: 'att-2', team: 'ATT', number: 2, relative_position: 'inside' },
          { id: 'att-3', team: 'ATT', number: 3, relative_position: 'inside' },
          { id: 'def-5', team: 'DEF', number: 5, relative_position: 'inside' },
          { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
          { id: 'neu-10', team: 'NEUTRAL', number: 10, relative_position: 'perimeter' },
          { id: 'neu-11', team: 'NEUTRAL', number: 11, relative_position: 'perimeter' },
        ],
        equipment: [{ kind: 'mini-goal', placement: 'grid_e', quantity: 1 }],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: true,
        importDrawEleven: false,
        fromCurrentBoard: false,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '7V7',
        current: defaultMatchBoardDiagram('7V7'),
        message: 'A A A',
        rosterHint:
          'Q3 How to draw\nA as written (area, numbers, mini-goals, floaters — do not scale to 11v11)',
      }
    );
    expect(locked.equipment.some((e) => e.kind === 'mini-goal')).toBe(false);
  });
});

describe('round-9 mixed talk defects', () => {
  test('7v3 import uniquifies a duplicate 8 into a 10', () => {
    const dsl = ensureRondoRosterFromMessage(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '9V9' },
        entities: [
          { id: 'att-2', team: 'ATT', number: 2, relative_position: 'perimeter' },
          { id: 'att-3', team: 'ATT', number: 3, relative_position: 'perimeter' },
          { id: 'att-4', team: 'ATT', number: 4, relative_position: 'perimeter' },
          { id: 'att-5', team: 'ATT', number: 5, relative_position: 'perimeter' },
          { id: 'att-6', team: 'ATT', number: 6, relative_position: 'perimeter' },
          { id: 'att-8a', team: 'ATT', number: 8, relative_position: 'perimeter' },
          { id: 'att-8b', team: 'ATT', number: 8, relative_position: 'inside' },
          { id: 'def-4', team: 'DEF', number: 4, relative_position: 'inside' },
          { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
          { id: 'def-8', team: 'DEF', number: 8, relative_position: 'inside' },
        ],
        equipment: [],
        actions: [],
        moves: [],
      },
      '7v3 rondo in a 20x20 with 4 central mini-goals'
    );
    const attNums = dsl.entities.filter((e) => e.team === 'ATT').map((e) => e.number);
    expect(attNums.filter((n) => n === 8)).toHaveLength(1);
    expect(attNums).toContain(10);
  });

  test('four central mini-goals cluster in the box, not the four sides', () => {
    const dsl = ensureDslEquipmentFromMessage(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '9V9' },
        entities: [],
        equipment: [],
        actions: [],
        moves: [],
      },
      '7v3 rondo in a 20x20 with 4 central mini-goals back-to-back'
    );
    expect(dsl.equipment.filter((e) => e.kind === 'mini-goal')).toHaveLength(4);
    expect(dsl.equipment.every((e) => e.placement === 'grid_c')).toBe(true);
    const after = solveBoardLayout(dsl);
    const minis = (after.elements || []).filter((e) => e.kind === 'mini-goal');
    expect(minis).toHaveLength(4);
    const ys = minis.map((e) => e.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(20);
  });

  test('rondo neutrals sit on the short ends of the box', () => {
    const after = solveBoardLayout({
      activity: 'rondo',
      seed: 'blank',
      grid: { intent: 'rondo', format: '7V7' },
      entities: [
        { id: 'att-2', team: 'ATT', number: 2, relative_position: 'perimeter' },
        { id: 'att-3', team: 'ATT', number: 3, relative_position: 'perimeter' },
        { id: 'def-5', team: 'DEF', number: 5, relative_position: 'inside' },
        { id: 'def-6', team: 'DEF', number: 6, relative_position: 'inside' },
        { id: 'neu-10', team: 'NEUTRAL', number: 10, relative_position: 'perimeter' },
        { id: 'neu-11', team: 'NEUTRAL', number: 11, relative_position: 'perimeter' },
      ],
      equipment: [],
      actions: [],
      moves: [],
    });
    const neus = after.players.filter((p) => p.team === 'NEUTRAL');
    expect(neus).toHaveLength(2);
    const xs = neus.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThan(10);
    expect(Math.abs(neus[0].y - neus[1].y)).toBeLessThan(8);
  });

  test('high press after a rondo strips leftover mini-goals', () => {
    const rondo = rondoDiagram();
    const locked = lockDslForTurn(
      {
        activity: 'rondo',
        seed: 'blank',
        grid: { intent: 'rondo', format: '9V9' },
        entities: [],
        equipment: [
          { kind: 'mini-goal', placement: 'grid_n', quantity: 1 },
          { kind: 'mini-goal', placement: 'grid_e', quantity: 1 },
          { kind: 'mini-goal', placement: 'grid_s', quantity: 1 },
          { kind: 'mini-goal', placement: 'grid_w', quantity: 1 },
        ],
        actions: [],
        moves: [],
      },
      {
        freeze: false,
        hasImage: false,
        importDrawEleven: false,
        fromCurrentBoard: true,
        keepPriorFrame: false,
        reshape: false,
        currentFormat: '9V9',
        current: rondo,
        message: 'Forget that — high press in their third, keep the shirts, us 3-2-3.',
        rosterHint: 'What I saw: 7v3 rondo in a 20x20 with 4 central mini-goals back-to-back.',
      }
    );
    expect(locked.activity).toBe('match_scenario');
    expect(locked.equipment.filter((e) => e.kind === 'mini-goal')).toEqual([]);
    const after = solveBoardLayout(locked, rondo);
    expect((after.elements || []).filter((e) => e.kind === 'mini-goal')).toEqual([]);
    expect(after.players.length).toBeGreaterThanOrEqual(18);
  });

  test('forget-the-rondo filmstrip does not keep the 10-shirt start', () => {
    const rondo = rondoDiagram();
    const match = defaultMatchBoardDiagram('9V9');
    const sequenced = ensureSequenceStartsFromOriginal(
      match,
      rondo,
      'Forget that — high press in their third, keep the shirts, us 3-2-3.'
    );
    expect(sequenced.sequence?.frames[0].players.length).toBe(18);
    expect(sequenced.sequence?.frames[1].players.length).toBe(18);
  });

  test('freeze that on a 10-shirt rondo creates Frame 2', () => {
    const rondo = rondoDiagram();
    const next = {
      ...rondo,
      arrows: [
        {
          from: { playerId: rondo.players[0].id },
          to: { playerId: rondo.players[1].id },
          type: 'pass' as const,
          style: 'solid' as const,
          weight: 'normal' as const,
        },
      ],
    };
    const sequenced = ensureSequenceStartsFromOriginal(
      next,
      rondo,
      'Freeze that. When we win it, finish the nearest mini-goal — don’t restack.'
    );
    expect(sequenced.sequence?.frames.length).toBe(2);
    expect(sequenced.sequence?.frames[0].players.length).toBe(10);
    expect(sequenced.sequence?.frames[1].arrows.length).toBeGreaterThan(0);
  });

  test('mid-block not a high press is the middle third', () => {
    expect(
      inferGridIntentFromMessage('No wait, I wanted a mid block not a high press. Compact in the middle.')
    ).toBe('third_middle');
  });

  test('7v7 copy does not call the picture 11v11, and bounce-into-8 names the live CM', () => {
    const seven = defaultMatchBoardDiagram('7V7');
    const reply = scrubCoachReply(
      'What I saw: 11v11 play out. Bounce has to go into ATT #8, not back to the GK. ATT #8 receives on the half-turn.',
      seven
    );
    expect(reply).toMatch(/7v7/i);
    expect(reply).not.toMatch(/11\s*v\s*11/i);
    const attNums = new Set(seven.players.filter((p) => p.team === 'ATT').map((p) => p.number));
    expect(attNums.has(8)).toBe(false);
    expect(reply).not.toMatch(/ATT #8|into the 8|CM #8/);
    expect(reply).toMatch(/into #6|#6 receives/);
  });

  test('7v7 forget-the-rondo filmstrip does not keep the 6-shirt start', () => {
    const six = rondoDiagram().players.slice(0, 6);
    const rondo: WebDiagramV1 = {
      ...rondoDiagram(),
      pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format: '7V7', showZones: false },
      players: six,
      sequence: {
        frames: [
          {
            id: 'f-start',
            title: '1. Start (board)',
            durationMs: 1600,
            note: 'Frozen board — keep this picture as Frame 1 for later teaching sequences.',
            players: six,
            arrows: [],
            areas: [],
            labels: [],
          },
        ],
        activeFrameId: 'f-start',
      },
    };
    expect(looksLikeFunctionPractice(rondo)).toBe(true);
    const match = defaultMatchBoardDiagram('7V7');
    expect(looksLikeFunctionPractice(match)).toBe(false);
    const sequenced = ensureSequenceStartsFromOriginal(
      match,
      rondo,
      'Ok forget the rondo — play out 2-3-1 vs 3-2-1 that jumps the 6.'
    );
    expect(sequenced.sequence?.frames[0].players.length).toBe(14);
    expect(sequenced.sequence?.frames[1].players.length).toBe(14);
  });

  test('inner 10x10 with four side mini-goals is not a central cluster', () => {
    const dsl = ensureDslEquipmentFromMessage(
      {
        activity: 'technical_exercise',
        seed: 'blank',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: [],
        equipment: [],
        actions: [],
        moves: [],
      },
      '20x20 increasing pressure, four mini-goals one on each side, inner 10x10 central zone'
    );
    const placements = dsl.equipment.filter((e) => e.kind === 'mini-goal').map((e) => e.placement);
    expect(placements.sort()).toEqual(['grid_e', 'grid_n', 'grid_s', 'grid_w']);
  });

  test('freeze seed current keeps live mini-goal seats', () => {
    const current = solveBoardLayout({
      activity: 'technical_exercise',
      seed: 'blank',
      grid: { intent: 'ssg_grid', format: '11V11' },
      entities: [
        { id: 'att-6', team: 'ATT', number: 6, relative_position: 'inside' },
        { id: 'def-4', team: 'DEF', number: 4, relative_position: 'inside' },
      ],
      equipment: [
        { kind: 'mini-goal', placement: 'grid_n', quantity: 1 },
        { kind: 'mini-goal', placement: 'grid_e', quantity: 1 },
        { kind: 'mini-goal', placement: 'grid_s', quantity: 1 },
        { kind: 'mini-goal', placement: 'grid_w', quantity: 1 },
      ],
      actions: [],
      moves: [],
    });
    const side = (current.elements || [])
      .filter((e) => e.kind === 'mini-goal')
      .map((e) => `${Math.round(e.x)}:${Math.round(e.y)}`)
      .sort();
    const after = solveBoardLayout(
      {
        activity: 'technical_exercise',
        seed: 'current',
        grid: { intent: 'ssg_grid', format: '11V11' },
        entities: [],
        equipment: [
          { kind: 'mini-goal', placement: 'grid_c', quantity: 1 },
          { kind: 'mini-goal', placement: 'grid_c', quantity: 1 },
          { kind: 'mini-goal', placement: 'grid_c', quantity: 1 },
          { kind: 'mini-goal', placement: 'grid_c', quantity: 1 },
        ],
        actions: [],
        moves: [],
      },
      current
    );
    const kept = (after.elements || [])
      .filter((e) => e.kind === 'mini-goal')
      .map((e) => `${Math.round(e.x)}:${Math.round(e.y)}`)
      .sort();
    expect(kept).toEqual(side);
  });

  test('match high press does not paint a third box', () => {
    const after = solveBoardLayout({
      activity: 'match_scenario',
      seed: 'formation',
      grid: { intent: 'third_left', format: '11V11', attFormation: '4-3-3', defFormation: '4-4-2' },
      entities: [],
      equipment: [],
      actions: [],
      moves: [],
    });
    expect(after.areas).toEqual([]);
  });

  test('mid-block copy does not say our defensive while us is ATT', () => {
    const nine = defaultMatchBoardDiagram('9V9');
    const reply = scrubCoachReply(
      'Dropped into a mid-block. Compact in our defensive block in the middle third.',
      nine
    );
    expect(reply).not.toMatch(/our defensive block/i);
    expect(reply).toMatch(/our mid-block/);
  });

  test('5v5 review copy does not invent a GK waiting outside', () => {
    const reply = scrubImportOrganisation(
      'Organisation: 5v5. 10 numbered players plus a goalkeeper. GK waiting outside, defenders waiting outside.'
    );
    expect(reply).not.toMatch(/goalkeeper|GK waiting|defenders waiting/i);
    expect(reply).toMatch(/5v5/);
  });
});

