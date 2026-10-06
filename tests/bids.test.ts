import { describe, expect, it } from 'vitest';
import { BIDS, MISERE, SUIT_BIDS, findBid, getBid, suitBidValue } from '../src/lib/bids';

// Legacy table from v1 js/main.js returnNewData().bids
const LEGACY_TABLE: [string, number][] = [
  ['6S', 40], ['6C', 60], ['6D', 80], ['6H', 100], ['6NT', 120],
  ['7S', 140], ['7C', 160], ['7D', 180], ['7H', 200], ['7NT', 220],
  ['8S', 240], ['8C', 260], ['8D', 280], ['8H', 300], ['8NT', 320],
  ['9S', 340], ['9C', 360], ['9D', 380], ['9H', 400], ['9NT', 420],
  ['10S', 440], ['10C', 460], ['10D', 480], ['10H', 500], ['10NT', 520],
  ['MIS', 250],
];

describe('bid table', () => {
  it('has 25 suit bids plus misère, in legacy order', () => {
    expect(BIDS).toHaveLength(26);
    expect(SUIT_BIDS).toHaveLength(25);
    expect(BIDS.map((b) => [b.id, b.value])).toEqual(LEGACY_TABLE);
  });

  it.each(LEGACY_TABLE)('%s is worth %i', (id, value) => {
    expect(getBid(id).value).toBe(value);
  });

  it('steps +20 per suit and +100 per trick', () => {
    expect(suitBidValue(6, 'spades')).toBe(40);
    expect(suitBidValue(6, 'clubs') - suitBidValue(6, 'spades')).toBe(20);
    expect(suitBidValue(7, 'spades') - suitBidValue(6, 'spades')).toBe(100);
    expect(suitBidValue(10, 'no-trumps')).toBe(520);
  });

  it('suit bids carry trick count and suit', () => {
    expect(getBid('7H')).toEqual({ kind: 'suit', id: '7H', tricks: 7, suit: 'hearts', value: 200 });
    expect(getBid('10NT')).toMatchObject({ tricks: 10, suit: 'no-trumps' });
  });

  it('misère is closed misère worth 250', () => {
    expect(MISERE).toEqual({ kind: 'misere', id: 'MIS', value: 250 });
    expect(getBid('MIS')).toBe(MISERE);
  });

  it('has unique ids', () => {
    expect(new Set(BIDS.map((b) => b.id)).size).toBe(BIDS.length);
  });

  it('does not offer open misère or inkle bids', () => {
    expect(BIDS.filter((b) => b.kind === 'misere')).toHaveLength(1);
    expect(BIDS.some((b) => b.kind === 'suit' && b.tricks < 6)).toBe(false);
    expect(findBid('OM')).toBeUndefined();
    expect(findBid('5S')).toBeUndefined();
  });

  it('getBid throws for unknown ids', () => {
    expect(() => getBid('11S')).toThrow(RangeError);
  });
});
