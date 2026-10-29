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
  'lasose.com': {
    id: 'lasose.com',
    label: 'Lasose',
    homepagePaths: ['/en', '/es', '/fr', '/nl', '/ca'],
    sections: [
      { key: 'hero', label: 'Inicio' },
      { key: 'search', label: 'Búsqueda' },
      { key: 'selection', label: 'Selección' },
      { key: 'overview', label: 'Resumen' },
      { key: 'testimonials', label: 'Testimonios' },
      { key: 'services', label: 'Servicios' },
      { key: 'news', label: 'Noticias' },
    ],
  },
  'pedroochoa.com': {
    id: 'pedroochoa.com',
    label: 'Pedro Ochoa',
    homepagePaths: ['/', '/en'],
    sections: [
      { key: 'hero', label: 'Inicio' },
      { key: 'featured', label: 'Destacados' },
      { key: 'why-us', label: 'Por qué nosotros' },
      { key: 'service-areas', label: 'Zonas' },
      { key: 'faq', label: 'Preguntas' },
      { key: 'blog', label: 'Blog' },
      { key: 'cta', label: 'Contacto' },
    ],
  },
  'taxfactory.es': {
    id: 'taxfactory.es',
    label: 'TaxFactory',
    homepagePaths: ['/', '/en'],
    sections: [
      { key: 'hero', label: 'Inicio' },
      { key: 'gateway', label: 'Entrada' },
      { key: 'narrative', label: 'Narrativa' },
      { key: 'differentiators', label: 'Diferencias' },
      { key: 'testimonials', label: 'Testimonios' },
      { key: 'urgency', label: 'Urgencia' },
      { key: 'closing', label: 'Cierre' },
    ],
  },
  'wizeemind.com': {
    id: 'wizeemind.com',
    label: 'WizeeMind',
    homepagePaths: ['/', '/en'],
    sections: [
      { key: 'hero', label: 'Inicio' },
      { key: 'gateway', label: 'Entrada' },
      { key: 'pain', label: 'Problema' },
      { key: 'demo', label: 'Demostración' },
      { key: 'capabilities', label: 'Qué hace' },
      { key: 'proof', label: 'Prueba' },
      { key: 'team', label: 'Equipo' },
      { key: 'difference', label: 'Diferencia' },
      { key: 'trust', label: 'Confianza' },
      { key: 'limits', label: 'Límites' },
      { key: 'process', label: 'Proceso' },
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
