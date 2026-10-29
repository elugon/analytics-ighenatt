import { CLIENTS, SITES, type SiteConfig } from './sites';

export interface Viewer {
  email: string;
  role: 'owner' | 'client';
  sites: SiteConfig[];
}

interface AccessCerts {
  keys: (JsonWebKey & { kid?: string })[];
}

function ownerEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function bytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function jsonPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes(value))) as Record<
    string,
    unknown
  >;
}

async function emailFromAccessJwt(
  jwt: string,
  teamDomain: string,
  audience: string
): Promise<string | null> {
  const [headerPart, payloadPart, signaturePart] = jwt.split('.');
  if (!headerPart || !payloadPart || !signaturePart) return null;

  const header = jsonPart(headerPart);
  const payload = jsonPart(payloadPart);
  const aud = payload.aud;
  const audienceOk = Array.isArray(aud)
    ? aud.includes(audience)
    : aud === audience;
  const expires = typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  if (!audienceOk || expires < Date.now()) return null;
  if (typeof payload.email !== 'string') return null;

  const certs = (await fetch(`https://${teamDomain}/cdn-cgi/access/certs`).then(
    (response) => response.json()
  )) as AccessCerts;
  const jwk = certs.keys.find((key) => key.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    bytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  );
  return valid ? payload.email.toLowerCase() : null;
}

export function allowsLocalOwner(request: Request, flag: string | undefined): boolean {
  if (flag !== '1') return false;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
  // wrangler dev rewrites request.url to the custom domain. The local request
  // still arrives as http and without an edge ray.
  return url.protocol === 'http:' && request.headers.get('cf-ray') === null;
}

export async function resolveViewer(
  request: Request,
  env: {
    OWNER_EMAILS?: string;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    STUDIO_LOCAL_OWNER?: string;
  }
): Promise<
  { status: 'locked' } | { status: 'denied' } | { status: 'ok'; viewer: Viewer }
> {
  if (allowsLocalOwner(request, env.STUDIO_LOCAL_OWNER)) {
    return {
      status: 'ok',
      viewer: {
        email: 'local-owner',
        role: 'owner',
        sites: Object.values(SITES),
      },
    };
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { status: 'locked' };

  const jwt = request.headers.get('cf-access-jwt-assertion');
  if (!jwt) return { status: 'denied' };

  const email = await emailFromAccessJwt(
    jwt,
    env.ACCESS_TEAM_DOMAIN,
    env.ACCESS_AUD
  );
  if (!email) return { status: 'denied' };

  const allSites = Object.values(SITES);
  if (ownerEmails(env.OWNER_EMAILS).has(email)) {
    return {
      status: 'ok',
      viewer: { email, role: 'owner', sites: allSites },
    };
  }

  const site = SITES[CLIENTS[email] ?? ''];
  if (site) {
    return {
      status: 'ok',
      viewer: { email, role: 'client', sites: [site] },
    };
  }

  return { status: 'denied' };
}
