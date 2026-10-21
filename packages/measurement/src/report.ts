import type { D1Database } from '@cloudflare/workers-types';
import { isPeriod, type PeriodDays, type SiteConfig } from './sites';

export interface NamedCount {
  name: string;
  count: number;
}
export interface SectionReach {
  key: string;
  label: string;
  count: number;
  percent: number;
}
export interface Report {
  views: number;
  visitors: number;
  averageSeconds: number;
  startedAt: number | null;
  sections: SectionReach[];
  referrers: NamedCount[];
  countries: NamedCount[];
  devices: NamedCount[];
}

/** Reads only; authorization belongs to the calling application. */
export async function readReport(
  db: D1Database,
  site: SiteConfig,
  days: PeriodDays,
  now = Date.now()
): Promise<Report> {
  if (!isPeriod(days)) throw new Error('Invalid report period');
  const start = now - days * 86400000;
  const where = `site_id = ? AND received_at >= ? AND received_at < ? AND path IN (${site.homepagePaths.map(() => '?').join(',')})`;
  const params = [site.id, start, now, ...site.homepagePaths];
  const query = (sql: string) => db.prepare(sql).bind(...params);
  const results = await db.batch<Record<string, unknown>>([
    query(
      `SELECT COUNT(CASE WHEN event_type='pageview' THEN 1 END) AS views, COUNT(DISTINCT CASE WHEN event_type='pageview' THEN visitor_id END) AS visitors, AVG(CASE WHEN event_type='timing' AND duration_seconds>0 THEN duration_seconds END) AS average_seconds FROM measurement_events WHERE ${where}`
    ),
    query(
      `SELECT section_key AS name, COUNT(*) AS total FROM measurement_events WHERE ${where} AND event_type='section_seen' GROUP BY section_key`
    ),
    ...['referrer', 'country', 'device'].map((column) =>
      query(
        `SELECT ${column} AS name, COUNT(*) AS total FROM measurement_events WHERE ${where} AND event_type='pageview' GROUP BY ${column} ORDER BY total DESC, name ASC LIMIT 6`
      )
    ),
    db
      .prepare('SELECT started_at FROM measurement_sites WHERE site_id = ?')
      .bind(site.id),
  ]);
  if (results.some((result) => !result.success))
    throw new Error('Measurement report failed');
  const totals = results[0].results[0] ?? {};
  const views = Number(totals.views ?? 0);
  const counts = new Map(
    results[1].results.map((row) => [String(row.name), Number(row.total)])
  );
  const named = (index: number) =>
    results[index].results.map((row) => ({
      name: String(row.name),
      count: Number(row.total),
    }));
  return {
    views,
    visitors: Number(totals.visitors ?? 0),
    averageSeconds: Number(totals.average_seconds ?? 0),
    startedAt: results[5].results[0]
      ? Number(results[5].results[0].started_at)
      : null,
    sections: site.sections.map((section) => {
      const count = counts.get(section.key) ?? 0;
      return {
        ...section,
        count,
        percent: views ? Math.min(100, Math.round((count / views) * 100)) : 0,
      };
    }),
    referrers: named(2),
    countries: named(3),
    devices: named(4),
  };
}
