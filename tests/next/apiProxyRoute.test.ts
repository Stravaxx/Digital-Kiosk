import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../src/app/api/[...path]/route';

describe('Next API proxy route', () => {
  beforeEach(() => {
    process.env.API_BASE_URL = 'http://legacy.local:8787';
    vi.restoreAllMocks();
  });

  it('maps /api/admin/auth/* to /api/auth/* and forwards cookies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:4173/api/admin/auth/login?next=%2Fdashboard', {
      method: 'GET',
      headers: { cookie: 'ds_admin_token=abc123' },
    });

    const res = await GET(req, { params: Promise.resolve({ path: ['admin', 'auth', 'login'] }) });
    const payload = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://legacy.local:8787/api/auth/login?next=%2Fdashboard');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).cookie).toBe('ds_admin_token=abc123');
    expect(payload).toEqual({ ok: true });
  });

  it('forwards POST body and content-type to legacy API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, created: 1 }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:4173/api/logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });

    const res = await POST(req, { params: Promise.resolve({ path: ['logs'] }) });
    const payload = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://legacy.local:8787/api/logs');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ message: 'hello' }));
    expect(res.status).toBe(201);
    expect(payload).toEqual({ ok: true, created: 1 });
  });
});
