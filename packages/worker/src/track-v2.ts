import {
  acceptEvent,
  EventConflict,
  MAX_EVENT_BYTES,
  parseEvent,
  SITES,
} from '@flarelytics/measurement';
import { corsHeaders, fetchAllowedOrigins } from './cors';
import { isBot, visitorHash } from './track';
import { deviceType } from './ua';
import { readCappedBody } from './request-body';
import type { Env } from './env';

export async function handleTrackV2(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  let cors: Record<string, string> = { 'Cache-Control': 'no-store' };
  try {
    const allowed = await fetchAllowedOrigins(env);
    cors = {
      ...cors,
      ...corsHeaders(origin, allowed),
      'Access-Control-Expose-Headers': 'Retry-After',
      Vary: 'Origin',
    };
    if (!origin || !allowed.includes(origin))
      return Response.json(
        { error: 'Forbidden' },
        { status: 403, headers: cors }
      );
    const siteId = new URL(origin).hostname.replace(/^www\./, '');
    const site = SITES[siteId];
    if (!site)
      return Response.json(
        { error: 'Unsupported site' },
        { status: 403, headers: cors }
      );
    const text = await readCappedBody(request, MAX_EVENT_BYTES);
    if (text === null)
      return Response.json(
        { error: 'Payload Too Large' },
        { status: 413, headers: cors }
      );
    let event;
    try {
      event = parseEvent(JSON.parse(text), site);
    } catch {
      return Response.json(
        { error: 'Invalid measurement event' },
        { status: 400, headers: cors }
      );
    }
    const ua = request.headers.get('User-Agent') || '';
    if (isBot(ua))
      return Response.json(
        { event_id: event.event_id, status: 'ignored' },
        { headers: cors }
      );
    // Public analytics cannot authenticate a browser using CORS. Bound bursts
    // by site without retaining addresses or imposing a shared-IP identifier.
    if (!env.MEASUREMENT_RATE_LIMITER)
      throw new Error('Measurement limiter unavailable');
    if (!(await env.MEASUREMENT_RATE_LIMITER.limit({ key: siteId })).success) {
      return Response.json(
        { error: 'Measurement rate limited' },
        { status: 429, headers: { ...cors, 'Retry-After': '60' } }
      );
    }
    if (!env.MEASUREMENT) throw new Error('Measurement binding unavailable');
    if (!(env.VISITOR_SALT ?? env.QUERY_API_KEY))
      throw new Error('Visitor salt unavailable');
    const receivedAt = Date.now();
    const visitorId = await visitorHash(
      env,
      request.headers.get('CF-Connecting-IP') || '0.0.0.0',
      ua,
      siteId,
      receivedAt
    );
    const receipt = await acceptEvent(env.MEASUREMENT, event, {
      siteId,
      receivedAt,
      visitorId,
      country: (request.cf?.country as string) || 'XX',
      device: deviceType(ua),
    });
    console.log(
      JSON.stringify({
        component: 'measurement',
        status: receipt.status,
        site: siteId,
        event_id: event.event_id,
      })
    );
    return Response.json(receipt, { status: 202, headers: cors });
  } catch (error) {
    if (error instanceof EventConflict) {
      console.warn(
        JSON.stringify({ component: 'measurement', status: 'conflict' })
      );
      return Response.json(
        { error: 'event_id conflict' },
        { status: 409, headers: cors }
      );
    }
    console.error(
      JSON.stringify({ component: 'measurement', status: 'unavailable' })
    );
    return Response.json(
      { error: 'Measurement temporarily unavailable' },
      { status: 503, headers: { ...cors, 'Retry-After': '5' } }
    );
  }
}
