// 500 scorer domain types. The rewrite supports 4-player (2 teams of 2) only.

export type Suit = 'spades' | 'clubs' | 'diamonds' | 'hearts' | 'no-trumps';

export interface Team {
  players: [string, string];
  score: number;
}

export type Teams = [Team, Team];

export interface Bid {
  tricks: 6 | 7 | 8 | 9 | 10;
  suit: Suit;
  value: number;
}
