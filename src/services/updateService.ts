export interface UpdateStatus {
  repo: string;
  currentVersion: string;
  latestVersion: string | null;
  latestTag: string | null;
  latestPublishedAt: string | null;
  releaseUrl: string | null;
  releaseName: string | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  checkError: string | null;
  checking: boolean;
  updating: boolean;
  updateError: string | null;
  updatedAt: string | null;
  appliedTag: string | null;
  requiresRestart: boolean;
}

async function parseUpdateResponse(response: Response): Promise<UpdateStatus> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || 'Erreur mise à jour.'));
  }

  return {
    repo: String(payload?.repo || ''),
    currentVersion: String(payload?.currentVersion || '0.0.0'),
    latestVersion: typeof payload?.latestVersion === 'string' ? payload.latestVersion : null,
    latestTag: typeof payload?.latestTag === 'string' ? payload.latestTag : null,
    latestPublishedAt: typeof payload?.latestPublishedAt === 'string' ? payload.latestPublishedAt : null,
    releaseUrl: typeof payload?.releaseUrl === 'string' ? payload.releaseUrl : null,
    releaseName: typeof payload?.releaseName === 'string' ? payload.releaseName : null,
    updateAvailable: Boolean(payload?.updateAvailable),
    checkedAt: typeof payload?.checkedAt === 'string' ? payload.checkedAt : null,
    checkError: typeof payload?.checkError === 'string' ? payload.checkError : null,
    checking: Boolean(payload?.checking),
    updating: Boolean(payload?.updating),
    updateError: typeof payload?.updateError === 'string' ? payload.updateError : null,
    updatedAt: typeof payload?.updatedAt === 'string' ? payload.updatedAt : null,
    appliedTag: typeof payload?.appliedTag === 'string' ? payload.appliedTag : null,
    requiresRestart: Boolean(payload?.requiresRestart)
  };
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
  const response = await fetch('/api/system/update/status', { cache: 'no-store' });
  return parseUpdateResponse(response);
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const response = await fetch('/api/system/update/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return parseUpdateResponse(response);
}

export async function applyUpdate(): Promise<UpdateStatus> {
  const response = await fetch('/api/system/update/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return parseUpdateResponse(response);
}
