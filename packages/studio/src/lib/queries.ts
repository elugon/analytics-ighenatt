import type { PeriodDays, SiteConfig } from './sites';

export interface SqlBinding {
  query(input: { query: string }): Promise<{ data?: Record<string, unknown>[] }>;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function pathList(paths: readonly string[]): string {
  return paths.map(sqlString).join(', ');
}

async function rows(
  sql: SqlBinding,
  query: string
): Promise<Record<string, unknown>[]> {
  const result = await sql.query({ query });
  return result.data ?? [];
}

export interface SectionReach {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface Report {
  views: number;
  visitors: number;
  averageSeconds: number;
  sections: SectionReach[];
  referrers: NamedCount[];
  countries: NamedCount[];
  devices: NamedCount[];
}

export async function loadReport(
  sql: SqlBinding,
  site: SiteConfig,
  days: PeriodDays
): Promise<Report> {
  const window = `timestamp > NOW() - INTERVAL '${days}' DAY AND blob10 = ${sqlString(site.id)} AND blob1 IN (${pathList(site.homepagePaths)})`;

  const [viewRows, visitorRows, timingRows, sectionRows, referrerRows, countryRows, deviceRows] =
    await Promise.all([
      rows(
        sql,
        `SELECT SUM(double1) AS total FROM events.analyticsEngine.flarelytics WHERE ${window} AND blob4 = 'pageview'`
      ),
      rows(
        sql,
        `SELECT COUNT(DISTINCT blob9) AS total FROM events.analyticsEngine.flarelytics WHERE ${window} AND blob4 = 'pageview'`
      ),
      rows(
        sql,
        `SELECT AVG(double2) AS total FROM events.analyticsEngine.flarelytics WHERE ${window} AND blob4 = 'timing' AND double2 > 0`
      ),
      rows(
        sql,
        `SELECT blob5 AS section, SUM(double1) AS total FROM events.analyticsEngine.flarelytics WHERE ${window} AND blob4 = 'section_seen' GROUP BY section`
      ),
      rows(
        sql,
        `SELECT blob2 AS name, SUM(double1) AS total FROM events.analyticsEngine.flarelytics WHERE ${window} AND blob4 = 'pageview' GROUP BY name ORDER BY total DESC LIMIT 6`
      ),
      rows(
        sql,
        `SELECT blob3 AS name, SUM(double1) AS total FROM events.analyticsEngine.flarelytics WHERE ${window} AND blob4 = 'pageview' GROUP BY name ORDER BY total DESC LIMIT 6`
      ),
      rows(
        sql,
        `SELECT blob11 AS name, SUM(double1) AS total FROM events.analyticsEngine.flarelytics WHERE ${window} AND blob4 = 'pageview' GROUP BY name ORDER BY total DESC LIMIT 6`
      ),
    ]);

  const views = numberValue(viewRows[0]?.total);
  const counts = new Map(
    sectionRows.map((row) => [String(row.section ?? ''), numberValue(row.total)])
  );

  return {
    views,
    visitors: numberValue(visitorRows[0]?.total),
    averageSeconds: numberValue(timingRows[0]?.total),
    sections: site.sections.map((section) => {
      const count = counts.get(section.key) ?? 0;
      const percent = views > 0 ? Math.round((count / views) * 100) : 0;
      return {
        key: section.key,
        label: section.label,
        count,
        percent: Math.min(percent, 100),
      };
    }),
    referrers: referrerRows.map((row) => ({
      name: String(row.name || 'direct'),
      count: numberValue(row.total),
    })),
    countries: countryRows.map((row) => ({
      name: String(row.name || 'sin país'),
      count: numberValue(row.total),
    })),
    devices: deviceRows.map((row) => ({
      name: String(row.name || 'desconocido'),
      count: numberValue(row.total),
    })),
  };
}

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded <= 0) return '0 s';
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${rest} s`;
}
