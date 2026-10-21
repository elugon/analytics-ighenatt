# Durable homepage measurement

`POST /track/v2` stores accepted homepage events in a dedicated D1 database.
Studio reads only this database. New events are not mirrored to Analytics
Engine, and the historical Analytics Engine dataset is neither read nor deleted.
The legacy `/track`, dashboard, OIDC and other sites keep their existing paths.

## Receipt contract

The payload contains a UUID-v4 `event_id`, `event`, localized homepage `path`,
integer millisecond `created_at`, and the optional referrer/UTM/typed properties
defined by `@flarelytics/measurement`. Its parser is the contract owner. Bodies
are limited to 8 KiB. `section_seen` requires a known `props.section`; `timing`
requires integer seconds as a string, strictly between 0 and 3600.

Only an exact configured browser Origin can use v2. There is no browser API key
and no server-to-server v2 mode. Never put `QUERY_API_KEY` in the browser.

| HTTP            | JSON                            | Meaning                                                                     |
| --------------- | ------------------------------- | --------------------------------------------------------------------------- |
| 202             | `{event_id,status:"accepted"}`  | D1 committed the first event.                                               |
| 202             | `{event_id,status:"duplicate"}` | The same site/id/content was already committed.                             |
| 200             | `{event_id,status:"ignored"}`   | Bot classification; intentionally not counted.                              |
| 400/403/409/413 | `{error}`                       | Invalid event/origin, conflicting content, or oversized body. Do not retry. |
| 429/503         | `{error}` plus `Retry-After`    | Retry the identical event later.                                            |

The database unique key is `(site_id,event_id)`. Hash comparison and the first
reception's dimensions are immutable. The browser's creation date is diagnostic;
report windows use server reception time. A lost response is recoverable through
the same id: it cannot add another row within the retention window. No raw IP or
User-Agent is stored. The existing server HMAC computes the visitor-day identity.

Counts use pageviews; visitors use distinct daily hashes over the selected
period, not distinct people; time is the mean of positive timing segments.
Queries use bound parameters and half-open server-time windows. A database error
must remain an error, not an empty report. Studio authorizes with Access before
calling the shared read-only report interface; no public reporting route is added.

## Deployment prerequisites and order

This PR does not provision, migrate or deploy remote resources. The placeholder
database UUID in the configurations deliberately cannot identify production.

1. Verify the ingestion Worker and `flarelytics-studio` belong to the same
   Cloudflare account. Account identity was not verifiable during implementation;
   deployment is blocked until this is confirmed. Do not introduce a cross-account
   API as a workaround.
2. Create a dedicated `flarelytics-measurement` D1 database. Do not use
   `flarelytics-dimensions`. Replace the placeholder database UUID in the ingestion
   configuration and Studio with this same database's actual UUID. Keep preview
   and production databases isolated.
3. Apply `packages/measurement/migrations` through the ingestion Worker's
   `MEASUREMENT` binding. Use explicit `--local` for local tests; applying remote
   migrations is a separate deployment action.
4. Keep the existing visitor salt stable and verify the exact
   `https://www.salagraupera.com` origin is allowed. No wildcard or new apex origin
   is needed for the current production hostname.
5. Configure `MEASUREMENT_RATE_LIMITER` from the example. Verify namespace
   `2026102101` is unused by other services in the account; select a unique value
   if it is already allocated. It allows 1000 attempts/minute per site per
   Cloudflare location. Missing limiter/storage/salt fails v2 closed with 503.
6. Deploy and verify the receiver and Studio, then deploy the Sala Graupera
   client from the coordinated PR. Verify the same event can be retried and the
   report increments only once, using an isolated test environment.

Changing D1 reception revises the old hot-path decision **only for v2**. A new
event now depends on a synchronous D1 transaction and the primary database's
latency. Shared SQL is owned by the measurement package; `DIMENSIONS` remains
content metadata, and the old `/track` does not acquire a D1 dependency.

## Operation, limits and rollback

- Structured `measurement` logs distinguish accepted, duplicate, conflict,
  unavailable, and retention outcomes. Do not log full payloads, raw addresses,
  User-Agents or credentials. Investigate persistent 429/503 rates and retry growth.
- CORS is not proof of a human visitor: direct HTTP callers can spoof Origin and
  User-Agent. The site-wide rate binding limits bursts before D1 writes, but is
  approximate/per-location, not a global spend ceiling or fraud prevention.
  Monitor D1 writes/size/quotas and perimeter abuse before increasing limits.
- Events become eligible for deletion after 91 days. The 03:17 UTC daily job
  deletes at most 50 batches of 1000 rows. If expired rows remain it logs
  `backlog:true` as an error; investigate and schedule additional bounded cleanup
  runs. A missed job or backlog extends physical retention. Metadata retains the
  first acceptance date independently. Tests cover budget exhaustion and resume.
- Query rows scanned, write latency and database size must be checked under the
  site's actual traffic. There is no claim that one D1 database scales without a
  limit. The compound site/time index and retention index bound the normal work.
- Roll back by stopping the v2 client while keeping the database and receiver
  compatible with pending events. Do not switch the client silently to legacy
  `/track`, drop the database, or relabel AE history as the durable report.
- Browser outbox eligibility expires after 24 hours; physical deletion happens
  on next access if closed. Storage denial/transaction failure is explicitly
  degraded to memory. Clearing browser data, never returning, expiry or revocation
  can prevent an unaccepted event from arriving. A server receipt guarantees
  durable acceptance, not that every browser interaction will arrive.

## Verification

`npm run check` includes measurement domain/type checks, real local D1 concurrency,
receipt-loss and transaction-failure integration tests, legacy Worker tests,
Studio source tests and builds. Test D1 uses disposable local storage and no remote
credentials. On Windows the existing tracker build needs Git's `usr/bin` on PATH
for its pre-existing `mv` command. Do not bypass hooks or change that unrelated
build as part of this feature.

The two coordinated PRs must pass local verification, data QA, browser QA and CI
before merging. Production provisioning/deployment and merge remain separate.
