import { getOutcome, getScores, replay, type Game } from '../lib/game';
import type { Pair, TeamIndex, Teams } from '../lib/types';

/** In-progress (or just-finished, still on screen) game. Scores are not stored. */
export const STORAGE_KEY = '500scorer:current-game:v1';
/** Last four names typed on setup, used to prefill the next game. */
export const NAMES_KEY = '500scorer:last-names:v1';
/**
 * Finished games and any mid-game snapshots the player saved or left behind.
 * Separate from {@link STORAGE_KEY}. Capped at {@link PAST_GAMES_LIMIT}.
 */
export const PAST_GAMES_KEY = '500scorer:past-games:v1';
/** Set to `"1"` when the Add to Home Screen hint is dismissed. */
export const INSTALL_DISMISSED_KEY = '500scorer:install-dismissed:v1';

/** Newest games kept. Older ones drop off the end of the list. */
export const PAST_GAMES_LIMIT = 30;

export interface SavedHand {
  bid: string;
  bidder: TeamIndex;
  tricks: [number, number];
}

interface SavedGameV1 {
  v: 1;
  id?: string;
  teams: Teams;
  hands: SavedHand[];
}

/** One archived game. Outcome and scores are derived with {@link replay}, never stored. */
export interface PastGameEntry {
  id: string;
  /** ISO timestamp from the first time this id was archived. */
  savedAt: string;
  /** ISO timestamp of the last snapshot, rename, or update. */
  updatedAt: string;
  /** Optional display name. Empty string falls back to the team names. */
  title: string;
  teams: Teams;
  hands: SavedHand[];
}

export interface ActiveGame {
  id: string;
  game: Game;
}

export interface PastGameSummary {
  id: string;
  title: string;
  displayTitle: string;
  savedAt: string;
  updatedAt: string;
  teams: Teams;
  scores: Pair<number>;
  status: 'in-progress' | 'won' | 'draw';
  reason: 'reached-500' | 'minus-500' | null;
  winner: TeamIndex | null;
  hands: number;
}

interface PastFileV1 {
  v: 1;
  games: PastGameEntry[];
}

/** Serialize a game as its inputs only; scores are always recomputed on load. */
export function serializeGame(game: Game, id?: string): string {
  const data: SavedGameV1 = {
    v: 1,
    ...(id ? { id } : {}),
    teams: copyTeams(game.teams),
    hands: handsFromGame(game),
  };
  return JSON.stringify(data);
}

/** Rebuild a game from {@link serializeGame} output. Returns null for missing, corrupt or invalid data. */
export function deserializeGame(raw: string | null | undefined): Game | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SavedGameV1;
    if (data?.v !== 1 || !Array.isArray(data.hands)) return null;
    return replaySaved(data.teams, data.hands);
  } catch {
    return null;
  }
}

/** Like {@link deserializeGame}, but keeps the stable id used to archive the game. */
export function readActive(raw: string | null | undefined): ActiveGame | null {
  const game = deserializeGame(raw);
  if (!game || !raw) return null;
  let id = '';
  try {
    const data = JSON.parse(raw) as SavedGameV1;
    if (typeof data?.id === 'string') id = cleanId(data.id);
  } catch {
    return null;
  }
  return { id: id || newId(), game };
}

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadActiveGame(store?: Storage | null): ActiveGame | null {
  const s = resolveStore(store);
  if (!s) return null;
  try {
    return readActive(s.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveActiveGame(active: ActiveGame | null, store?: Storage | null): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    if (active) s.setItem(STORAGE_KEY, serializeGame(active.game, active.id));
    else s.removeItem(STORAGE_KEY);
  } catch {
    /* quota / private mode: keep playing in memory */
  }
}

/** @deprecated Prefer {@link loadActiveGame} so the archive id is preserved. */
export function loadGame(): Game | null {
  return loadActiveGame()?.game ?? null;
}

/** Last-used player names, to prefill setup. */
export function loadNames(store?: Storage | null): string[] | null {
  const s = resolveStore(store);
  if (!s) return null;
  try {
    const v = JSON.parse(s.getItem(NAMES_KEY) ?? 'null');
    return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'string') ? v : null;
  } catch {
    return null;
  }
}

export function saveNames(names: string[], store?: Storage | null): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    /* ignore */
  }
}

