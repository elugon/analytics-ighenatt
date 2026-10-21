import type { SiteConfig } from './sites';

export const MAX_EVENT_BYTES = 8192;
export const RETENTION_MS = 91 * 24 * 60 * 60 * 1000;
export interface MeasurementEvent {
  event_id: string;
  event: 'pageview' | 'section_seen' | 'timing';
  path: string;
  created_at: number;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  props?: { section?: string; seconds?: string };
}
export interface Receipt {
  event_id: string;
  status: 'accepted' | 'duplicate';
}
export class EventConflict extends Error {
  constructor() {
    super('event_id conflict');
  }
}

const fields = new Set([
  'event_id',
  'event',
  'path',
  'created_at',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'props',
]);
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function invalid(): never {
  throw new Error('Invalid measurement event');
}

/** Fixed field order makes the hash independent of JSON object key order. */
export function parseEvent(value: unknown, site: SiteConfig): MeasurementEvent {
  if (!object(value) || Object.keys(value).some((key) => !fields.has(key)))
    invalid();
  if (
    typeof value.event_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value.event_id
    )
  )
    invalid();
  if (!['pageview', 'section_seen', 'timing'].includes(String(value.event)))
    invalid();
  if (
    typeof value.path !== 'string' ||
    !site.homepagePaths.includes(value.path)
  )
    invalid();
  if (
    typeof value.created_at !== 'number' ||
    !Number.isSafeInteger(value.created_at) ||
    value.created_at < 0
  )
    invalid();
  const event: MeasurementEvent = {
    event_id: value.event_id,
    event: value.event as MeasurementEvent['event'],
    path: value.path,
    created_at: value.created_at,
  };
  for (const key of [
    'referrer',
    'utm_source',
    'utm_medium',
    'utm_campaign',
  ] as const) {
    if (value[key] !== undefined) {
      if (
        typeof value[key] !== 'string' ||
        value[key].length > (key === 'referrer' ? 253 : 200)
      )
        invalid();
      if (
        key === 'referrer' &&
        value[key] !== 'direct' &&
        !/^[a-zA-Z0-9.-]+$/.test(value[key])
      )
        invalid();
      event[key] = value[key];
    }
  }
  if (event.event === 'pageview') {
    if (value.props !== undefined) invalid();
  } else {
    if (!object(value.props) || Object.keys(value.props).length !== 1)
      invalid();
    if (event.event === 'section_seen') {
      const key = value.props.section;
      if (
        typeof key !== 'string' ||
        !site.sections.some((section) => section.key === key)
      )
        invalid();
      event.props = { section: key };
    } else {
      const seconds = value.props.seconds;
      if (
        typeof seconds !== 'string' ||
        !/^\d+$/.test(seconds) ||
        Number(seconds) <= 0 ||
        Number(seconds) >= 3600
      )
        invalid();
      event.props = { seconds };
    }
  }
  return event;
}

export async function eventHash(event: MeasurementEvent): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(event));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
