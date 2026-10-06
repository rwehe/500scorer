import type { Bid, Pair, TeamIndex } from './types';

/** Total tricks in a 4-player hand (10 cards each, 3-card kitty). */
export const TRICKS_PER_HAND = 10;
/** A made bid worth less than this that takes all 10 tricks scores this instead (slam). */
export const SLAM_VALUE = 250;
/** Points the non-bidding team earns per trick on a suit bid. */
export const OPPONENT_POINTS_PER_TRICK = 10;

export interface HandScore {
  /** Whether the bidding team made its contract. */
  made: boolean;
  /** True when the slam rule upgraded the bid value to {@link SLAM_VALUE}. */
  slam: boolean;
  /** Points added to each team's score this hand (negative when the bidder goes set). */
  deltas: Pair<number>;
}

export function otherTeam(team: TeamIndex): TeamIndex {
  return team === 0 ? 1 : 0;
}

export function assertTeamIndex(team: unknown): asserts team is TeamIndex {
  if (team !== 0 && team !== 1) throw new RangeError(`Team index must be 0 or 1, got ${String(team)}`);
}

/** Throws unless both counts are integers in 0..10 summing to exactly 10. */
export function validateTricks(tricks: Pair<number>): void {
  if (!Array.isArray(tricks) || tricks.length !== 2) {
    throw new RangeError('Tricks must be a pair of numbers, one per team');
  }
  for (const t of tricks) {
    if (!Number.isInteger(t) || t < 0 || t > TRICKS_PER_HAND) {
      throw new RangeError(`Trick counts must be whole numbers from 0 to ${TRICKS_PER_HAND}, got ${t}`);
    }
  }
  if (tricks[0] + tricks[1] !== TRICKS_PER_HAND) {
    throw new RangeError(`Tricks must add up to ${TRICKS_PER_HAND}, got ${tricks[0] + tricks[1]}`);
  }
}

/**
 * Score a single hand.
 *
 * - Suit bid made: bidder +bid value (or {@link SLAM_VALUE} when all 10 tricks are taken on a bid worth < 250).
 * - Suit bid missed: bidder −bid value.
 * - Suit bid, either outcome: opponents +10 per trick they took.
 * - Misère: bidder +250 when they take no tricks, otherwise −250; opponents score nothing.
 */
export function scoreHand(bid: Bid, bidder: TeamIndex, tricks: Pair<number>): HandScore {
  assertTeamIndex(bidder);
  validateTricks(tricks);
  const opponent = otherTeam(bidder);
  const deltas: Pair<number> = [0, 0];

  if (bid.kind === 'misere') {
    const made = tricks[bidder] === 0;
    deltas[bidder] = made ? bid.value : -bid.value;
    return { made, slam: false, deltas };
  }

  const bidderTricks = tricks[bidder];
  const made = bidderTricks >= bid.tricks;
  const slam = made && bidderTricks === TRICKS_PER_HAND && bid.value < SLAM_VALUE;
  deltas[bidder] = made ? (slam ? SLAM_VALUE : bid.value) : -bid.value;
  deltas[opponent] = tricks[opponent] * OPPONENT_POINTS_PER_TRICK;
  return { made, slam, deltas };
}
