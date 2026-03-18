import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, apiFetch } from '../../src/lib/api';

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON payloads on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, value: 42 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const payload = await apiFetch<{ ok: boolean; value: number }>('/api/test');
    expect(payload).toEqual({ ok: true, value: 42 });
  });

  it('returns text payloads when response is not json', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('plain-text', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      }),
    );

    const payload = await apiFetch<string>('/api/text');
    expect(payload).toBe('plain-text');
  });

  it('throws explicit errors on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('nope', {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'text/plain' },
      }),
    );

    await expect(apiFetch('/api/fail')).rejects.toThrow('API 400: nope');
  });

  it('sends JSON body for object payloads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await api.post('/api/create', { name: 'x' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('does not force JSON content-type for FormData payloads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const form = new FormData();
    form.append('file', new Blob(['hello']), 'hello.txt');

    await api.post('/api/assets', form);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
