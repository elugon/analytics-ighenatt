import type { D1Database, D1Result } from '@cloudflare/workers-types';
import {
  EventConflict,
  RETENTION_MS,
  eventHash,
  type MeasurementEvent,
  type Receipt,
} from './model';

export interface ReceptionContext {
  siteId: string;
  receivedAt: number;
  visitorId: string;
  country: string;
  device: string;
}
function checked<T>(result: D1Result<T>): D1Result<T> {
  if (!result.success) throw new Error('Measurement storage failed');
  return result;
}

export async function acceptEvent(
  db: D1Database,
  event: MeasurementEvent,
  context: ReceptionContext
): Promise<Receipt> {
  const hash = await eventHash(event);
  const { siteId, receivedAt, visitorId, country, device } = context;
  // The unique constraint arbitrates competing requests; the SELECT observes
  // the winning immutable row in the same transaction, not a stale replica.
  const results = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `INSERT INTO measurement_events (site_id,event_id,body_hash,received_at,created_at,event_type,path,visitor_id,referrer,country,device,section_key,duration_seconds,utm_source,utm_medium,utm_campaign) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(site_id,event_id) DO NOTHING`
      )
      .bind(
        siteId,
        event.event_id,
        hash,
        receivedAt,
        event.created_at,
        event.event,
        event.path,
        visitorId,
        event.referrer === siteId || event.referrer === `www.${siteId}`
          ? 'direct'
          : event.referrer || 'direct',
        country,
        device,
        event.props?.section ?? null,
        event.props?.seconds ? Number(event.props.seconds) : null,
        event.utm_source ?? '',
        event.utm_medium ?? '',
        event.utm_campaign ?? ''
      ),
    db
      .prepare(
        'SELECT body_hash FROM measurement_events WHERE site_id = ? AND event_id = ?'
      )
      .bind(siteId, event.event_id),
    db
      .prepare(
        'INSERT INTO measurement_sites(site_id,started_at) SELECT site_id,received_at FROM measurement_events WHERE site_id = ? AND event_id = ? ON CONFLICT(site_id) DO NOTHING'
      )
      .bind(siteId, event.event_id),
  ]);
  results.forEach(checked);
  if (results[1].results[0]?.body_hash !== hash) throw new EventConflict();
  return {
    event_id: event.event_id,
    status: results[0].meta.changes === 1 ? 'accepted' : 'duplicate',
  };
}

export async function pruneEvents(
  db: D1Database,
  now = Date.now(),
  limit = 1000
): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new Error('Invalid retention batch');
  const result = checked(
    await db
      .prepare(
        'DELETE FROM measurement_events WHERE rowid IN (SELECT rowid FROM measurement_events WHERE received_at < ? ORDER BY received_at LIMIT ?)'
      )
      .bind(now - RETENTION_MS, limit)
      .run()
  );
  return result.meta.changes;
}

/** Bound scheduled work and make an incomplete cleanup observable. */
export async function runRetention(
  db: D1Database,
  now = Date.now(),
  maxBatches = 50,
  batchSize = 1000
): Promise<{ deleted: number; backlog: boolean }> {
  if (!Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > 50)
    throw new Error('Invalid retention budget');
  let deleted = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const count = await pruneEvents(db, now, batchSize);
    deleted += count;
    if (count < batchSize) return { deleted, backlog: false };
  }
  const remaining = await db
    .prepare(
      'SELECT 1 AS expired FROM measurement_events WHERE received_at < ? LIMIT 1'
    )
    .bind(now - RETENTION_MS)
    .first();
  return { deleted, backlog: remaining !== null };
}
