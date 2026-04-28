import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: any;
let adminToken = '';

beforeAll(async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-mobile-connect-test-'));
  process.env.API_ONLY = 'true';
  process.env.SYSTEM_DB_DIR = path.join(tempRoot, 'database');
  process.env.SYSTEM_STORAGE_DIR = path.join(tempRoot, 'storage');

  const serverModule = await import('../../server.cjs');
  app = serverModule.app;

  const boot = await request(app)
    .post('/api/auth/bootstrap')
    .send({ username: 'admin', password: 'AdminPass01' });
  expect([201, 409]).toContain(boot.status);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'AdminPass01' });

  expect(login.status).toBe(200);
  adminToken = String(login.body?.token || '');
  expect(adminToken).toBeTruthy();
});

describe('Mobile connect and maintenance API', () => {
  it('supports end-to-end mobile connect approval and API key usage', async () => {
    const initResponse = await request(app)
      .post('/api/mobile/connect/init')
      .send({
        appName: 'Digital Kiosk Mobile',
        platform: 'android',
        callbackUrl: ''
      });

    expect(initResponse.status).toBe(201);
    expect(initResponse.body?.ok).toBe(true);

    const requestId = String(initResponse.body?.requestId || '');
    const pollToken = String(initResponse.body?.pollToken || '');
    const state = String(initResponse.body?.state || '');

    expect(requestId).toBeTruthy();
    expect(pollToken).toBeTruthy();
    expect(state).toBeTruthy();

    const pendingStatus = await request(app)
      .get('/api/mobile/connect/status')
      .query({ requestId, pollToken });

    expect(pendingStatus.status).toBe(200);
    expect(pendingStatus.body?.status).toBe('pending');

    const approvalResponse = await request(app)
      .post('/api/mobile/connect/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('form')
      .send({ requestId, decision: 'approve' })
      .redirects(0);

    expect(approvalResponse.status).toBe(302);

    const approvedStatus = await request(app)
      .get('/api/mobile/connect/status')
      .query({ requestId, pollToken });

    expect(approvedStatus.status).toBe(200);
    expect(approvedStatus.body?.status).toBe('approved');

    const approvalCode = String(approvedStatus.body?.approvalCode || '');
    expect(approvalCode).toBeTruthy();

    const exchangeResponse = await request(app)
      .post('/api/mobile/connect/exchange')
      .send({ requestId, pollToken, approvalCode, state });

    expect(exchangeResponse.status).toBe(200);
    expect(exchangeResponse.body?.ok).toBe(true);

    const apiKey = String(exchangeResponse.body?.apiKey || '');
    expect(apiKey.startsWith('dk_live_')).toBe(true);

    const adminRequests = await request(app)
      .get('/api/mobile/connect/requests')
      .set('X-API-Key', apiKey);

    expect(adminRequests.status).toBe(200);
    expect(Array.isArray(adminRequests.body?.records)).toBe(true);
    expect(adminRequests.body.records.some((row: any) => String(row?.id) === requestId)).toBe(true);
  });

  it('enforces maintenance mode and allows toggling with API key auth', async () => {
    const initResponse = await request(app)
      .post('/api/mobile/connect/init')
      .send({
        appName: 'Maintenance Test App',
        platform: 'desktop',
        callbackUrl: ''
      });

    const requestId = String(initResponse.body?.requestId || '');
    const pollToken = String(initResponse.body?.pollToken || '');
    const state = String(initResponse.body?.state || '');

    await request(app)
      .post('/api/mobile/connect/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .type('form')
      .send({ requestId, decision: 'approve' })
      .redirects(0);

    const approvedStatus = await request(app)
      .get('/api/mobile/connect/status')
      .query({ requestId, pollToken });

    const approvalCode = String(approvedStatus.body?.approvalCode || '');

    const exchangeResponse = await request(app)
      .post('/api/mobile/connect/exchange')
      .send({ requestId, pollToken, approvalCode, state });

    const apiKey = String(exchangeResponse.body?.apiKey || '');
    expect(apiKey.startsWith('dk_live_')).toBe(true);

    const enableMaintenance = await request(app)
      .post('/api/system/maintenance/toggle')
      .set('X-API-Key', apiKey)
      .send({ enabled: true, reason: 'test-maintenance' });

    expect(enableMaintenance.status).toBe(200);
    expect(enableMaintenance.body?.enabled).toBe(true);

    const maintenanceStatus = await request(app)
      .get('/api/system/maintenance/status');

    expect(maintenanceStatus.status).toBe(200);
    expect(maintenanceStatus.body?.enabled).toBe(true);

    const blockedRoute = await request(app)
      .get('/api/layouts');

    expect(blockedRoute.status).toBe(503);
    expect(String(blockedRoute.body?.error || '')).toBe('maintenance-mode');

    const disableMaintenance = await request(app)
      .post('/api/system/maintenance/toggle')
      .set('X-API-Key', apiKey)
      .send({ enabled: false });

    expect(disableMaintenance.status).toBe(200);
    expect(disableMaintenance.body?.enabled).toBe(false);

    const restoredRoute = await request(app)
      .get('/api/layouts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(restoredRoute.status).toBe(200);
  });
});