export function loadInstallDismissed(store?: Storage | null): boolean {
  const s = resolveStore(store);
  if (!s) return false;
  try {
    return s.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveInstallDismissed(store?: Storage | null): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Parse the past-games file. Invalid entries are dropped; an unreadable file
 * yields an empty list. At most {@link PAST_GAMES_LIMIT} games are returned,
 * newest {@link PastGameEntry.updatedAt} first.
 */
export function parsePastGames(raw: string | null | undefined): PastGameEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as PastFileV1;
    if (!data || data.v !== 1 || !Array.isArray(data.games)) return [];
    const byId = new Map<string, PastGameEntry>();
    for (const item of data.games) {
      const entry = coerceEntry(item);
      if (!entry) continue;
      const prev = byId.get(entry.id);
      if (!prev || entry.updatedAt > prev.updatedAt) byId.set(entry.id, entry);
    }
    return [...byId.values()].sort(byUpdatedDesc).slice(0, PAST_GAMES_LIMIT);
  } catch {
    return [];
  }
}

export function serializePastGames(entries: readonly PastGameEntry[]): string {
  const file: PastFileV1 = {
    v: 1,
    games: entries.slice(0, PAST_GAMES_LIMIT).map((e) => ({
      id: e.id,
      savedAt: e.savedAt,
      updatedAt: e.updatedAt,
      title: e.title,
      teams: copyTeams(e.teams),
      hands: e.hands.map(copyHand),
    })),
  };
  return JSON.stringify(file);
}

export function loadPastGames(store?: Storage | null): PastGameEntry[] {
  const s = resolveStore(store);
  if (!s) return [];
  try {
    return parsePastGames(s.getItem(PAST_GAMES_KEY));
  } catch {
    return [];
  }
}

export function savePastGames(entries: readonly PastGameEntry[], store?: Storage | null): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.setItem(PAST_GAMES_KEY, serializePastGames(entries));
  } catch {
    /* quota / private mode */
  }
}

export function toPastEntry(active: ActiveGame, previous: PastGameEntry | undefined, now: string): PastGameEntry {
  return {
    id: active.id,
    savedAt: previous?.savedAt ?? now,
    updatedAt: now,
    title: (previous?.title ?? '').trim().slice(0, 40),
    teams: copyTeams(active.game.teams),
    hands: handsFromGame(active.game),
  };
}

/** True when the archived snapshot already matches this game (title included). */
export function pastEntryMatches(entry: PastGameEntry | undefined, active: ActiveGame): boolean {
  if (!entry || active.game.hands.length === 0) return false;
  return canon(entry) === canon(toPastEntry(active, entry, entry.updatedAt));
}

/**
 * Insert or replace `entry` and keep the newest {@link PAST_GAMES_LIMIT} games.
 * Returns the same array reference when the snapshot is unchanged.
 */
export function upsertPastGame(
  entries: readonly PastGameEntry[],
  entry: PastGameEntry,
  limit = PAST_GAMES_LIMIT,
): PastGameEntry[] {
  const existing = entries.find((e) => e.id === entry.id);
  const nextEntry: PastGameEntry = {
    ...entry,
    title: entry.title.trim().slice(0, 40),
    savedAt: existing?.savedAt ?? entry.savedAt,
    teams: copyTeams(entry.teams),
    hands: entry.hands.map(copyHand),
  };
  if (existing && canon(existing) === canon(nextEntry)) return entries as PastGameEntry[];
  const next = [nextEntry, ...entries.filter((e) => e.id !== entry.id)];
  next.sort(byUpdatedDesc);
  return next.slice(0, limit);
}

export function removePastGame(entries: readonly PastGameEntry[], id: string): PastGameEntry[] {
  if (!entries.some((e) => e.id === id)) return entries as PastGameEntry[];
  return entries.filter((e) => e.id !== id);
}

export function renamePastGame(
  entries: readonly PastGameEntry[],
  id: string,
  title: string,
  now: string,
): PastGameEntry[] {
  const existing = entries.find((e) => e.id === id);
  if (!existing) return entries as PastGameEntry[];
  const clean = title.trim().slice(0, 40);
  if (existing.title === clean) return entries as PastGameEntry[];
  return upsertPastGame(entries, { ...existing, title: clean, updatedAt: now });
}

/** Write the active game into the past list. An empty game is removed instead. */
export function archiveActive(
  entries: readonly PastGameEntry[],
  active: ActiveGame,
  now = new Date().toISOString(),
): PastGameEntry[] {
  if (active.game.hands.length === 0) return removePastGame(entries, active.id);
  return upsertPastGame(entries, toPastEntry(active, entries.find((e) => e.id === active.id), now));
}

