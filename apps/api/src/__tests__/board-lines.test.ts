import {
  arrowFollowsPlayer,
  createLineArrow,
  eraseArrowAtIndex,
  findArrowIndexNearPoint,
  resolveEndpoint,
  type LineArrow,
  type LinePlayer,
} from '../services/board-lines';

const players: LinePlayer[] = [
  { id: 'a1', x: 40, y: 50 },
  { id: 'a2', x: 55, y: 40 },
  { id: 'd1', x: 30, y: 30 },
];

describe('board-lines (sticky pass + erase)', () => {
  test('linked pass sticks when player moves', () => {
    const arrow = createLineArrow({
      fromPlayerId: 'a1',
      toPlayerId: 'a2',
      fromX: 40,
      fromY: 50,
      toX: 55,
      toY: 40,
      type: 'pass',
      style: 'solid',
      weight: 'normal',
    })!;
    expect(arrow.from).toEqual({ playerId: 'a1' });
    expect(arrow.to).toEqual({ playerId: 'a2' });
    expect(arrowFollowsPlayer(arrow, 'a2')).toBe(true);

    const moved: LinePlayer[] = [
      players[0],
      { id: 'a2', x: 72, y: 22 },
      players[2],
    ];
    expect(resolveEndpoint(arrow.to, moved)).toEqual({ x: 72, y: 22 });
  });

  test('free landing anywhere (no player link)', () => {
    const arrow = createLineArrow({
      fromPlayerId: 'a1',
      toPlayerId: null,
      fromX: 40,
      fromY: 50,
      toX: 18,
      toY: 12,
      type: 'run',
      style: 'dashed',
      weight: 'normal',
    })!;
    expect(arrow.to).toEqual({ x: 18, y: 12 });
    expect(resolveEndpoint(arrow.to, players)).toEqual({ x: 18, y: 12 });
  });

  test('free-to-free line', () => {
    const arrow = createLineArrow({
      fromX: 10,
      fromY: 10,
      toX: 80,
      toY: 60,
      type: 'transition',
      style: 'solid',
      weight: 'normal',
    })!;
    expect(arrow.from).toEqual({ x: 10, y: 10 });
    expect(arrow.to).toEqual({ x: 80, y: 60 });
  });

  test('erase individual line', () => {
    const arrows: LineArrow[] = [
      createLineArrow({
        fromPlayerId: 'a1',
        toPlayerId: 'a2',
        fromX: 40,
        fromY: 50,
        toX: 55,
        toY: 40,
        type: 'pass',
        style: 'solid',
        weight: 'normal',
      })!,
      createLineArrow({
        fromX: 10,
        fromY: 10,
        toX: 20,
        toY: 20,
        type: 'transition',
        style: 'solid',
        weight: 'normal',
      })!,
    ];
    const idx = findArrowIndexNearPoint(arrows, players, 47.5, 45, 5);
    expect(idx).toBe(0);
    const next = eraseArrowAtIndex(arrows, idx);
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe('transition');
  });
});
