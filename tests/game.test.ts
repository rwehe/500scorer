import { describe, expect, it } from 'vitest';
import { getBid } from '../src/lib/bids';
import {
  createGame,
  currentRound,
  evaluateOutcome,
  getOutcome,
  getScores,
  goToHand,
  isGameOver,
  recordHand,
  replay,
  undo,
  type Game,
  type HandInput,
} from '../src/lib/game';
import type { Teams } from '../src/lib/types';

const TEAMS: Teams = [{ players: ['James', 'Harper'] }, { players: ['Will', 'Catie'] }];

const play = (game: Game, ...hands: HandInput[]) => hands.reduce(recordHand, game);
const fresh = () => createGame(TEAMS);

describe('createGame', () => {
  it('starts at 0–0, round 1, in progress', () => {
    const g = fresh();
    expect(getScores(g)).toEqual([0, 0]);
    expect(currentRound(g)).toBe(1);
    expect(g.hands).toEqual([]);
    expect(getOutcome(g)).toEqual({ status: 'in-progress' });
  });

  it('copies team names (no shared references)', () => {
    const teams: Teams = [{ players: ['A', 'B'] }, { players: ['C', 'D'] }];
    const g = createGame(teams);
    teams[0].players[0] = 'Z';
    expect(g.teams[0].players[0]).toBe('A');
  });

  it('requires exactly 2 teams of 2', () => {
    expect(() => createGame([{ players: ['A', 'B'] }] as unknown as Teams)).toThrow(RangeError);
    expect(() => createGame([{ players: ['A'] }, { players: ['C', 'D'] }] as unknown as Teams)).toThrow(RangeError);
  });
});

describe('recordHand', () => {
  it('records a hand with starting/final scores and round number', () => {
    const g = play(fresh(), { bid: '7H', bidder: 0, tricks: [8, 2] });
    expect(g.hands).toHaveLength(1);
    expect(g.hands[0]).toEqual({
      round: 1,
      bid: getBid('7H'),
      bidder: 0,
      tricks: [8, 2],
      made: true,
      slam: false,
      deltas: [200, 20],
      startingScores: [0, 0],
      finalScores: [200, 20],
    });
    expect(getScores(g)).toEqual([200, 20]);
    expect(currentRound(g)).toBe(2);
  });

  it('accumulates scores across hands', () => {
    const g = play(
      fresh(),
      { bid: '7H', bidder: 0, tricks: [8, 2] }, // +200 / +20
      { bid: '8S', bidder: 1, tricks: [3, 7] }, // +30 / −240
      { bid: 'MIS', bidder: 0, tricks: [0, 10] }, // +250 / 0
    );
    expect(g.hands.map((h) => h.startingScores)).toEqual([[0, 0], [200, 20], [230, -220]]);
    expect(getScores(g)).toEqual([480, -220]);
    expect(g.hands.map((h) => h.round)).toEqual([1, 2, 3]);
  });

  it('accepts a bid object as well as an id', () => {
    const g = play(fresh(), { bid: getBid('6NT'), bidder: 1, tricks: [4, 6] });
    expect(getScores(g)).toEqual([40, 120]);
  });

  it('rejects unknown bids, forged bid values, bad bidders and bad tricks', () => {
    const g = fresh();
    expect(() => recordHand(g, { bid: 'OM', bidder: 0, tricks: [0, 10] })).toThrow(RangeError);
    expect(() =>
      recordHand(g, { bid: { ...getBid('6S'), value: 999 } as never, bidder: 0, tricks: [6, 4] }),
    ).toThrow(RangeError);
    expect(() => recordHand(g, { bid: '6S', bidder: 3 as never, tricks: [6, 4] })).toThrow(RangeError);
    expect(() => recordHand(g, { bid: '6S', bidder: 0, tricks: [6, 3] })).toThrow(RangeError);
  });

  it('does not mutate the previous game', () => {
    const g0 = fresh();
    const g1 = recordHand(g0, { bid: '6S', bidder: 0, tricks: [6, 4] });
    expect(g0.hands).toHaveLength(0);
    expect(g1).not.toBe(g0);
  });
});

