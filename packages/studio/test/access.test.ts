import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { allowsLocalOwner, resolveViewer } from '../src/lib/access.ts';

describe('local owner preview', () => {
  it('opens only for a local request when the local flag is set', () => {
    assert.equal(allowsLocalOwner(new Request('http://localhost:8787/'), '1'), true);
    assert.equal(allowsLocalOwner(new Request('http://127.0.0.1:8787/'), '1'), true);
    assert.equal(
      allowsLocalOwner(new Request('http://analytics.ighenatt.es/'), '1'),
      true
    );
    const edged = new Request('http://analytics.ighenatt.es/', {
      headers: { 'cf-ray': 'abc' },
    });
    assert.equal(allowsLocalOwner(edged, '1'), false);
    assert.equal(allowsLocalOwner(new Request('https://analytics.ighenatt.es/'), '1'), false);
    assert.equal(allowsLocalOwner(new Request('http://localhost:8787/'), '0'), false);
    assert.equal(allowsLocalOwner(new Request('http://localhost:8787/'), undefined), false);
  });

  it('resolves a local owner without Access configuration', async () => {
    const access = await resolveViewer(new Request('http://localhost:8787/'), {
      STUDIO_LOCAL_OWNER: '1',
    });
    assert.equal(access.status, 'ok');
    if (access.status !== 'ok') return;
    assert.equal(access.viewer.role, 'owner');
    assert.deepEqual(
      access.viewer.sites.map((site) => site.id),
      ['salagraupera.com', 'lasose.com', 'pedroochoa.com', 'taxfactory.es', 'wizeemind.com']
    );
  });

  it('ignores the local flag on the public host', async () => {
    const access = await resolveViewer(new Request('https://analytics.ighenatt.es/'), {
      STUDIO_LOCAL_OWNER: '1',
    });
    assert.equal(access.status, 'locked');
  });
});
