function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.PLAYER_CONNECTION_KEY;

  if (!expectedKey) {
    return jsonResponse({ authorized: false, reason: 'PLAYER_CONNECTION_KEY non configurée' }, 503);
  }

  if (!key || key !== expectedKey) {
    return jsonResponse({ authorized: false, reason: 'Clé invalide' }, 401);
  }

  return jsonResponse({ authorized: true }, 200);
}
