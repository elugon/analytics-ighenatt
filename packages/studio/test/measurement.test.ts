import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadSiteReport } from '../src/lib/load-site-report.ts';
import { measurementStatements } from '../src/lib/measurement.ts';
import { assembleReport, type Report } from '../src/lib/queries.ts';
import { SITES } from '../src/lib/sites.ts';

function report(label: string, views: number): Report {
  return assembleReport(SITES['lasose.com'], {
    views,
    visitors: views,
    averageSeconds: 1,
    sectionCounts: new Map(),
    referrers: [{ name: label, count: views }],
    countries: [],
    devices: [],
  });
}

describe('measurement statements', () => {
  it('binds the site id, paths and time instead of interpolating them', () => {
    const site = SITES['lasose.com'];
    const since = 1_700_000_000_000;
    const statements = measurementStatements(site, since);
    assert.equal(statements.length, 7);
    assert.deepEqual(
      statements.map((statement) => statement.params[1]),
      ['pageview', 'pageview', 'timing', 'section_seen', 'pageview', 'pageview', 'pageview']
    );
    for (const statement of statements) {
      assert.match(statement.sql, /site_id = \?/);
      assert.equal(statement.sql.includes('lasose.com'), false);
      assert.equal(statement.sql.includes('/en'), false);
      assert.equal(statement.params[0], 'lasose.com');
      assert.deepEqual(statement.params.slice(2, 7), [...site.homepagePaths]);
      assert.equal(statement.params.at(-1), since);
    }
    assert.match(statements[2]?.sql ?? '', /duration_seconds > 0/);
    assert.match(statements[3]?.sql ?? '', /section_key/);
  });
});

describe('loadSiteReport', () => {
  it('uses the surviving source when the other throws', async () => {
    const measurement = report('d1', 55);
    const loaded = await loadSiteReport({
      analytics: () => Promise.reject(new Error('sql down')),
      measurement: () => Promise.resolve(measurement),
    });
    assert.equal(loaded.failed, false);
    assert.equal(loaded.report, measurement);
  });

  it('fails when every configured source fails, and when none is configured', async () => {
    const failed = await loadSiteReport({
      analytics: () => Promise.reject(new Error('sql down')),
      measurement: () => Promise.reject(new Error('d1 down')),
    });
    assert.equal(failed.failed, true);
    assert.equal(failed.report, null);
    const missing = await loadSiteReport({});
    assert.equal(missing.failed, true);
    assert.equal(missing.report, null);
  });
});
