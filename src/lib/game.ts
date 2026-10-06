import { getBid } from './bids';
import { assertTeamIndex, scoreHand } from './scoring';
import type { Bid, BidId, Pair, TeamIndex, Teams } from './types';

/** Reaching this on a bid you made wins the game. */
export const WINNING_SCORE = 500;
/** Falling to or below this ends the game; the highest score then wins. */
export const LOSING_SCORE = -500;

/** What the players enter for a hand. */
export interface HandInput {
  /** The winning bid, as a bid object or bid id (e.g. `7H`, `MIS`). */
  bid: Bid | BidId;
  /** Team that won the auction. */
  bidder: TeamIndex;
  /** Tricks taken by each team; must sum to 10. */
  tricks: Pair<number>;
}

/** A recorded hand with its scoring result. */
export interface HandRecord {
  /** 1-based round number. */
  round: number;
  bid: Bid;
  bidder: TeamIndex;
  tricks: Pair<number>;
  made: boolean;
  slam: boolean;
  deltas: Pair<number>;
  startingScores: Pair<number>;
  finalScores: Pair<number>;
}

export interface Game {
  teams: Teams;
  hands: readonly HandRecord[];
}

export type GameOutcome =
  | { status: 'in-progress' }
  | {
      status: 'won';
      winner: TeamIndex;
      /** `reached-500`: winner made a bid taking them to ≥ 500. `minus-500`: a team fell to ≤ −500 and the winner had the higher score. */
      reason: 'reached-500' | 'minus-500';
      finalScores: Pair<number>;
    }
  | { status: 'draw'; reason: 'minus-500'; finalScores: Pair<number> };

function resolveBid(bid: Bid | BidId): Bid {
  const id = typeof bid === 'string' ? bid : bid?.id;
  const canonical = getBid(id);
  if (typeof bid !== 'string' && bid.value !== canonical.value) {
    throw new RangeError(`Bid ${id} must be worth ${canonical.value}, got ${bid.value}`);
  }
  return canonical;
}

/** Start a new 4-player game (2 teams of 2) with both scores at 0. */
export function createGame(teams: Teams): Game {
  if (!Array.isArray(teams) || teams.length !== 2 || teams.some((t) => t?.players?.length !== 2)) {
    throw new RangeError('A game needs exactly 2 teams of 2 players');
  }
  return {
    teams: [{ players: [...teams[0].players] }, { players: [...teams[1].players] }],
    hands: [],
  };
}

/** Current scores: the final scores of the last recorded hand, or [0, 0]. */
export function getScores(game: Game): Pair<number> {
  const last = game.hands.at(-1);
  return last ? [...last.finalScores] : [0, 0];
}

/** 1-based number of the hand about to be played. */
export function currentRound(game: Game): number {
  return game.hands.length + 1;
}

/** Determine whether the game ended on this hand. */
export function evaluateOutcome(
  hand: Pick<HandRecord, 'bidder' | 'made' | 'finalScores'>,
): GameOutcome {
  const finalScores: Pair<number> = [...hand.finalScores];
  // Only the bidding team can win by reaching 500, and only on a bid it made.
  if (hand.made && finalScores[hand.bidder] >= WINNING_SCORE) {
    return { status: 'won', winner: hand.bidder, reason: 'reached-500', finalScores };
  }
  if (finalScores.some((s) => s <= LOSING_SCORE)) {
    if (finalScores[0] === finalScores[1]) return { status: 'draw', reason: 'minus-500', finalScores };
    return { status: 'won', winner: finalScores[0] > finalScores[1] ? 0 : 1, reason: 'minus-500', finalScores };
  }
  return { status: 'in-progress' };
}

/** Outcome of the game so far (determined by the most recent hand). */
export function getOutcome(game: Game): GameOutcome {
  const last = game.hands.at(-1);
  return last ? evaluateOutcome(last) : { status: 'in-progress' };
}

export function isGameOver(game: Game): boolean {
  return getOutcome(game).status !== 'in-progress';
}

/** Record a hand and return the new game. Throws on invalid input or if the game is already over. */
export function recordHand(game: Game, input: HandInput): Game {
  if (isGameOver(game)) throw new Error('Game is over; undo or start a new game');
  assertTeamIndex(input.bidder);
  const bid = resolveBid(input.bid);
  const tricks: Pair<number> = [input.tricks[0], input.tricks[1]];
  const { made, slam, deltas } = scoreHand(bid, input.bidder, tricks);
  const startingScores = getScores(game);
  const hand: HandRecord = {
    round: currentRound(game),
    bid,
    bidder: input.bidder,
    tricks,
    made,
    slam,
    deltas,
    startingScores,
    finalScores: [startingScores[0] + deltas[0], startingScores[1] + deltas[1]],
  };
  return { ...game, hands: [...game.hands, hand] };
}

/**
 * Rewind so that hand `handIndex` (0-based) is replayed next: hands from `handIndex` onward are
 * discarded and scores revert to that hand's starting scores. Mirrors legacy `goToHand`.
 */
export function goToHand(game: Game, handIndex: number): Game {
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= game.hands.length) {
    throw new RangeError(`No hand at index ${handIndex} (game has ${game.hands.length} hands)`);
  }
  return { ...game, hands: game.hands.slice(0, handIndex) };
}

/** Remove the most recent hand (legacy `goBack1Hand`). No-op when no hands have been played. */
export function undo(game: Game): Game {
  return game.hands.length === 0 ? game : goToHand(game, game.hands.length - 1);
}

/** Rebuild a game from hand inputs (e.g. restoring saved state); re-validates and re-scores everything. */
export function replay(teams: Teams, inputs: readonly HandInput[]): Game {
  return inputs.reduce(recordHand, createGame(teams));
}
