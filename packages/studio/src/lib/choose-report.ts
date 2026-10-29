import type { Report } from './queries.ts';

/** Prefer the ledger with more homepage views. A tie keeps the D1 report. */
export function chooseReport(
  analytics: Report | null,
  measurement: Report | null
): Report | null {
  if (!analytics) return measurement;
  if (!measurement) return analytics;
  if (analytics.views > measurement.views) return analytics;
  return measurement;
}
