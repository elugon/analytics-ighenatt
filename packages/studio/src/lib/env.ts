import type { MeasurementDb } from './measurement.ts';
import type { SqlBinding } from './queries.ts';

export interface StudioEnv {
  ANALYTICS_SQL?: SqlBinding;
  MEASUREMENT?: MeasurementDb;
  OWNER_EMAILS?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  STUDIO_LOCAL_OWNER?: string;
}
