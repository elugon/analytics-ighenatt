import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowsLocalOwner, resolveViewer } from './access';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

afterEach(() => vi.unstubAllGlobals());
const config = {
  ACCESS_TEAM_DOMAIN: 'team.example.test',
  ACCESS_AUD: 'audience',
  OWNER_EMAILS: 'owner@example.test',
};
describe('Studio access remains a prerequisite to D1 reports', () => {
  it('keeps an unconfigured or unauthenticated view closed', async () => {
    const request = new Request('https://studio.test');
    expect(await resolveViewer(request, {})).toEqual({ status: 'locked' });
    expect(await resolveViewer(request, config)).toEqual({ status: 'denied' });
  });
  it('checks a real signature and audience before allowing an owner', async () => {
    const keys = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
    const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ keys: [{ ...publicKey, kid: 'test-key' }] })
      )
    );
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'RS256', kid: 'test-key' });
    const token = async (aud: string) => {
      const payload = encode({
        email: 'owner@example.test',
        aud,
        exp: Math.floor(Date.now() / 1000) + 60,
      });
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        keys.privateKey,
        new TextEncoder().encode(`${header}.${payload}`)
      );
      return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`;
    };
    const request = (jwt: string) =>
      new Request('https://studio.test', {
        headers: { 'cf-access-jwt-assertion': jwt },
      });
    expect(
      (await resolveViewer(request(await token('audience')), config)).status
    ).toBe('ok');
    expect(
      (await resolveViewer(request(await token('wrong')), config)).status
    ).toBe('denied');
    const jwt = await token('audience');
    expect(
      (await resolveViewer(request(jwt.slice(0, -4) + 'aaaa'), config)).status
    ).toBe('denied');
  });
  it('keeps the SSR report behind resolved access and uses only the D1 measurement binding', async () => {
    const source = await readFile(
      new URL('../pages/index.astro', import.meta.url),
      'utf8'
    );
    expect(source.indexOf('await resolveViewer')).toBeLessThan(
      source.indexOf('await loadSiteReport')
    );
    expect(source).toContain('if (site && !deniedSite)');
    expect(source).toContain('studio.MEASUREMENT');
    expect(source).toContain('loadAnalyticsReport');
  });
});

describe('local owner preview', () => {
  it('opens only a local request when the preview flag is set', () => {
    expect(allowsLocalOwner(new Request('http://127.0.0.1:8787/'), '1')).toBe(true);
    expect(allowsLocalOwner(new Request('http://analytics.ighenatt.es/'), '1')).toBe(true);
    expect(
      allowsLocalOwner(
        new Request('http://analytics.ighenatt.es/', { headers: { 'cf-ray': 'abc' } }),
        '1'
      )
    ).toBe(false);
    expect(allowsLocalOwner(new Request('https://analytics.ighenatt.es/'), '1')).toBe(false);
    expect(allowsLocalOwner(new Request('http://127.0.0.1:8787/'), undefined)).toBe(false);
  });

  it('does not treat the public host as a local owner', async () => {
    expect(
      await resolveViewer(new Request('https://analytics.ighenatt.es/'), {
        STUDIO_LOCAL_OWNER: '1',
      })
    ).toEqual({ status: 'locked' });
  });
});
