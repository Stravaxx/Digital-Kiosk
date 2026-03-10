import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: any;

beforeAll(async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-logs-test-'));
  process.env.API_ONLY = 'true';
  process.env.SYSTEM_DB_DIR = path.join(tempRoot, 'database');
  process.env.SYSTEM_STORAGE_DIR = path.join(tempRoot, 'storage');

  const serverModule = await import('../../server.cjs');
  app = serverModule.app;
});

describe('Logs API', () => {
  it('creates, lists and deletes logs', async () => {
    const boot = await request(app)
      .post('/api/auth/bootstrap')
      .send({ username: 'admin', password: 'AdminPass01' });
    expect([201, 409]).toContain(boot.status);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'AdminPass01' });
    expect(login.status).toBe(200);
    const token = login.body?.token as string;

    const created = await request(app)
      .post('/api/logs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'system',
        level: 'info',
        source: 'test.logs',
        message: 'hello logs test'
      });

    expect(created.status).toBe(201);
    expect(created.body?.ok).toBe(true);

    const listed = await request(app)
      .get('/api/logs')
      .set('Authorization', `Bearer ${token}`)
      .query({ search: 'hello logs test' });
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body?.records)).toBe(true);
    expect(listed.body.records.length).toBeGreaterThan(0);

    const removed = await request(app)
      .delete('/api/logs')
      .set('Authorization', `Bearer ${token}`)
      .query({ type: 'system' });
    expect(removed.status).toBe(200);
    expect(removed.body?.ok).toBe(true);
  });
});
