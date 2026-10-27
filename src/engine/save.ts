import type { GameState } from './types';
import { GAME_VERSION } from './balance';
import { isRecord } from './guards';

export const SAVE_KEY = 'gridpower.save.v3';

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

export function parseGame(raw: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== GAME_VERSION) return null;
  if (parsed.phase !== 'playing' && parsed.phase !== 'gameover') return null;
  if (!Number.isFinite(parsed.turn) || !Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) return null;
  if (!Array.isArray(parsed.tiles) || !Array.isArray(parsed.players)) return null;
  if (parsed.tiles.length !== Number(parsed.width) * Number(parsed.height)) return null;
  if (parsed.players.length === 0) return null;
  if (!isRecord(parsed.conditions) || !isRecord(parsed.forecast) || !isRecord(parsed.settings)) return null;
  if (typeof parsed.rngState !== 'number' || typeof parsed.nextStructureId !== 'number') return null;
  if (typeof parsed.marketSaturation !== 'number') return null;
  // Structural sanity on tiles and players prevents half-parsed saves from crashing the UI.
  const firstTile = parsed.tiles[0];
  if (!isRecord(firstTile) || typeof firstTile.x !== 'number' || typeof firstTile.terrain !== 'string') return null;
  const firstPlayer = parsed.players[0];
  if (!isRecord(firstPlayer) || typeof firstPlayer.credits !== 'number' || !Array.isArray(firstPlayer.techs)) return null;
  return parsed as unknown as GameState;
}

export function saveGame(state: GameState): boolean {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(SAVE_KEY, serializeGame(state));
    localStorage.setItem(`${SAVE_KEY}.savedAt`, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return parseGame(raw);
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  if (!storageAvailable()) return false;
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function savedAt(): number | null {
  if (!storageAvailable()) return null;
  try {
    const value = localStorage.getItem(`${SAVE_KEY}.savedAt`);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}
