import type { MeasurementDatabase } from '@flarelytics/measurement';

export interface StudioEnv {
  MEASUREMENT: MeasurementDatabase;
  OWNER_EMAILS?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}
