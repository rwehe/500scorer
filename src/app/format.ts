import type { Bid, Suit, Team } from '../lib/types';

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  'no-trumps': 'NT',
};

export const SUIT_NAME: Record<Suit, string> = {
  spades: 'Spades',
  clubs: 'Clubs',
  diamonds: 'Diamonds',
  hearts: 'Hearts',
  'no-trumps': 'No Trumps',
};

export const isRedSuit = (s: Suit) => s === 'hearts' || s === 'diamonds';

/** Short label: `7♥`, `10NT`, `Misère`. */
export function bidLabel(bid: Bid): string {
  return bid.kind === 'misere' ? 'Misère' : `${bid.tricks}${SUIT_SYMBOL[bid.suit]}`;
}

/** Long label: `7 Hearts`, `10 No Trumps`, `Misère`. */
export function bidLongLabel(bid: Bid): string {
  return bid.kind === 'misere' ? 'Misère' : `${bid.tricks} ${SUIT_NAME[bid.suit]}`;
}

export function teamName(team: Team): string {
  return `${team.players[0]} & ${team.players[1]}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
