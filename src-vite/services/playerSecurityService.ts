import { mirrorLocalStorageKeyToDb } from './clientDbStorage';

export const PLAYER_CONNECTION_KEY_STORAGE = 'ds.security.player-connection-key';

function randomKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
}

export function getPlayerConnectionKey(): string {
  const existing = localStorage.getItem(PLAYER_CONNECTION_KEY_STORAGE);
  if (existing && existing.trim().length >= 8) {
    void mirrorLocalStorageKeyToDb(PLAYER_CONNECTION_KEY_STORAGE);
    return existing;
  }

  const generated = randomKey();
  localStorage.setItem(PLAYER_CONNECTION_KEY_STORAGE, generated);
  void mirrorLocalStorageKeyToDb(PLAYER_CONNECTION_KEY_STORAGE);
  return generated;
}

export function setPlayerConnectionKey(value: string): string {
  const next = value.trim();
  if (next.length < 8) {
    throw new Error('La clé de connexion doit contenir au moins 8 caractères.');
  }
  localStorage.setItem(PLAYER_CONNECTION_KEY_STORAGE, next);
  void mirrorLocalStorageKeyToDb(PLAYER_CONNECTION_KEY_STORAGE);
  return next;
}

export function validatePlayerConnectionKey(candidate: string | null): boolean {
  if (!candidate) return false;
  return candidate === getPlayerConnectionKey();
}
