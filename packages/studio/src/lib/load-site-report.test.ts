import type { Report } from '@flarelytics/measurement';
import { describe, expect, it } from 'vitest';
import { loadSiteReport } from './load-site-report';

function report(views: number): Report {
  return {
    views,
    visitors: views,
    averageSeconds: 0,
    startedAt: null,
    sections: [],
    referrers: [],
    countries: [],
    devices: [],
  };
}

describe('loadSiteReport', () => {
  it('uses the surviving source when the other throws', async () => {
    const measurement = report(55);
    const loaded = await loadSiteReport({
      analytics: () => Promise.reject(new Error('sql down')),
      measurement: () => Promise.resolve(measurement),
    });
    expect(loaded.failed).toBe(false);
    expect(loaded.report).toBe(measurement);
  });

  it('fails when every configured source fails, and when none is configured', async () => {
    const failed = await loadSiteReport({
      analytics: () => Promise.reject(new Error('sql down')),
      measurement: () => Promise.reject(new Error('d1 down')),
    });
    expect(failed).toEqual({ failed: true, report: null });
    expect(await loadSiteReport({})).toEqual({ failed: true, report: null });
  });
});
