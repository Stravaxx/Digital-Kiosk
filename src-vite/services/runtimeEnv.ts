type EnvMap = Record<string, string | undefined>;

function readImportMetaEnv(): EnvMap | null {
  try {
    const meta = import.meta as ImportMeta & { env?: EnvMap };
    return meta.env ?? null;
  } catch {
    return null;
  }
}

export function getClientEnv(name: string): string {
  const metaEnv = readImportMetaEnv();
  const fromMeta = metaEnv?.[name];
  if (typeof fromMeta === 'string' && fromMeta.trim()) {
    return fromMeta.trim();
  }

  const fromGlobal = (globalThis as { __DS_ENV__?: EnvMap }).__DS_ENV__?.[name];
  if (typeof fromGlobal === 'string' && fromGlobal.trim()) {
    return fromGlobal.trim();
  }

  return '';
}