import { describe, expect, it } from 'vitest';
import { deserializeGame, serializeGame } from '../src/app/persist';
import { bidLabel, bidLongLabel, ordinal } from '../src/app/format';
import { createGame, getScores, recordHand } from '../src/lib/game';
import { getBid, MISERE } from '../src/lib/bids';

const TEAMS = [{ players: ['A', 'B'] }, { players: ['C', 'D'] }] as const;

describe('persist', () => {
  it('round-trips a game through serialize/deserialize', () => {
    let g = createGame([{ players: [...TEAMS[0].players] }, { players: [...TEAMS[1].players] }]);
    g = recordHand(g, { bid: '7H', bidder: 0, tricks: [8, 2] });
    g = recordHand(g, { bid: 'MIS', bidder: 1, tricks: [10, 0] });
    const back = deserializeGame(serializeGame(g));
    expect(back).not.toBeNull();
    expect(back!.teams).toEqual(g.teams);
    expect(getScores(back!)).toEqual(getScores(g));
    expect(back!.hands.length).toBe(2);
  });

  it('returns null for missing or corrupt data', () => {
    expect(deserializeGame(null)).toBeNull();
    expect(deserializeGame('not json')).toBeNull();
    expect(deserializeGame('{"v":2}')).toBeNull();
    expect(deserializeGame('{"v":1,"teams":[],"hands":[]}')).toBeNull();
    expect(
      deserializeGame('{"v":1,"teams":[{"players":["a","b"]},{"players":["c","d"]}],"hands":[{"bid":"7H","bidder":0,"tricks":[11,-1]}]}'),
    ).toBeNull();
  });
});

describe('format', () => {
  it('labels bids, including misère correctly', () => {
    expect(bidLabel(getBid('7H'))).toBe('7♥');
    expect(bidLabel(getBid('10NT'))).toBe('10NT');
    expect(bidLabel(MISERE)).toBe('Misère');
    expect(bidLongLabel(MISERE)).toBe('Misère');
    expect(bidLongLabel(getBid('6S'))).toBe('6 Spades');
  });
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st',
    ]);
  });
});