export function gameFromPast(entry: PastGameEntry): Game | null {
  try {
    return replaySaved(entry.teams, entry.hands);
  } catch {
    return null;
  }
}

export function summarizePastGame(entry: PastGameEntry): PastGameSummary | null {
  try {
    const game = replaySaved(entry.teams, entry.hands);
    const outcome = getOutcome(game);
    const scores = getScores(game);
    const title = entry.title.trim();
    return {
      id: entry.id,
      title,
      displayTitle: title || fallbackTitle(entry.teams),
      savedAt: entry.savedAt,
      updatedAt: entry.updatedAt,
      teams: copyTeams(entry.teams),
      scores,
      status: outcome.status,
      reason: outcome.status === 'in-progress' ? null : outcome.reason,
      winner: outcome.status === 'won' ? outcome.winner : null,
      hands: game.hands.length,
    };
  } catch {
    return null;
  }
}

function fallbackTitle(teams: Teams): string {
  return `${teams[0].players[0]} & ${teams[0].players[1]} vs ${teams[1].players[0]} & ${teams[1].players[1]}`;
}

function handsFromGame(game: Game): SavedHand[] {
  return game.hands.map((h) => ({
    bid: h.bid.id,
    bidder: h.bidder,
    tricks: [h.tricks[0], h.tricks[1]],
  }));
}

function replaySaved(teams: Teams, hands: readonly SavedHand[]): Game {
  return replay(
    copyTeams(teams),
    hands.map((h) => ({ bid: h.bid, bidder: h.bidder, tricks: [h.tricks[0], h.tricks[1]] })),
  );
}

function copyTeams(teams: Teams): Teams {
  return [
    { players: [teams[0].players[0], teams[0].players[1]] },
    { players: [teams[1].players[0], teams[1].players[1]] },
  ];
}

function copyHand(h: SavedHand): SavedHand {
  return { bid: h.bid, bidder: h.bidder, tricks: [h.tricks[0], h.tricks[1]] };
}

function canon(entry: Pick<PastGameEntry, 'title' | 'teams' | 'hands'>): string {
  return JSON.stringify({
    title: entry.title.trim(),
    teams: entry.teams.map((t) => [t.players[0], t.players[1]]),
    hands: entry.hands.map((h) => [h.bid, h.bidder, h.tricks[0], h.tricks[1]]),
  });
}

function byUpdatedDesc(a: PastGameEntry, b: PastGameEntry): number {
  if (a.updatedAt === b.updatedAt) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return a.updatedAt < b.updatedAt ? 1 : -1;
}

function cleanId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 80) return '';
  return trimmed;
}

function coerceEntry(item: unknown): PastGameEntry | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as Partial<PastGameEntry>;
  const id = typeof raw.id === 'string' ? cleanId(raw.id) : '';
  const savedAt = iso(raw.savedAt);
  const updatedAt = iso(raw.updatedAt);
  if (!id || !savedAt || !updatedAt) return null;
  if (!Array.isArray(raw.hands) || !isTeams(raw.teams)) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 40) : '';
  const hands: SavedHand[] = [];
  for (const hand of raw.hands) {
    const saved = coerceHand(hand);
    if (!saved) return null;
    hands.push(saved);
  }
  const entry: PastGameEntry = {
    id,
    savedAt,
    updatedAt,
    title,
    teams: copyTeams(raw.teams),
    hands,
  };
  if (!gameFromPast(entry)) return null;
  return entry;
}

function coerceHand(hand: unknown): SavedHand | null {
  if (!hand || typeof hand !== 'object') return null;
  const h = hand as Partial<SavedHand>;
  if (typeof h.bid !== 'string' || !h.bid) return null;
  if (h.bidder !== 0 && h.bidder !== 1) return null;
  if (!Array.isArray(h.tricks) || h.tricks.length !== 2) return null;
  if (typeof h.tricks[0] !== 'number' || typeof h.tricks[1] !== 'number') return null;
  return { bid: h.bid, bidder: h.bidder, tricks: [h.tricks[0], h.tricks[1]] };
}

function isTeams(teams: unknown): teams is Teams {
  if (!Array.isArray(teams) || teams.length !== 2) return false;
  return teams.every((team) => {
    const players = (team as { players?: unknown })?.players;
    return Array.isArray(players) && players.length === 2 && players.every((p) => typeof p === 'string');
  });
}

function iso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function resolveStore(store?: Storage | null): Storage | null {
  if (store !== undefined) return store;
  return storage();
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
