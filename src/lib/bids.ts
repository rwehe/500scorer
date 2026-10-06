import type { Bid, BidId, MisereBid, Suit, SuitBid, TrickCount } from './types';

export const SUITS: readonly Suit[] = ['spades', 'clubs', 'diamonds', 'hearts', 'no-trumps'];
export const TRICK_COUNTS: readonly TrickCount[] = [6, 7, 8, 9, 10];

const SUIT_CODES: Record<Suit, string> = {
  spades: 'S',
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  'no-trumps': 'NT',
};

/** Value of a suit bid: 6♠ = 40, +20 per suit step (♠ ♣ ♦ ♥ NT), +100 per trick. */
export function suitBidValue(tricks: TrickCount, suit: Suit): number {
  return 40 + (tricks - 6) * 100 + SUITS.indexOf(suit) * 20;
}

export const SUIT_BIDS: readonly SuitBid[] = TRICK_COUNTS.flatMap((tricks) =>
  SUITS.map(
    (suit): SuitBid => ({
      kind: 'suit',
      id: `${tricks}${SUIT_CODES[suit]}`,
      tricks,
      suit,
      value: suitBidValue(tricks, suit),
    }),
  ),
);

/** Closed misère, worth 250. Open misère and inkle bids are not supported. */
export const MISERE: MisereBid = { kind: 'misere', id: 'MIS', value: 250 };

/** Every legal bid, ordered by value-table position (6♠ … 10NT, then misère) as in the legacy app. */
export const BIDS: readonly Bid[] = [...SUIT_BIDS, MISERE];

const BY_ID = new Map<BidId, Bid>(BIDS.map((b) => [b.id, b]));

/** Look up a bid by id (e.g. `7H`, `10NT`, `MIS`). Returns undefined for unknown ids. */
export function findBid(id: BidId): Bid | undefined {
  return BY_ID.get(id);
}

/** Look up a bid by id, throwing for unknown ids. */
export function getBid(id: BidId): Bid {
  const bid = findBid(id);
  if (!bid) throw new RangeError(`Unknown bid: ${id}`);
  return bid;
}
