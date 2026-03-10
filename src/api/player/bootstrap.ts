function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get('deviceId');
  const token = url.searchParams.get('token');
  const key = url.searchParams.get('key');

  const expectedKey = process.env.PLAYER_CONNECTION_KEY;

  if (!deviceId || !token || !key) {
    return jsonResponse({ error: 'Paramètres requis manquants.' }, 400);
  }

  if (expectedKey && key !== expectedKey) {
    return jsonResponse({ error: 'Clé invalide.' }, 401);
  }

  return jsonResponse({
    screen: null,
    layout: null,
    note: 'Endpoint API moderne prêt. Le backend doit brancher la résolution réelle écran/layout.'
  }, 200);
}
