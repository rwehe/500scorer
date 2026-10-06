import { describe, expect, it } from 'vitest';
import {
  PAST_GAMES_KEY,
  PAST_GAMES_LIMIT,
  STORAGE_KEY,
  archiveActive,
  deserializeGame,
  gameFromPast,
  loadActiveGame,
  loadPastGames,
  parsePastGames,
  pastEntryMatches,
  readActive,
  removePastGame,
  renamePastGame,
  saveActiveGame,
  savePastGames,
  serializeGame,
  serializePastGames,
  summarizePastGame,
  toPastEntry,
  upsertPastGame,
  type PastGameEntry,
} from '../src/app/persist';
import { bidLabel, bidLongLabel, ordinal } from '../src/app/format';
import { createGame, getOutcome, getScores, recordHand, type Game } from '../src/lib/game';
import { getBid, MISERE } from '../src/lib/bids';

const TEAMS = [{ players: ['A', 'B'] }, { players: ['C', 'D'] }] as const;

describe('persist', () => {
  it('round-trips a game through serialize/deserialize', () => {
    let g = createGame([{ players: [...TEAMS[0].players] }, { players: [...TEAMS[1].players] }]);
    g = recordHand(g, { bid: '7H', bidder: 0, tricks: [8, 2] });
    g = recordHand(g, { bid: 'MIS', bidder: 1, tricks: [10, 0] });
    const back = deserializeGame(serializeGame(g));
    expect(back).not.toBeNull();
    expect(back!.teams).toEqual(g.teams);
    expect(getScores(back!)).toEqual(getScores(g));
    expect(back!.hands.length).toBe(2);
  });

  it('returns null for missing or corrupt data', () => {
    expect(deserializeGame(null)).toBeNull();
    expect(deserializeGame('not json')).toBeNull();
    expect(deserializeGame('{"v":2}')).toBeNull();
    expect(deserializeGame('{"v":1,"teams":[],"hands":[]}')).toBeNull();
    expect(
      deserializeGame('{"v":1,"teams":[{"players":["a","b"]},{"players":["c","d"]}],"hands":[{"bid":"7H","bidder":0,"tricks":[11,-1]}]}'),
    ).toBeNull();
  });
});

const NOW = '2026-10-06T12:00:00.000Z';
const LATER = '2026-10-06T18:00:00.000Z';

function memory(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, String(v));
    },
  };
}

function played(): Game {
  let g = createGame([{ players: ['Ada', 'Bea'] }, { players: ['Cam', 'Dee'] }]);
  g = recordHand(g, { bid: '7H', bidder: 0, tricks: [8, 2] });
  g = recordHand(g, { bid: '10NT', bidder: 1, tricks: [0, 10] });
  return g;
}

function entry(id: string, updatedAt: string, game = played(), title = ''): PastGameEntry {
  return toPastEntry({ id, game }, title ? { id, savedAt: NOW, updatedAt, title, teams: game.teams, hands: [] } : undefined, updatedAt);
}

