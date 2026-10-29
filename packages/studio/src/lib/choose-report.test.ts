import type { Report } from '@flarelytics/measurement';
import { describe, expect, it } from 'vitest';
import { chooseReport } from './choose-report';

function report(views: number): Report {
  return {
    views,
    visitors: views,
    averageSeconds: 0,
    startedAt: views > 0 ? 1 : null,
    sections: [],
    referrers: [],
    countries: [],
    devices: [],
  };
}

describe('chooseReport', () => {
  it('keeps D1 when it has more homepage views', () => {
    const measurement = report(55);
    expect(chooseReport(report(4), measurement)).toBe(measurement);
  });

  it('keeps Analytics Engine when it has more homepage views', () => {
    const analytics = report(88);
    expect(chooseReport(analytics, report(0))).toBe(analytics);
  });

  it('returns the only report that exists', () => {
    const analytics = report(8);
    const measurement = report(55);
    expect(chooseReport(analytics, null)).toBe(analytics);
    expect(chooseReport(null, measurement)).toBe(measurement);
    expect(chooseReport(null, null)).toBeNull();
  });

  it('keeps D1 when both view counts match', () => {
    const measurement = report(12);
    expect(chooseReport(report(12), measurement)).toBe(measurement);
    expect(chooseReport(report(0), report(0))?.views).toBe(0);
  });
});
