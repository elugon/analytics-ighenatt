CREATE TABLE measurement_events (site_id TEXT NOT NULL, event_id TEXT NOT NULL, body_hash TEXT NOT NULL, received_at INTEGER NOT NULL, created_at INTEGER NOT NULL, event_type TEXT NOT NULL CHECK (event_type IN ('pageview','section_seen','timing')), path TEXT NOT NULL, visitor_id TEXT NOT NULL, referrer TEXT NOT NULL, country TEXT NOT NULL, device TEXT NOT NULL, section_key TEXT, duration_seconds INTEGER, utm_source TEXT NOT NULL, utm_medium TEXT NOT NULL, utm_campaign TEXT NOT NULL, PRIMARY KEY (site_id,event_id));
CREATE INDEX measurement_events_site_time ON measurement_events(site_id,received_at,event_type);
CREATE INDEX measurement_events_retention ON measurement_events(received_at);
CREATE TABLE measurement_sites (site_id TEXT PRIMARY KEY, started_at INTEGER NOT NULL);
