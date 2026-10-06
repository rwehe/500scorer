// 500 scorer domain types. The rewrite supports 4-player (2 teams of 2) only.

export type Suit = 'spades' | 'clubs' | 'diamonds' | 'hearts' | 'no-trumps';

/** Number of tricks a suit bid contracts to take. */
export type TrickCount = 6 | 7 | 8 | 9 | 10;

/** Index of a team within a game: 0 or 1. */
export type TeamIndex = 0 | 1;

/** A value per team, indexed by {@link TeamIndex}. */
export type Pair<T> = [T, T];

/** Stable bid identifier, e.g. `6S`, `7NT`, `10H`, `MIS`. */
export type BidId = string;

export interface SuitBid {
  kind: 'suit';
  id: BidId;
  tricks: TrickCount;
  suit: Suit;
  value: number;
}

/** Closed misère: bidder must take no tricks. (No open misère in this ruleset.) */
export interface MisereBid {
  kind: 'misere';
  id: 'MIS';
  value: 250;
}

export type Bid = SuitBid | MisereBid;

export interface Team {
  players: [string, string];
}

export type Teams = Pair<Team>;
