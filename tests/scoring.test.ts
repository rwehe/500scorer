import { describe, expect, it } from 'vitest';
import { getBid } from '../src/lib/bids';
import { otherTeam, scoreHand, validateTricks } from '../src/lib/scoring';
import type { Pair, TeamIndex } from '../src/lib/types';

const score = (id: string, bidder: TeamIndex, tricks: Pair<number>) => scoreHand(getBid(id), bidder, tricks);

describe('suit bids', () => {
  it('bidder making exactly scores the bid value; opponents +10/trick', () => {
    expect(score('7H', 0, [7, 3])).toEqual({ made: true, slam: false, deltas: [200, 30] });
  });

  it('overtricks do not add to the bidder score', () => {
    expect(score('6S', 0, [9, 1]).deltas).toEqual([40, 10]);
  });

  it('bidder missing loses the bid value; opponents still +10/trick', () => {
    expect(score('8NT', 0, [7, 3])).toEqual({ made: false, slam: false, deltas: [-320, 30] });
  });

  it('works for team 1 as bidder', () => {
    expect(score('9D', 1, [2, 8]).deltas).toEqual([20, -380]);
    expect(score('6C', 1, [4, 6]).deltas).toEqual([40, 60]);
  });

  it('opponents taking no tricks score 0', () => {
    expect(score('10NT', 0, [10, 0]).deltas).toEqual([520, 0]);
  });

  it('bidder taking 0 tricks on a suit bid loses and opponents get 100', () => {
    expect(score('6S', 0, [0, 10]).deltas).toEqual([-40, 100]);
  });
});

describe('slam (all 10 tricks)', () => {
  it.each([
    ['6S', 250],
    ['7NT', 250],
    ['8S', 250], // 240 < 250
    ['8C', 260], // already ≥ 250: no change
    ['9H', 400],
    ['10S', 440],
    ['10H', 500],
  ])('10 tricks on %s scores %i', (id, expected) => {
    const r = score(id, 0, [10, 0]);
    expect(r.made).toBe(true);
    expect(r.deltas[0]).toBe(expected);
    expect(r.slam).toBe(expected === 250 && getBid(id).value < 250);
  });

  it('9 tricks on a low bid is not a slam', () => {
    expect(score('6S', 0, [9, 1])).toEqual({ made: true, slam: false, deltas: [40, 10] });
  });
});

describe('misère', () => {
  it('bidder taking no tricks scores +250; opponents score 0', () => {
    expect(score('MIS', 0, [0, 10])).toEqual({ made: true, slam: false, deltas: [250, 0] });
  });

  it('bidder taking any trick scores −250; opponents score 0', () => {
    expect(score('MIS', 1, [9, 1])).toEqual({ made: false, slam: false, deltas: [0, -250] });
    expect(score('MIS', 0, [10, 0]).deltas).toEqual([-250, 0]);
  });
});

describe('validation', () => {
  it.each<[string, Pair<number>]>([
    ['sum below 10', [5, 4]],
    ['sum above 10', [6, 5]],
    ['negative', [-1, 11]],
    ['over 10', [11, -1]],
    ['fractional', [6.5, 3.5]],
    ['NaN', [Number.NaN, 10]],
  ])('rejects tricks: %s', (_, tricks) => {
    expect(() => validateTricks(tricks)).toThrow(RangeError);
    expect(() => score('6S', 0, tricks)).toThrow(RangeError);
  });

  it('rejects an invalid bidder team', () => {
    expect(() => scoreHand(getBid('6S'), 2 as TeamIndex, [6, 4])).toThrow(RangeError);
  });

  it('otherTeam flips 0 and 1', () => {
    expect(otherTeam(0)).toBe(1);
    expect(otherTeam(1)).toBe(0);
  });
});
