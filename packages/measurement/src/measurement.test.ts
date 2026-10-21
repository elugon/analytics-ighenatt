import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import {
  acceptEvent,
  parseEvent,
  readReport,
  pruneEvents,
  runRetention,
  RETENTION_MS,
  SITES,
} from './index';

let proxy: Awaited<
  ReturnType<typeof getPlatformProxy<{ MEASUREMENT: D1Database }>>
>;
let db: D1Database;
const id = '12345678-1234-4234-8234-123456789012';
const payload = () => ({
  event_id: id,
  event: 'pageview',
  path: '/ca',
  created_at: 100,
  referrer: 'google.com',
});
const context = (now = 1000) => ({
  siteId: 'salagraupera.com',
  receivedAt: now,
  visitorId: 'daily-hash',
  country: 'ES',
  device: 'desktop',
});

beforeAll(async () => {
  proxy = await getPlatformProxy({
    configPath: fileURLToPath(
      new URL('../wrangler.test.json', import.meta.url)
    ),
    persist: false,
  });
  db = proxy.env.MEASUREMENT;
  const migration = await readFile(
    new URL('../migrations/0001_measurement.sql', import.meta.url),
    'utf8'
  );
  await db.exec(migration);
}, 30000);
afterAll(async () => {
  await proxy?.dispose();
});

describe('measurement contract', () => {
  it('rejects invalid ids, non-home paths, unexpected fields and invalid typed properties', () => {
    for (const value of [
      null,
      [],
      { ...payload(), event_id: 'bad' },
      { ...payload(), path: '/ca/blog' },
      { ...payload(), site: 'foreign.com' },
      { ...payload(), event: 'timing', props: { seconds: '-1' } },
      { ...payload(), event: 'section_seen', props: { section: 'unknown' } },
    ]) {
      expect(() => parseEvent(value, SITES['salagraupera.com'])).toThrow();
    }
  });
  it('canonicalizes object key order without changing event identity', () => {
    expect(parseEvent(payload(), SITES['salagraupera.com'])).toEqual(
      parseEvent(
        {
          referrer: 'google.com',
          created_at: 100,
          path: '/ca',
          event: 'pageview',
          event_id: id,
        },
        SITES['salagraupera.com']
      )
    );
  });
});

describe('real local D1', () => {
  it('accepts 100 concurrent retries once, preserves first metadata and rejects changed content', async () => {
    const event = parseEvent(payload(), SITES['salagraupera.com']);
    const receipts = await Promise.all(
      Array.from({ length: 100 }, () => acceptEvent(db, event, context()))
    );
    expect(receipts.filter((r) => r.status === 'accepted')).toHaveLength(1);
    expect(receipts.filter((r) => r.status === 'duplicate')).toHaveLength(99);
    expect(
      await acceptEvent(db, event, {
        ...context(2000),
        visitorId: 'other',
        country: 'FR',
      })
    ).toEqual({ event_id: id, status: 'duplicate' });
    await expect(
      acceptEvent(
        db,
        parseEvent(
          { ...payload(), referrer: 'other.com' },
          SITES['salagraupera.com']
        ),
        context()
      )
    ).rejects.toThrow('conflict');
    const report = await readReport(db, SITES['salagraupera.com'], 7, 3000);
    expect(report.views).toBe(1);
    expect(report.visitors).toBe(1);
    expect(report.startedAt).toBe(1000);
    expect(report.countries).toEqual([{ name: 'ES', count: 1 }]);
  });
  it('uses half-open server time windows and isolated sites', async () => {
    expect(
      (await readReport(db, SITES['salagraupera.com'], 7, 1000)).views
    ).toBe(0);
    expect(
      (
        await readReport(
          db,
          { ...SITES['salagraupera.com'], id: 'other.com' },
          7,
          3000
        )
      ).views
    ).toBe(0);
  });
  it('aggregates section reach and positive timing segments using the same source', async () => {
    await acceptEvent(
      db,
      parseEvent(
        {
          ...payload(),
          event_id: '12345678-1234-4234-8234-123456789013',
          event: 'section_seen',
          props: { section: 'hero' },
        },
        SITES['salagraupera.com']
      ),
      context(1100)
    );
    for (const [n, seconds] of [
      [14, '10'],
      [15, '20'],
    ] as const) {
      await acceptEvent(
        db,
        parseEvent(
          {
            ...payload(),
            event_id: `12345678-1234-4234-8234-1234567890${n}`,
            event: 'timing',
            props: { seconds },
          },
          SITES['salagraupera.com']
        ),
        context(1200)
      );
    }
    const report = await readReport(db, SITES['salagraupera.com'], 7, 3000);
    expect(report.sections[0]).toMatchObject({
      key: 'hero',
      count: 1,
      percent: 100,
    });
    expect(report.averageSeconds).toBe(15);
  });
  it('prunes only expired rows in bounded batches and retains the start date', async () => {
    expect(await pruneEvents(db, RETENTION_MS + 1000, 2)).toBe(0);
    expect(await pruneEvents(db, RETENTION_MS + 1001, 2)).toBe(1);
    expect(
      (await readReport(db, SITES['salagraupera.com'], 7, 3000)).startedAt
    ).toBe(1000);
  });
  it('does not acknowledge or return empty figures when storage fails', async () => {
    const broken = {
      prepare() {
        throw new Error('storage unavailable');
      },
    } as unknown as D1Database;
    await expect(
      acceptEvent(
        broken,
        parseEvent(payload(), SITES['salagraupera.com']),
        context()
      )
    ).rejects.toThrow('storage unavailable');
    await expect(
      readReport(broken, SITES['salagraupera.com'], 7, 3000)
    ).rejects.toThrow('storage unavailable');
  });
  it('reports a retention backlog when the batch budget is exhausted and can resume', async () => {
    expect(await runRetention(db, RETENTION_MS + 2000, 1, 2)).toEqual({
      deleted: 2,
      backlog: true,
    });
    expect(await runRetention(db, RETENTION_MS + 2000, 1, 2)).toEqual({
      deleted: 1,
      backlog: false,
    });
  });
});
