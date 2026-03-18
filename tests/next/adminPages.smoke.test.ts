import { describe, expect, it } from 'vitest';

const pages = [
  '../../src/app/(admin)/rooms/page',
  '../../src/app/(admin)/playlists/page',
  '../../src/app/(admin)/assets/page',
  '../../src/app/(admin)/layouts/page',
  '../../src/app/(admin)/templates/page',
  '../../src/app/(admin)/fleet/page',
  '../../src/app/(admin)/alerts/page',
  '../../src/app/(admin)/ops/page',
  '../../src/app/(admin)/logs/page',
  '../../src/app/(admin)/storage/page',
  '../../src/app/(admin)/dashboard/page',
  '../../src/app/(admin)/calendar/page',
  '../../src/app/(admin)/screens/page',
  '../../src/app/(admin)/settings/page',
  '../../src/app/login/page',
];

describe('admin and login pages (smoke)', () => {
  for (const modulePath of pages) {
    it(`exports a default component: ${modulePath}`, async () => {
      const mod = await import(modulePath);
      expect(typeof mod.default).toBe('function');
    });
  }
});
