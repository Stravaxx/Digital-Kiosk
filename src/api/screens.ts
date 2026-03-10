import { registerScreen } from '../services/screenService';
import type { ScreenRegistration } from '../services/screenService';

// Handler pour POST /api/screens/register
export async function POST(req: Request) {
  let data: Partial<ScreenRegistration> = {};
  try {
    data = await req.json() as Partial<ScreenRegistration>;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const safeData: ScreenRegistration = {
    deviceId: String(data.deviceId || '').trim(),
    hostname: String(data.hostname || '').trim(),
    resolution: String(data.resolution || '').trim(),
    os: String(data.os || '').trim(),
    version: String(data.version || '').trim() || 'unknown'
  };

  if (!safeData.deviceId) {
    return new Response(JSON.stringify({ error: 'deviceId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const screen = await registerScreen(safeData);
  return new Response(JSON.stringify({
    deviceToken: screen.deviceToken,
    playlistId: screen.playlistId,
    layoutId: screen.layoutId
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
