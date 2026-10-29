import { describe, expect, it } from 'vitest';
import { SITES } from './sites';

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

describe('measured homepages', () => {
  it('lists the five clients, with Sala Graupera first', () => {
    expect(Object.keys(SITES)).toEqual(Object.keys(expected));
    expect(Object.values(SITES)[0]?.id).toBe('salagraupera.com');
  });

  it('keeps the homepage paths and section keys', () => {
    for (const [id, site] of Object.entries(expected)) {
      const actual = SITES[id];
      expect(actual?.label).toBe(site.label);
      expect(actual?.homepagePaths).toEqual(site.homepagePaths);
      expect(actual?.sections.map((section) => section.key)).toEqual(site.sections);
    }
  });

  it('does not include an unknown hostname', () => {
    expect(SITES['example.com']).toBeUndefined();
  });
});
