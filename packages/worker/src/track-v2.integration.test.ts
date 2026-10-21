import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { readReport, SITES } from '@flarelytics/measurement';
import worker from './index';
import type { Env } from './env';

let proxy: Awaited<
  ReturnType<typeof getPlatformProxy<Env & { MEASUREMENT: D1Database }>>
>;
let env: Env;
const id = '12345678-1234-4234-8234-123456789099';
const payload = {
  event_id: id,
  event: 'pageview',
  path: '/ca',
  created_at: 1,
  referrer: 'google.com',
};
const request = (body = payload) =>
  new Request('https://worker.test/track/v2', {
    method: 'POST',
    headers: {
      Origin: 'https://www.salagraupera.com',
      'User-Agent': 'Mozilla/5.0',
      'CF-Connecting-IP': '192.0.2.1',
    },
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  proxy = await getPlatformProxy<Env & { MEASUREMENT: D1Database }>({
    configPath: fileURLToPath(
      new URL('../../measurement/wrangler.test.json', import.meta.url)
    ),
    persist: false,
  });
  await proxy.env.MEASUREMENT.exec(
    await readFile(
      new URL(
        '../../measurement/migrations/0001_measurement.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  env = {
    ...proxy.env,
    ALLOWED_ORIGINS: 'https://www.salagraupera.com',
    QUERY_API_KEY: 'test-only-salt',
    MEASUREMENT_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
}, 30000);
afterAll(async () => {
  await proxy?.dispose();
});
describe('HTTP contract through the router and real D1', () => {
  it('recovers a lost response without duplicating the accepted event or changing its timestamp', async () => {
    const ctx = {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    } as ExecutionContext;
    const first = await worker.fetch(request(), env, ctx);
    expect(first.status).toBe(202);
    // The client never observes this first response: replay its exact snapshot.
    const next = await worker.fetch(request(), env, ctx);
    expect(next.status).toBe(202);
    expect(await next.json()).toEqual({ event_id: id, status: 'duplicate' });
    const report = await readReport(
      proxy.env.MEASUREMENT,
      SITES['salagraupera.com'],
      7,
      Date.now() + 1
    );
    expect(report.views).toBe(1);
    expect(report.startedAt).not.toBeNull();
    expect(
      (
        await worker.fetch(
          request({ ...payload, referrer: 'changed.com' }),
          env,
          ctx
        )
      ).status
    ).toBe(409);
  });
  it('returns 503 on an actual D1 transaction failure and stores no event', async () => {
    await proxy.env.MEASUREMENT.exec(
      "CREATE TRIGGER reject_test_event BEFORE INSERT ON measurement_events WHEN NEW.event_id = '12345678-1234-4234-8234-123456789098' BEGIN SELECT RAISE(ABORT,'test storage rejection'); END;"
    );
    const response = await worker.fetch(
      request({ ...payload, event_id: '12345678-1234-4234-8234-123456789098' }),
      env,
      {
        waitUntil() {},
        passThroughOnException() {},
        props: {},
      } as ExecutionContext
    );
    expect(response.status).toBe(503);
    const result = await proxy.env.MEASUREMENT.prepare(
      'SELECT COUNT(*) AS count FROM measurement_events'
    ).first<{ count: number }>();
    expect(result?.count).toBe(1);
  });
});
