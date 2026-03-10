function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { deviceId, token, devname, key } = body ?? {};
  const expectedKey = process.env.PLAYER_CONNECTION_KEY;

  if (!deviceId || !token || !devname || !key) {
    return jsonResponse({ error: 'Body incomplet.' }, 400);
  }

  if (expectedKey && key !== expectedKey) {
    return jsonResponse({ error: 'Clé invalide.' }, 401);
  }

  return jsonResponse({
    ok: true,
    enrollment: {
      deviceId,
      token,
      devname,
      status: 'pending',
      requestedAt: new Date().toISOString()
    }
  }, 200);
}
