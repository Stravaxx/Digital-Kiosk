import { getClientEnv } from './runtimeEnv';

const DB_NAME = 'digital-signage-client-db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

function getSystemApiBase(): string {
  const envBase = getClientEnv('VITE_ADMIN_API_BASE');
  return envBase || window.location.origin;
}

async function fetchSystemKv(key: string): Promise<string | null> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/system/kv/${encodeURIComponent(key)}`, {
      method: 'GET',
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return typeof payload?.value === 'string' ? payload.value : null;
  } catch {
    return null;
  }
}

async function putSystemKv(key: string, value: string): Promise<boolean> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/system/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    return response.ok;
  } catch {
    return false;
  }
}

interface KvEntry {
  key: string;
  value: string;
  updatedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir la DB client.'));
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erreur IndexedDB'));
  });
}

export async function mirrorLocalStorageKeyToDb(key: string): Promise<void> {
  const value = localStorage.getItem(key);
  if (value == null) return;

  const systemSaved = await putSystemKv(key, value);
  if (systemSaved) return;

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const row: KvEntry = { key, value, updatedAt: new Date().toISOString() };
    await requestToPromise(store.put(row));
  } finally {
    db.close();
  }
}

export async function hydrateLocalStorageKeyFromDb(key: string): Promise<void> {
  if (localStorage.getItem(key) != null) return;

  const systemValue = await fetchSystemKv(key);
  if (systemValue != null) {
    localStorage.setItem(key, systemValue);
    return;
  }

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const row = await requestToPromise<KvEntry | undefined>(store.get(key));
    if (row?.value != null) {
      localStorage.setItem(key, row.value);
    }
  } finally {
    db.close();
  }
}

export async function hydrateManyKeysFromDb(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await hydrateLocalStorageKeyFromDb(key);
    } catch {
      // best effort
    }
  }
}

export async function syncLocalStorageKeyFromSystem(key: string): Promise<boolean> {
  const systemValue = await fetchSystemKv(key);
  if (systemValue == null) return false;
  if (localStorage.getItem(key) !== systemValue) {
    localStorage.setItem(key, systemValue);
  }
  return true;
}

export async function requestPersistentSystemStorage(): Promise<boolean> {
  const storage = navigator.storage;
  if (!storage?.persist) return false;

  try {
    const alreadyPersistent = (await storage.persisted?.()) ?? false;
    if (alreadyPersistent) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
