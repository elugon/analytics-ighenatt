import { chooseReport } from './choose-report.ts';
import type { Report } from './queries.ts';

export async function loadSiteReport(sources: {
  analytics?: () => Promise<Report>;
  measurement?: () => Promise<Report>;
}): Promise<{ report: Report | null; failed: boolean }> {
  const jobs: Array<Promise<{ source: 'analytics' | 'measurement'; report: Report | null; failed: boolean }>> =
    [];

  if (sources.analytics) {
    const load = sources.analytics;
    jobs.push(
      load()
        .then((report) => ({ source: 'analytics' as const, report, failed: false }))
        .catch(() => ({ source: 'analytics' as const, report: null, failed: true }))
    );
  }
  if (sources.measurement) {
    const load = sources.measurement;
    jobs.push(
      load()
        .then((report) => ({ source: 'measurement' as const, report, failed: false }))
        .catch(() => ({ source: 'measurement' as const, report: null, failed: true }))
    );
  }

  if (jobs.length === 0) return { report: null, failed: true };

  const results = await Promise.all(jobs);
  const analytics = results.find((result) => result.source === 'analytics');
  const measurement = results.find((result) => result.source === 'measurement');

  return {
    failed: results.every((result) => result.failed),
    report: chooseReport(
      analytics && !analytics.failed ? analytics.report : null,
      measurement && !measurement.failed ? measurement.report : null
    ),
  };
}