describe('winning', () => {
  it('a slam can take the bidder past 500', () => {
    const g = play(
      fresh(),
      { bid: '7H', bidder: 0, tricks: [7, 3] }, // 200 / 30
      { bid: '6NT', bidder: 0, tricks: [7, 3] }, // 320 / 60
      { bid: '6D', bidder: 0, tricks: [10, 0] }, // slam: 570 / 60
    );
    expect(g.hands[2].slam).toBe(true);
    expect(getOutcome(g)).toEqual({ status: 'won', winner: 0, reason: 'reached-500', finalScores: [570, 60] });
  });

  it('bidder reaching exactly 500 on a made bid wins', () => {
    const g = play(
      fresh(),
      { bid: '9H', bidder: 0, tricks: [9, 1] }, // 400 / 10
      { bid: '6H', bidder: 0, tricks: [6, 4] }, // 500 / 50
    );
    expect(getScores(g)).toEqual([500, 50]);
    expect(getOutcome(g)).toEqual({ status: 'won', winner: 0, reason: 'reached-500', finalScores: [500, 50] });
    expect(isGameOver(g)).toBe(true);
  });

  it('a team can win in one hand with 10H / 10NT', () => {
    expect(getOutcome(play(fresh(), { bid: '10NT', bidder: 1, tricks: [0, 10] }))).toMatchObject({
      status: 'won',
      winner: 1,
      finalScores: [0, 520],
    });
  });

  it('bidder can win on misère', () => {
    const g = play(
      fresh(),
      { bid: '8D', bidder: 1, tricks: [2, 8] }, // 20 / 280
      { bid: 'MIS', bidder: 1, tricks: [10, 0] }, // 20 / 530
    );
    expect(getOutcome(g)).toMatchObject({ status: 'won', winner: 1, reason: 'reached-500' });
  });

  it('opponents passing 500 on tricks do not win; game continues', () => {
    const h = play(
      fresh(),
      { bid: '9NT', bidder: 1, tricks: [1, 9] }, // 10 / 420
      { bid: '6S', bidder: 0, tricks: [3, 7] }, // −30 / 490
      { bid: '6S', bidder: 0, tricks: [6, 4] }, // 10 / 530 (defending)
    );
    expect(getScores(h)).toEqual([10, 530]);
    expect(getOutcome(h)).toEqual({ status: 'in-progress' });
    expect(isGameOver(h)).toBe(false);
  });

  it('a team already over 500 still needs to make a bid to win', () => {
    const base = play(
      fresh(),
      { bid: '9NT', bidder: 1, tricks: [1, 9] }, // 10 / 420
      { bid: '6S', bidder: 0, tricks: [3, 7] }, // −30 / 490
      { bid: '6S', bidder: 0, tricks: [6, 4] }, // 10 / 530
    );
    // Team 1 bids and misses: drops below 500, no win.
    const missed = recordHand(base, { bid: '7S', bidder: 1, tricks: [4, 6] }); // 50 / 390
    expect(getOutcome(missed)).toEqual({ status: 'in-progress' });
    // Team 1 bids and makes: wins.
    const made = recordHand(base, { bid: '6S', bidder: 1, tricks: [4, 6] }); // 50 / 570
    expect(getOutcome(made)).toMatchObject({ status: 'won', winner: 1, reason: 'reached-500' });
  });

  it('bidder making a bid but staying under 500 does not win even if opponent is over 500', () => {
    const base = play(
      fresh(),
      { bid: '9NT', bidder: 1, tricks: [1, 9] }, // 10 / 420
      { bid: '6S', bidder: 0, tricks: [3, 7] }, // −30 / 490
      { bid: '6S', bidder: 0, tricks: [6, 4] }, // 10 / 530
    );
    const g = recordHand(base, { bid: '6H', bidder: 0, tricks: [6, 4] }); // 110 / 570
    expect(getScores(g)).toEqual([110, 570]);
    expect(getOutcome(g)).toEqual({ status: 'in-progress' });
  });

  it('refuses to record hands after the game is over', () => {
    const g = play(fresh(), { bid: '10H', bidder: 0, tricks: [10, 0] });
    expect(isGameOver(g)).toBe(true);
    expect(() => recordHand(g, { bid: '6S', bidder: 1, tricks: [4, 6] })).toThrow(/over/);
  });
});

describe('losing (≤ −500)', () => {
  it('a team falling to exactly −500 ends the game; the higher score wins', () => {
    const g = play(
      fresh(),
      { bid: '8D', bidder: 0, tricks: [5, 5] }, // −280 / 50
      { bid: '7NT', bidder: 0, tricks: [6, 4] }, // −500 / 90
    );
    expect(getScores(g)).toEqual([-500, 90]);
    expect(getOutcome(g)).toEqual({ status: 'won', winner: 1, reason: 'minus-500', finalScores: [-500, 90] });
  });

  it('−490 does not end the game', () => {
    const g = play(
      fresh(),
      { bid: '8D', bidder: 0, tricks: [5, 5] }, // −280 / 50
      { bid: '7C', bidder: 0, tricks: [6, 4] }, // −440 / 90
      { bid: '6S', bidder: 0, tricks: [5, 5] }, // −480 / 140
    );
    expect(getScores(g)).toEqual([-480, 140]);
    expect(getOutcome(g)).toEqual({ status: 'in-progress' });
  });

  it('a failed misère can end the game', () => {
    const g = play(
      fresh(),
      { bid: '8D', bidder: 1, tricks: [5, 5] }, // 50 / −280
      { bid: 'MIS', bidder: 1, tricks: [9, 1] }, // 50 / −530
    );
    expect(getOutcome(g)).toMatchObject({ status: 'won', winner: 0, reason: 'minus-500' });
  });

  it('the winner by −500 can have a negative score', () => {
    expect(evaluateOutcome({ bidder: 0, made: false, finalScores: [-510, -20] })).toMatchObject({
      status: 'won',
      winner: 1,
    });
  });

  it('equal scores when the game ends on −500 is a draw', () => {
    expect(evaluateOutcome({ bidder: 0, made: false, finalScores: [-500, -500] })).toEqual({
      status: 'draw',
      reason: 'minus-500',
      finalScores: [-500, -500],
    });
  });

  it('reaching 500 on a made bid takes priority', () => {
    expect(evaluateOutcome({ bidder: 1, made: true, finalScores: [-500, 500] })).toMatchObject({
      status: 'won',
      winner: 1,
      reason: 'reached-500',
    });
  });

  it('a missed bid never wins by reaching 500', () => {
    expect(evaluateOutcome({ bidder: 0, made: false, finalScores: [600, 0] })).toEqual({ status: 'in-progress' });
  });
});

