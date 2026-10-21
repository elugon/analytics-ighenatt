import { describe, expect, it, vi } from 'vitest';
import { handleTrackV2 } from './track-v2';
import type { Env } from './env';
import { unstable_readConfig } from 'wrangler';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';

const body = {
  event_id: '12345678-1234-4234-8234-123456789012',
  event: 'pageview',
  path: '/ca',
  created_at: 123,
};
const request = (
  origin = 'https://www.salagraupera.com',
  value: unknown = body,
  ua = 'Mozilla/5.0'
) =>
  new Request('https://worker.test/track/v2', {
    method: 'POST',
    headers: { Origin: origin, 'User-Agent': ua },
    body: JSON.stringify(value),
  });
const env = () =>
  ({
    ALLOWED_ORIGINS: 'https://www.salagraupera.com',
    QUERY_API_KEY: 'test-salt',
    ANALYTICS: { writeDataPoint: vi.fn() },
    MEASUREMENT_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
  }) as unknown as Env;
describe('v2 reception', () => {
  it('disables retention in staging without dedicated measurement resources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'measurement-config-'));
    try {
      const config = join(directory, 'wrangler.toml');
      await writeFile(
        config,
        await readFile(new URL('../wrangler.toml.example', import.meta.url))
      );
      const production = unstable_readConfig(
        { config },
        { hideWarnings: true }
      );
      const staging = unstable_readConfig(
        { config, env: 'staging' },
        { hideWarnings: true }
      );
      expect(production.triggers.crons).toEqual(['17 3 * * *']);
      expect(production.d1_databases).toContainEqual(
        expect.objectContaining({ binding: 'MEASUREMENT' })
      );
      expect(staging.d1_databases).toEqual([]);
      expect(staging.triggers.crons).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('denies missing/foreign origins before reading or storing', async () => {
    expect(
      (await handleTrackV2(request('https://foreign.com'), env())).status
    ).toBe(403);
    expect(
      (
        await handleTrackV2(
          new Request('https://worker.test/track/v2', {
            method: 'POST',
            body: '{}',
          }),
          env()
        )
      ).status
    ).toBe(403);
  });
  it('rejects invalid events and oversized streams', async () => {
    expect((await handleTrackV2(request(undefined, null), env())).status).toBe(
      400
    );
    expect(
      (
        await handleTrackV2(
          request(undefined, { ...body, data: 'x'.repeat(9000) }),
          env()
        )
      ).status
    ).toBe(413);
  });
  it('does not acknowledge when the binding is missing or the transaction fails', async () => {
    const missing = env();
    expect((await handleTrackV2(request(), missing)).status).toBe(503);
    const broken = {
      ...env(),
      MEASUREMENT: {
        prepare() {
          throw new Error('database down');
        },
      },
    } as unknown as Env;
    const response = await handleTrackV2(request(), broken);
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('5');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://www.salagraupera.com'
    );
  });
  it('explicitly ignores bots without writing to legacy Analytics Engine', async () => {
    const bindings = env();
    const response = await handleTrackV2(
      request(undefined, body, 'Googlebot'),
      bindings
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      event_id: body.event_id,
      status: 'ignored',
    });
    expect(bindings.ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
  });
  it('rate limits the public site before any D1 write and exposes a retry interval', async () => {
    const bindings = {
      ...env(),
      MEASUREMENT_RATE_LIMITER: {
        limit: vi.fn(async () => ({ success: false })),
      },
    } as Env;
    const response = await handleTrackV2(request(), bindings);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(bindings.MEASUREMENT_RATE_LIMITER!.limit).toHaveBeenCalledWith({
      key: 'salagraupera.com',
    });
  });
});
