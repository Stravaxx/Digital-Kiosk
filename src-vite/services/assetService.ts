import { getSystemApiBase } from './systemApiBase';

export type AssetType = 'image' | 'video' | 'pdf' | 'html' | 'document' | 'other';

export interface AssetRecord {
  id: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  type: AssetType;
  size: number;
  uploadedAt: string;
}

interface AssetEntity {
  id: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  type: AssetType;
  size: number;
  uploadedAt: string;
  blob: Blob;
}

interface AssetApiRow {
  id: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  type: AssetType;
  size: number;
  uploadedAt: string;
}

const DB_NAME = 'digital-signage-assets';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

async function isSystemApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/health`, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

function inferAssetType(mimeType: string, extension: string): AssetType {
  const mime = mimeType.toLowerCase();
  const ext = extension.toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'ogg'].includes(ext)) return 'video';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime === 'text/html' || ext === 'html' || ext === 'htm') return 'html';
  if (mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(ext)) return 'document';
  return 'other';
}

function toAssetRecord(entity: AssetEntity): AssetRecord {
  return {
    id: entity.id,
    name: entity.name,
    originalFileName: entity.originalFileName,
    mimeType: entity.mimeType,
    extension: entity.extension,
    type: entity.type,
    size: entity.size,
    uploadedAt: entity.uploadedAt
  };
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request error'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open assets database'));
  });
}

function extractExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length <= 1) return '';
  return parts.at(-1)?.toLowerCase() ?? '';
}

function createAssetEntity(file: File): AssetEntity {
  const extension = extractExtension(file.name);
  const timestamp = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `asset-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
    name: file.name.replace(/\.[^/.]+$/, ''),
    originalFileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    extension,
    type: inferAssetType(file.type, extension),
    size: file.size,
    uploadedAt: timestamp,
    blob: file
  };
}

function mapApiRowToAssetRecord(row: AssetApiRow): AssetRecord {
  return {
    id: row.id,
    name: row.name,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    extension: row.extension,
    type: row.type,
    size: row.size,
    uploadedAt: row.uploadedAt
  };
}

async function listAssetsFromIndexedDb(): Promise<AssetRecord[]> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const rows = await requestToPromise<AssetEntity[]>(store.getAll());
    return rows
      .map(toAssetRecord)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } finally {
    db.close();
  }
}

async function listAssetsFromSystemApi(): Promise<AssetRecord[]> {
  const response = await fetch(`${getSystemApiBase()}/api/assets`, { cache: 'no-store' });
  if (!response.ok) return [];
  const payload = await response.json();
  const rows = (Array.isArray(payload?.records) ? payload.records : []) as AssetApiRow[];
  return rows.map(mapApiRowToAssetRecord);
}

async function getAssetBlobFromIndexedDb(assetId: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const entity = await requestToPromise<AssetEntity | undefined>(store.get(assetId));
    if (!entity) return null;
    return entity.blob;
  } finally {
    db.close();
  }
}

async function deleteAssetFromIndexedDb(assetId: string): Promise<void> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(store.delete(assetId));

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Delete asset transaction aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Delete asset transaction failed'));
    });
  } finally {
    db.close();
  }
}

export async function listAssets(): Promise<AssetRecord[]> {
  if (await isSystemApiAvailable()) {
    try {
      const apiRecords = await listAssetsFromSystemApi();
      if (apiRecords.length >= 0) {
        const localRecords = await listAssetsFromIndexedDb().catch(() => []);
        const merged = new Map<string, AssetRecord>();
        [...apiRecords, ...localRecords].forEach((item) => merged.set(item.id, item));
        return [...merged.values()].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      }
    } catch {
      // fallback IndexedDB
    }
  }

  return listAssetsFromIndexedDb();
}

export async function uploadAssets(files: File[]): Promise<AssetRecord[]> {
  if (files.length === 0) return [];

  if (await isSystemApiAvailable()) {
    try {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      const response = await fetch(`${getSystemApiBase()}/api/assets`, {
        method: 'POST',
        body: form
      });
      if (response.ok) {
        const payload = await response.json();
        const rows = (Array.isArray(payload?.records) ? payload.records : []) as AssetApiRow[];
        return rows.map(mapApiRowToAssetRecord);
      }
    } catch {
      // fallback IndexedDB
    }
  }

  const db = await openDb();
  const records: AssetRecord[] = [];

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    for (const file of files) {
      const entity = createAssetEntity(file);
      await requestToPromise(store.put(entity));
      records.push(toAssetRecord(entity));
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Asset upload transaction aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Asset upload transaction failed'));
    });

    return records;
  } finally {
    db.close();
  }
}

export async function getAssetBlob(assetId: string): Promise<Blob | null> {
  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/assets/${encodeURIComponent(assetId)}/blob`, {
        cache: 'no-store'
      });
      if (response.ok) return await response.blob();
    } catch {
      // fallback IndexedDB
    }
  }

  return getAssetBlobFromIndexedDb(assetId);
}

export async function ensureAssetAvailableOnSystem(asset: AssetRecord): Promise<void> {
  if (!await isSystemApiAvailable()) return;

  const remoteAssets = await listAssetsFromSystemApi().catch(() => []);
  if (remoteAssets.some((item) => item.id === asset.id)) return;

  const blob = await getAssetBlobFromIndexedDb(asset.id);
  if (!blob) return;

  const file = new File([blob], asset.originalFileName || `${asset.name}.${asset.extension || 'bin'}`, {
    type: asset.mimeType || blob.type || 'application/octet-stream',
    lastModified: Date.now()
  });

  const form = new FormData();
  form.append('file', file);
  form.append('assetId', asset.id);
  form.append('name', asset.name);
  form.append('originalFileName', asset.originalFileName);
  form.append('mimeType', asset.mimeType);
  form.append('extension', asset.extension);
  form.append('type', asset.type);
  form.append('uploadedAt', asset.uploadedAt);

  const response = await fetch(`${getSystemApiBase()}/api/assets/import`, {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    throw new Error('Synchronisation asset impossible');
  }
}

export async function ensureAssetIdsAvailableOnSystem(assetIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const assets = await listAssets();
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  for (const assetId of uniqueIds) {
    const asset = byId.get(assetId);
    if (!asset) continue;
    await ensureAssetAvailableOnSystem(asset);
  }
}

export async function deleteAsset(assetId: string): Promise<void> {
  let deletedRemotely = false;

  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/assets/${encodeURIComponent(assetId)}`, {
        method: 'DELETE'
      });
      deletedRemotely = response.ok || response.status === 404;
    } catch {
      // fallback IndexedDB
    }
  }

  await deleteAssetFromIndexedDb(assetId).catch(() => {
    if (!deletedRemotely) throw new Error('Suppression asset impossible');
  });

  if (!deletedRemotely && await isSystemApiAvailable()) {
    throw new Error('Suppression asset impossible');
  }
}

export async function clearAssets(): Promise<void> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await requestToPromise(store.clear());

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Clear assets transaction aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Clear assets transaction failed'));
    });
  } finally {
    db.close();
  }
}

export async function downloadAsset(asset: AssetRecord): Promise<void> {
  const blob = await getAssetBlob(asset.id);
  if (!blob) throw new Error('Asset introuvable');

  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = asset.originalFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }
}

export async function openAssetPreview(asset: AssetRecord): Promise<void> {
  const blob = await getAssetBlob(asset.id);
  if (!blob) throw new Error('Asset introuvable');

  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export function formatAssetSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}