describe('undo / goToHand', () => {
  const threeHands = () =>
    play(
      fresh(),
      { bid: '7H', bidder: 0, tricks: [8, 2] }, // 200 / 20
      { bid: '8S', bidder: 1, tricks: [3, 7] }, // 230 / −220
      { bid: 'MIS', bidder: 0, tricks: [0, 10] }, // 480 / −220
    );

  it('undo removes the last hand and restores its starting scores', () => {
    const g = undo(threeHands());
    expect(g.hands).toHaveLength(2);
    expect(getScores(g)).toEqual([230, -220]);
    expect(currentRound(g)).toBe(3);
  });

  it('repeated undo walks back to an empty game', () => {
    const g = undo(undo(undo(threeHands())));
    expect(g.hands).toHaveLength(0);
    expect(getScores(g)).toEqual([0, 0]);
    expect(currentRound(g)).toBe(1);
  });

  it('undo on an empty game is a no-op', () => {
    const g = fresh();
    expect(undo(g)).toBe(g);
  });

  it('goToHand(i) truncates to hands before i and restores hand i starting scores', () => {
    const g = threeHands();
    const g1 = goToHand(g, 1);
    expect(g1.hands).toHaveLength(1);
    expect(getScores(g1)).toEqual(g.hands[1].startingScores);
    expect(currentRound(g1)).toBe(2);
  });

  it('goToHand(0) resets to the start of the game', () => {
    const g = goToHand(threeHands(), 0);
    expect(g.hands).toHaveLength(0);
    expect(getScores(g)).toEqual([0, 0]);
  });

  it('goToHand(last) is the same as undo', () => {
    const g = threeHands();
    expect(goToHand(g, 2)).toEqual(undo(g));
  });

  it('goToHand rejects out-of-range or non-integer indices', () => {
    const g = threeHands();
    expect(() => goToHand(g, 3)).toThrow(RangeError);
    expect(() => goToHand(g, -1)).toThrow(RangeError);
    expect(() => goToHand(g, 1.5)).toThrow(RangeError);
    expect(() => goToHand(fresh(), 0)).toThrow(RangeError);
  });

  it('does not mutate the original game', () => {
    const g = threeHands();
    undo(g);
    goToHand(g, 0);
    expect(g.hands).toHaveLength(3);
  });

  it('undoing a winning hand resumes the game', () => {
    const won = recordHand(threeHands(), { bid: '6S', bidder: 0, tricks: [6, 4] }); // 520 / −180
    expect(getOutcome(won)).toMatchObject({ status: 'won', winner: 0 });
    const resumed = undo(won);
    expect(getOutcome(resumed)).toEqual({ status: 'in-progress' });
    // Hand can be re-entered differently.
    const redo = recordHand(resumed, { bid: '6S', bidder: 0, tricks: [5, 5] }); // 440 / −170
    expect(getScores(redo)).toEqual([440, -170]);
    expect(isGameOver(redo)).toBe(false);
  });

  it('can re-play from a rewound point', () => {
    const g = recordHand(goToHand(threeHands(), 1), { bid: '6S', bidder: 1, tricks: [4, 6] });
    expect(g.hands).toHaveLength(2);
    expect(g.hands[1].startingScores).toEqual([200, 20]);
    expect(getScores(g)).toEqual([240, 60]);
  });
});

describe('replay', () => {
  it('rebuilds an identical game from hand inputs', () => {
    const inputs: HandInput[] = [
      { bid: '7H', bidder: 0, tricks: [8, 2] },
      { bid: '8S', bidder: 1, tricks: [3, 7] },
      { bid: 'MIS', bidder: 0, tricks: [0, 10] },
    ];
    expect(replay(TEAMS, inputs)).toEqual(play(fresh(), ...inputs));
  });

  it('throws if the inputs continue past the end of the game', () => {
    expect(() =>
      replay(TEAMS, [
        { bid: '10NT', bidder: 0, tricks: [10, 0] },
        { bid: '6S', bidder: 1, tricks: [4, 6] },
      ]),
    ).toThrow(/over/);
  });
});
