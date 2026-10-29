import type { MeasurementDatabase } from '@flarelytics/measurement';
import type { SqlBinding } from './analytics-report';

export interface StudioEnv {
  MEASUREMENT: MeasurementDatabase;
  ANALYTICS_SQL?: SqlBinding;
  OWNER_EMAILS?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  STUDIO_LOCAL_OWNER?: string;
}
