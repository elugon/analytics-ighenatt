import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CLIENTS, SITES } from '../src/lib/sites.ts';

const expected = {
  'salagraupera.com': {
    label: 'Sala Graupera',
    homepagePaths: ['/ca', '/es', '/en', '/fr'],
    sections: ['hero', 'about-who', 'about-what', 'about-where', 'catalogues', 'next-steps', 'closing'],
  },
  'lasose.com': {
    label: 'Lasose',
    homepagePaths: ['/en', '/es', '/fr', '/nl', '/ca'],
    sections: ['hero', 'search', 'selection', 'overview', 'testimonials', 'services', 'news'],
  },
  'pedroochoa.com': {
    label: 'Pedro Ochoa',
    homepagePaths: ['/', '/en'],
    sections: ['hero', 'featured', 'why-us', 'service-areas', 'faq', 'blog', 'cta'],
  },
  'taxfactory.es': {
    label: 'TaxFactory',
    homepagePaths: ['/', '/en'],
    sections: ['hero', 'gateway', 'narrative', 'differentiators', 'testimonials', 'urgency', 'closing'],
  },
  'wizeemind.com': {
    label: 'WizeeMind',
    homepagePaths: ['/', '/en'],
    sections: [
      'hero',
      'gateway',
      'pain',
      'demo',
      'capabilities',
      'proof',
      'team',
      'difference',
      'trust',
      'limits',
      'process',
      'closing',
    ],
  },
} as const;

describe('site catalog', () => {
  it('lists the five measured homepages, with Sala Graupera first', () => {
    assert.deepEqual(Object.keys(SITES), Object.keys(expected));
    assert.equal(Object.values(SITES)[0]?.id, 'salagraupera.com');
  });

  it('keeps homepage paths and section keys for each client', () => {
    for (const [id, site] of Object.entries(expected)) {
      const actual = SITES[id];
      assert.ok(actual);
      assert.equal(actual.label, site.label);
      assert.deepEqual(actual.homepagePaths, site.homepagePaths);
      assert.deepEqual(
        actual.sections.map((section) => section.key),
        site.sections
      );
    }
  });

  it('does not grant a client login by email', () => {
    assert.deepEqual(CLIENTS, {});
    assert.equal(SITES['example.com'], undefined);
  });
});