describe('past games', () => {
  it('archives inputs only and recomputes the outcome from those hands', () => {
    const game = played();
    const active = { id: 'game-1', game };
    const saved = toPastEntry(active, undefined, NOW);
    const raw = JSON.parse(serializePastGames([saved])) as { v: number; games: Record<string, unknown>[] };
    expect(raw.v).toBe(1);
    expect(raw.games[0]).not.toHaveProperty('scores');
    expect(raw.games[0]).not.toHaveProperty('finalScores');
    expect(raw.games[0].hands).toEqual([
      { bid: '7H', bidder: 0, tricks: [8, 2] },
      { bid: '10NT', bidder: 1, tricks: [0, 10] },
    ]);

    const summary = summarizePastGame(saved);
    expect(summary).not.toBeNull();
    expect(summary!.scores).toEqual(getScores(game));
    expect(summary!.status).toBe('won');
    expect(summary!.winner).toBe(1);
    expect(summary!.reason).toBe('reached-500');
    expect(summary!.displayTitle).toBe('Ada & Bea vs Cam & Dee');
    expect(getOutcome(gameFromPast(saved)!)).toEqual(getOutcome(game));
  });

  it('keeps a custom title and the original savedAt when the snapshot is updated', () => {
    const first = toPastEntry({ id: 'game-1', game: played() }, undefined, NOW);
    const named = renamePastGame([first], 'game-1', '  Friday night  ', LATER);
    expect(named[0].title).toBe('Friday night');
    expect(named[0].savedAt).toBe(NOW);
    expect(named[0].updatedAt).toBe(LATER);
    expect(summarizePastGame(named[0])!.displayTitle).toBe('Friday night');

    const again = archiveActive(named, { id: 'game-1', game: played() }, '2026-10-07T00:00:00.000Z');
    expect(again[0].title).toBe('Friday night');
    expect(again[0].savedAt).toBe(NOW);
    expect(again).toHaveLength(1);
  });

  it('caps the list at the newest games and drops an unchanged upsert', () => {
    expect(PAST_GAMES_LIMIT).toBe(30);
    const games = Array.from({ length: 30 }, (_, i) =>
      entry(`g${String(i).padStart(2, '0')}`, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
    );
    const newest = entry('fresh', '2026-02-01T00:00:00.000Z');
    const capped = upsertPastGame(games, newest, 30);
    expect(capped).toHaveLength(30);
    expect(capped[0].id).toBe('fresh');
    expect(capped.some((g) => g.id === 'g00')).toBe(false);
    expect(capped.some((g) => g.id === 'g01')).toBe(true);

    const same = upsertPastGame(capped, { ...capped[0], updatedAt: '2026-03-01T00:00:00.000Z' });
    expect(same).toBe(capped);
    expect(pastEntryMatches(capped[0], { id: 'fresh', game: played() })).toBe(true);
  });

  it('ignores corrupt files and corrupt entries, and keeps a valid neighbour', () => {
    expect(parsePastGames(null)).toEqual([]);
    expect(parsePastGames('not json')).toEqual([]);
    expect(parsePastGames('{"v":2,"games":[]}')).toEqual([]);
    expect(parsePastGames('[]')).toEqual([]);

    const good = toPastEntry({ id: 'ok', game: played() }, undefined, NOW);
    const raw = JSON.stringify({
      v: 1,
      games: [
        { id: 'bad-hands', savedAt: NOW, updatedAt: NOW, title: '', teams: good.teams, hands: [{ bid: '7H', bidder: 0, tricks: [11, -1] }] },
        { id: 'bad-bid', savedAt: NOW, updatedAt: NOW, title: '', teams: good.teams, hands: [{ bid: 'NOPE', bidder: 0, tricks: [6, 4] }] },
        { nope: true },
        null,
        good,
        { ...good, id: 'ok', updatedAt: '2026-01-01T00:00:00.000Z' },
      ],
    });
    const parsed = parsePastGames(raw);
    expect(parsed.map((g) => g.id)).toEqual(['ok']);
    expect(parsed[0].updatedAt).toBe(NOW);
  });

  it('renames, deletes, and drops an empty game from the archive', () => {
    const list = [entry('a', NOW), entry('b', LATER)];
    expect(removePastGame(list, 'missing')).toBe(list);
    expect(removePastGame(list, 'a').map((g) => g.id)).toEqual(['b']);
    expect(renamePastGame(list, 'missing', 'x', LATER)).toBe(list);

    const empty = createGame([{ players: ['Ada', 'Bea'] }, { players: ['Cam', 'Dee'] }]);
    expect(archiveActive(list, { id: 'a', game: empty }, LATER).map((g) => g.id)).toEqual(['b']);
  });

  it('round-trips the active game and the past list through storage, and swallows quota errors', () => {
    const store = memory();
    const active = { id: 'abc', game: played() };
    saveActiveGame(active, store);
    const loaded = loadActiveGame(store);
    expect(loaded?.id).toBe('abc');
    expect(getScores(loaded!.game)).toEqual(getScores(active.game));

    const past = archiveActive([], active, NOW);
    savePastGames(past, store);
    expect(loadPastGames(store)[0].id).toBe('abc');
    expect(store.getItem(STORAGE_KEY)).toContain('"id":"abc"');
    expect(store.getItem(PAST_GAMES_KEY)).toContain('"v":1');

    store.setItem(STORAGE_KEY, '{');
    store.setItem(PAST_GAMES_KEY, '{');
    expect(loadActiveGame(store)).toBeNull();
    expect(loadPastGames(store)).toEqual([]);

    const quota = memory();
    quota.setItem = () => {
      throw new Error('quota');
    };
    expect(() => saveActiveGame(active, quota)).not.toThrow();
    expect(() => savePastGames(past, quota)).not.toThrow();

    const exploding = memory();
    exploding.getItem = () => {
      throw new Error('denied');
    };
    expect(loadActiveGame(exploding)).toBeNull();
    expect(loadPastGames(exploding)).toEqual([]);
  });

  it('assigns an id when an older save has none', () => {
    const raw = serializeGame(played());
    expect(JSON.parse(raw)).not.toHaveProperty('id');
    const active = readActive(raw);
    expect(active).not.toBeNull();
    expect(active!.id.length).toBeGreaterThan(0);
    expect(getScores(active!.game)).toEqual(getScores(played()));
  });
});

describe('format', () => {
  it('labels bids, including misère correctly', () => {
    expect(bidLabel(getBid('7H'))).toBe('7♥');
    expect(bidLabel(getBid('10NT'))).toBe('10NT');
    expect(bidLabel(MISERE)).toBe('Misère');
    expect(bidLongLabel(MISERE)).toBe('Misère');
    expect(bidLongLabel(getBid('6S'))).toBe('6 Spades');
  });
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st',
    ]);
  });
});
