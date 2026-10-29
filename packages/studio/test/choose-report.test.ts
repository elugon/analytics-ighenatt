import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chooseReport } from '../src/lib/choose-report.ts';
import { assembleReport } from '../src/lib/queries.ts';
import { SITES } from '../src/lib/sites.ts';
import type { Report } from '../src/lib/queries.ts';

function report(views: number): Report {
  return assembleReport(SITES['salagraupera.com'], {
    views,
    visitors: views,
    averageSeconds: 0,
    sectionCounts: new Map(views > 0 ? [['hero', views + 5]] : []),
    referrers: [],
    countries: [],
    devices: [],
  });
}

describe('chooseReport', () => {
  it('keeps D1 when it has more homepage views', () => {
    const measurement = report(55);
    assert.equal(chooseReport(report(4), measurement), measurement);
  });

  it('keeps Analytics Engine when it has more homepage views', () => {
    const analytics = report(88);
    assert.equal(chooseReport(analytics, report(0)), analytics);
  });

  it('returns the only report that exists', () => {
    const analytics = report(8);
    const measurement = report(55);
    assert.equal(chooseReport(analytics, null), analytics);
    assert.equal(chooseReport(null, measurement), measurement);
    assert.equal(chooseReport(null, null), null);
  });

  it('keeps D1 when both view counts match, including zero', () => {
    const measurement = report(0);
    assert.equal(chooseReport(report(0), measurement), measurement);
    const tied = report(12);
    assert.equal(chooseReport(report(12), tied), tied);
  });

  it('caps a section above 100 percent', () => {
    const chosen = report(1);
    assert.equal(chosen.sections[0]?.percent, 100);
    assert.equal(chosen.sections[0]?.count, 6);
  });
});
