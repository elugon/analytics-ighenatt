export interface SiteSection {
  key: string;
  label: string;
}

export interface SiteConfig {
  id: string;
  label: string;
  homepagePaths: readonly string[];
  sections: readonly SiteSection[];
}

export const SITES: Record<string, SiteConfig> = {
  'salagraupera.com': {
    id: 'salagraupera.com',
    label: 'Sala Graupera',
    homepagePaths: ['/ca', '/es', '/en', '/fr'],
    sections: [
      { key: 'hero', label: 'Hero' },
      { key: 'about-who', label: 'Quiénes somos' },
      { key: 'about-what', label: 'Qué hacemos' },
      { key: 'about-where', label: 'Hacia dónde vamos' },
      { key: 'catalogues', label: 'Catálogos' },
      { key: 'next-steps', label: 'Catálogo y visitas' },
      { key: 'closing', label: 'Cierre' },
    ],
  },
};

/** Email to site id. Owners are listed in OWNER_EMAILS, not here. */
export const CLIENTS: Record<string, string> = {};

export const PERIODS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIODS)[number];

export function isPeriod(value: number): value is PeriodDays {
  return PERIODS.includes(value as PeriodDays);
}
