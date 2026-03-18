function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const devname = url.searchParams.get('devname');
  const deviceId = url.searchParams.get('deviceId');
  const key = url.searchParams.get('key');

  if (!token || !devname || !deviceId || !key) {
    return jsonResponse({ error: 'Paramètres requis manquants.' }, 400);
  }

  const expectedKey = process.env.PLAYER_CONNECTION_KEY;
  if (!expectedKey) {
    return jsonResponse({ error: 'PLAYER_CONNECTION_KEY non configurée côté API.' }, 503);
  }

  if (key !== expectedKey) {
    return jsonResponse({ error: 'Clé de connexion invalide.' }, 401);
  }

  return jsonResponse({
    ok: true,
    pendingScreen: {
      token,
      devname,
      deviceId,
      receivedAt: new Date().toISOString()
    }
  }, 200);
}
