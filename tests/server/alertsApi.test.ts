import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: any;
let adminToken = '';

beforeAll(async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-alerts-test-'));
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

describe('Alerts lifecycle API', () => {
  it('supports ack and silence lifecycle transitions for active alerts', async () => {
    const deviceId = `test-alert-${Date.now()}`;
    const token = `tok-${Date.now()}`;

    const enroll = await request(app)
      .post('/api/player/enroll')
      .send({ token, deviceId, devname: 'Alert Test Device', os: 'TestOS' });
    expect(enroll.status).toBe(200);

    const heartbeat = await request(app)
      .post('/api/player/heartbeat')
      .send({
        token,
        deviceId,
        os: 'TestOS',
        telemetry: {
          cpuPercent: 20,
          memoryPercent: 30,
          temperatureC: 95,
          diskUsedPercent: 60,
          heartbeatLatencyMs: 120,
          version: '1.0.0-test'
        }
      });

    expect(heartbeat.status).toBe(200);

    const alertsResponse = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(alertsResponse.status).toBe(200);
    const alerts = Array.isArray(alertsResponse.body?.alerts) ? alertsResponse.body.alerts : [];
    const targetAlert = alerts.find((item: any) => String(item?.screenId || '') && String(item.screenId).length > 0);
    expect(targetAlert).toBeTruthy();

    const ack = await request(app)
      .post(`/api/alerts/${encodeURIComponent(String(targetAlert.id))}/ack`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(ack.status).toBe(200);
    expect(ack.body?.ok).toBe(true);
    expect(String(ack.body?.alert?.status || '')).toBe('ack');

    const silence = await request(app)
      .post(`/api/alerts/${encodeURIComponent(String(targetAlert.id))}/silence`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ durationMinutes: 30 });

    expect(silence.status).toBe(200);
    expect(silence.body?.ok).toBe(true);
    expect(String(silence.body?.alert?.status || '')).toBe('silenced');

    const alertsAfterSilence = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(alertsAfterSilence.status).toBe(200);
    const visibleAlerts = Array.isArray(alertsAfterSilence.body?.alerts) ? alertsAfterSilence.body.alerts : [];
    expect(visibleAlerts.some((item: any) => String(item?.id || '') === String(targetAlert.id))).toBe(false);
  });
});
