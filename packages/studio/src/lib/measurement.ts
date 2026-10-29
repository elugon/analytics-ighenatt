import type { PeriodDays, SiteConfig } from './sites.ts';
import {
  assembleReport,
  countValue,
  namedCounts,
  sectionCounts,
  type Report,
} from './queries.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BoundQuery {
  all(): Promise<{ results?: Record<string, unknown>[] }>;
}

export interface PreparedQuery {
  bind(...values: ReadonlyArray<string | number>): BoundQuery;
}

export interface MeasurementDb {
  prepare(sql: string): PreparedQuery;
}

export interface BoundSql {
  sql: string;
  params: Array<string | number>;
}

export function measurementSince(days: number, now: number): number {
  return now - days * DAY_MS;
}

function scoped(
  site: SiteConfig,
  since: number,
  eventType: string,
  extra = ''
): { filter: string; params: Array<string | number> } {
  const marks = site.homepagePaths.map(() => '?').join(', ');
  return {
    filter: `site_id = ? AND event_type = ? AND path IN (${marks}) AND received_at > ?${extra}`,
    params: [site.id, eventType, ...site.homepagePaths, since],
  };
}

export function measurementStatements(site: SiteConfig, since: number): BoundSql[] {
  if (site.homepagePaths.length === 0) return [];

  const pageviews = scoped(site, since, 'pageview');
  const timing = scoped(site, since, 'timing', ' AND duration_seconds > 0');
  const sections = scoped(site, since, 'section_seen');

  return [
    {
      sql: `SELECT COUNT(*) AS total FROM measurement_events WHERE ${pageviews.filter}`,
      params: pageviews.params,
    },
    {
      sql: `SELECT COUNT(DISTINCT visitor_id) AS total FROM measurement_events WHERE ${pageviews.filter}`,
      params: pageviews.params,
    },
    {
      sql: `SELECT AVG(duration_seconds) AS total FROM measurement_events WHERE ${timing.filter}`,
      params: timing.params,
    },
    {
      sql: `SELECT section_key AS section, COUNT(*) AS total FROM measurement_events WHERE ${sections.filter} GROUP BY section_key`,
      params: sections.params,
    },
    {
      sql: `SELECT referrer AS name, COUNT(*) AS total FROM measurement_events WHERE ${pageviews.filter} GROUP BY referrer ORDER BY total DESC LIMIT 6`,
      params: pageviews.params,
    },
    {
      sql: `SELECT country AS name, COUNT(*) AS total FROM measurement_events WHERE ${pageviews.filter} GROUP BY country ORDER BY total DESC LIMIT 6`,
      params: pageviews.params,
    },
    {
      sql: `SELECT device AS name, COUNT(*) AS total FROM measurement_events WHERE ${pageviews.filter} GROUP BY device ORDER BY total DESC LIMIT 6`,
      params: pageviews.params,
    },
  ];
}

async function read(
  db: MeasurementDb,
  statement: BoundSql
): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(statement.sql).bind(...statement.params).all();
  return result.results ?? [];
}

export async function loadMeasurement(
  db: MeasurementDb,
  site: SiteConfig,
  days: PeriodDays,
  now = Date.now()
): Promise<Report> {
  const statements = measurementStatements(site, measurementSince(days, now));
  if (statements.length === 0) {
    return assembleReport(site, {
      views: 0,
      visitors: 0,
      averageSeconds: 0,
      sectionCounts: new Map(),
      referrers: [],
      countries: [],
      devices: [],
    });
  }

  const [viewRows, visitorRows, timingRows, sectionRows, referrerRows, countryRows, deviceRows] =
    await Promise.all(statements.map((statement) => read(db, statement)));

  return assembleReport(site, {
    views: countValue(viewRows[0]?.total),
    visitors: countValue(visitorRows[0]?.total),
    averageSeconds: countValue(timingRows[0]?.total),
    sectionCounts: sectionCounts(sectionRows),
    referrers: namedCounts(referrerRows, 'direct'),
    countries: namedCounts(countryRows, 'sin país'),
    devices: namedCounts(deviceRows, 'desconocido'),
  });
}
