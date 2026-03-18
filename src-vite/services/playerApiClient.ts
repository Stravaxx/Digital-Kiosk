import { loadLayouts, type LayoutModel } from '../shared/layoutRegistry';
import { loadScreens, registerPendingScreen, type ScreenModel } from '../shared/screenRegistry';

export interface PlayerIdentityPayload {
  deviceId: string;
  token: string;
  deviceName: string;
}

export interface AuthorizeResult {
  authorized: boolean;
  source: 'api' | 'local-fallback';
}

export interface BootstrapResult {
  screen: ScreenModel | null;
  layout: LayoutModel | null;
  source: 'api' | 'local-fallback';
}

function findLocalScreen(deviceId: string): ScreenModel | null {
  return loadScreens().find((item) => item.deviceId === deviceId) ?? null;
}

function buildLocalBootstrap(deviceId: string): BootstrapResult {
  const screen = findLocalScreen(deviceId);
  const layouts = loadLayouts();
  const layout = screen?.layoutId ? layouts.find((item) => item.id === screen.layoutId) ?? null : null;
  return { screen, layout, source: 'local-fallback' };
}

export async function authorizePlayer(baseUrl: string, identity: PlayerIdentityPayload): Promise<AuthorizeResult> {
  try {
    const response = await fetch(
      `${baseUrl}/api/player/authorize?deviceId=${encodeURIComponent(identity.deviceId)}&token=${encodeURIComponent(identity.token)}`,
      { method: 'GET', cache: 'no-store' }
    );

    if (response.ok) {
      const payload = await response.json();
      return { authorized: Boolean(payload?.authorized), source: 'api' };
    }
  } catch {
    // fallback local
  }

  const localScreen = findLocalScreen(identity.deviceId);
  return {
    authorized: Boolean(localScreen && localScreen.status !== 'pending'),
    source: 'local-fallback'
  };
}

export async function bootstrapPlayer(baseUrl: string, identity: PlayerIdentityPayload): Promise<BootstrapResult> {
  try {
    const response = await fetch(
      `${baseUrl}/api/player/bootstrap?deviceId=${encodeURIComponent(identity.deviceId)}&token=${encodeURIComponent(identity.token)}`,
      { method: 'GET', cache: 'no-store' }
    );

    if (response.ok) {
      const payload = await response.json();
      return {
        screen: (payload?.screen as ScreenModel | null) ?? null,
        layout: (payload?.layout as LayoutModel | null) ?? null,
        source: 'api'
      };
    }
  } catch {
    // fallback local
  }

  return buildLocalBootstrap(identity.deviceId);
}

export async function sendPlayerHeartbeat(baseUrl: string, identity: PlayerIdentityPayload): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/player/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: identity.deviceId,
        token: identity.token,
        at: new Date().toISOString()
      })
    });
  } catch {
    // no-op in local fallback mode
  }
}

export async function submitPlayerEnrollment(baseUrl: string, identity: PlayerIdentityPayload): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/player/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: identity.deviceId,
        token: identity.token,
        devname: identity.deviceName
      })
    });

    return response.ok;
  } catch {
    registerPendingScreen({ token: identity.token, devname: identity.deviceName, deviceId: identity.deviceId });
    return true;
  }
}
