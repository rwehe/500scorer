import { replay, type Game, type HandInput } from '../lib/game';
import type { Teams } from '../lib/types';

/** localStorage key for the in-progress game (full saved-games/persistence lands in M3). */
export const STORAGE_KEY = '500scorer:current-game:v1';
export const NAMES_KEY = '500scorer:last-names:v1';

interface SavedGameV1 {
  v: 1;
  teams: Teams;
  hands: { bid: string; bidder: 0 | 1; tricks: [number, number] }[];
}

/** Serialize a game as its inputs only; scores are always recomputed on load. */
export function serializeGame(game: Game): string {
  const data: SavedGameV1 = {
    v: 1,
    teams: game.teams,
    hands: game.hands.map((h) => ({ bid: h.bid.id, bidder: h.bidder, tricks: [h.tricks[0], h.tricks[1]] })),
  };
  return JSON.stringify(data);
}

/** Rebuild a game from {@link serializeGame} output. Returns null for missing, corrupt or invalid data. */
export function deserializeGame(raw: string | null | undefined): Game | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SavedGameV1;
    if (data?.v !== 1 || !Array.isArray(data.hands)) return null;
    const inputs: HandInput[] = data.hands.map((h) => ({ bid: h.bid, bidder: h.bidder, tricks: h.tricks }));
    return replay(data.teams, inputs);
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadGame(): Game | null {
  return deserializeGame(storage()?.getItem(STORAGE_KEY));
}

export function saveGame(game: Game | null): void {
  const s = storage();
  if (!s) return;
  try {
    if (game) s.setItem(STORAGE_KEY, serializeGame(game));
    else s.removeItem(STORAGE_KEY);
  } catch {
    /* quota / private mode: keep playing in memory */
  }
}

/** Last-used player names, to prefill setup. */
export function loadNames(): string[] | null {
  try {
    const v = JSON.parse(storage()?.getItem(NAMES_KEY) ?? 'null');
    return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'string') ? v : null;
  } catch {
    return null;
  }
}

export function saveNames(names: string[]): void {
  try {
    storage()?.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    /* ignore */
  }
}
