import fs from 'fs/promises';
import path from 'path';

function resolveDbPath(targetPath: string): string {
  const normalized = String(targetPath || '').trim().replace(/\\/g, '/');
  if (!normalized) {
    throw new Error('Invalid JSON DB path');
  }

  const workspaceRoot = process.cwd();
  const relative = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  return path.resolve(workspaceRoot, relative);
}

export async function readJson<T>(targetPath: string, fallbackValue?: T): Promise<T> {
  const resolvedPath = resolveDbPath(targetPath);
  try {
    const data = await fs.readFile(resolvedPath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (error) {
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw error;
  }
}

export async function writeJson<T>(targetPath: string, data: T): Promise<void> {
  const resolvedPath = resolveDbPath(targetPath);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Exemples d'utilisation :
// const screens = await readJson<ScreenRecord[]>('/database/screens.json');
// await writeJson('/database/screens.json', screens);
