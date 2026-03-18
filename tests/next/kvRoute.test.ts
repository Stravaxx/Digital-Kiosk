import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '../../src/app/api/kv/[key]/route';

describe('Next KV route', () => {
  beforeEach(() => {
    process.env.API_BASE_URL = 'http://legacy.local:8787';
    vi.restoreAllMocks();
  });

  it('maps ds.events to ds.localEvents and reshapes payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ key: 'ds.localEvents', value: JSON.stringify([{ id: 'e1', title: 'Board' }]) }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const req = new NextRequest('http://localhost:4173/api/kv/ds.events', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ key: 'ds.events' }) });
    const payload = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://legacy.local:8787/api/system/kv/ds.localEvents');
    expect(payload).toEqual({ events: [{ id: 'e1', title: 'Board' }] });
  });

  it('normalizes ds.alerts state object into flat alerts array', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          key: 'ds.alerts.state',
          value: JSON.stringify({
            active: [{ id: 'a1', title: 'Overheat' }],
            history: [{ id: 'a2', title: 'Resolved', active: false }],
          }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const req = new NextRequest('http://localhost:4173/api/kv/ds.alerts', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ key: 'ds.alerts' }) });
    const payload = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Array.isArray(payload.alerts)).toBe(true);
    expect(payload.alerts).toHaveLength(2);
    expect(payload.alerts[0]).toMatchObject({ id: 'a1', active: true });
  });

  it('persists KV updates through /api/system/kv with serialized value', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:4173/api/kv/ds.rooms', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rooms: [{ id: 'r1', name: 'Salle A' }] }),
    });

    const res = await PUT(req, { params: Promise.resolve({ key: 'ds.rooms' }) });
    const payload = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://legacy.local:8787/api/system/kv/ds.rooms');
    expect(init.method).toBe('PUT');

    const sent = JSON.parse(String(init.body));
    expect(sent).toEqual({ value: JSON.stringify([{ id: 'r1', name: 'Salle A' }]) });
    expect(payload).toEqual({ ok: true });
    expect(res.status).toBe(200);
  });
});
