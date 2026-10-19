import type { SqlBinding } from './queries';

export interface StudioEnv {
  ANALYTICS_SQL: SqlBinding;
  OWNER_EMAILS?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}
