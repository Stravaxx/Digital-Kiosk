export interface UpdateStatus {
  repo: string;
  currentVersion: string;
  latestVersion: string | null;
  latestTag: string | null;
  latestPublishedAt: string | null;
  releaseUrl: string | null;
  releaseName: string | null;
  releaseBody: string | null;
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

export interface BackgroundUpdateState {
  isRunning: boolean;
  currentStep: string;
  progress: number;
  timestamp: string | null;
  error: string | null;
  backupPath: string | null;
  backupDateTime: string | null;
  sourceType?: 'release' | 'branch' | null;
  sourceRef?: string | null;
  targetVersion?: string | null;
  steps?: Record<string, { order: number; label: string; weight: number }>;
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
    releaseBody: typeof payload?.releaseBody === 'string' ? payload.releaseBody : null,
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

export async function executeBackgroundUpdate(): Promise<BackgroundUpdateState> {
  const response = await fetch('/api/system/update/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || 'Impossible de démarrer la mise à jour en arrière-plan.'));
  }
  return {
    isRunning: Boolean(payload?.state?.isRunning),
    currentStep: String(payload?.state?.currentStep || 'idle'),
    progress: Number(payload?.state?.progress || 0),
    timestamp: typeof payload?.state?.timestamp === 'string' ? payload.state.timestamp : null,
    error: typeof payload?.state?.error === 'string' ? payload.state.error : null,
    backupPath: typeof payload?.state?.backupPath === 'string' ? payload.state.backupPath : null,
    backupDateTime: typeof payload?.state?.backupDateTime === 'string' ? payload.state.backupDateTime : null,
    sourceType: payload?.state?.sourceType === 'release' || payload?.state?.sourceType === 'branch' ? payload.state.sourceType : null,
    sourceRef: typeof payload?.state?.sourceRef === 'string' ? payload.state.sourceRef : null,
    targetVersion: typeof payload?.state?.targetVersion === 'string' ? payload.state.targetVersion : null,
    steps: payload?.state?.steps && typeof payload.state.steps === 'object' ? payload.state.steps : undefined
  };
}

export async function getBackgroundUpdateState(): Promise<BackgroundUpdateState> {
  const response = await fetch('/api/system/update/state', { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || 'Impossible de récupérer le statut de mise à jour.'));
  }
  return {
    isRunning: Boolean(payload?.isRunning),
    currentStep: String(payload?.currentStep || 'idle'),
    progress: Number(payload?.progress || 0),
    timestamp: typeof payload?.timestamp === 'string' ? payload.timestamp : null,
    error: typeof payload?.error === 'string' ? payload.error : null,
    backupPath: typeof payload?.backupPath === 'string' ? payload.backupPath : null,
    backupDateTime: typeof payload?.backupDateTime === 'string' ? payload.backupDateTime : null,
    sourceType: payload?.sourceType === 'release' || payload?.sourceType === 'branch' ? payload.sourceType : null,
    sourceRef: typeof payload?.sourceRef === 'string' ? payload.sourceRef : null,
    targetVersion: typeof payload?.targetVersion === 'string' ? payload.targetVersion : null,
    steps: payload?.steps && typeof payload.steps === 'object' ? payload.steps : undefined
  };
}
