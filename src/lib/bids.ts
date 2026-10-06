import type { Bid, Suit } from './types';

const SUITS: Suit[] = ['spades', 'clubs', 'diamonds', 'hearts', 'no-trumps'];
const TRICKS = [6, 7, 8, 9, 10] as const;

/** Standard (Avondale) bid table: 6♠ = 40, +20 per suit step, +100 per trick. */
export const BIDS: Bid[] = TRICKS.flatMap((tricks, t) =>
  SUITS.map((suit, s) => ({ tricks, suit, value: 40 + t * 100 + s * 20 })),
);
