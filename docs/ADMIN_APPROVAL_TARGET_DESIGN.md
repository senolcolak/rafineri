# Admin + Approval Target Design

## 1. Honest assessment of the current system

The current codebase has solid building blocks (NestJS API, Next.js admin UI, worker, Redis queues), but the admin and approval paths are not production-complete yet.

Critical gaps:

1. Approval is not persisted as first-class domain data.
2. Approval endpoints include mock/static responses for workflows and execution tracking.
3. Worker has an approval queue registration but no approval queue processor implementation.
4. Settings are stored in API memory and reset on restart.
5. Users management UI is mostly placeholder and has no real backend user model.
6. Auth contracts are inconsistent across guard/tests/client (`x-admin-token`, cookie, `Authorization` assumptions).
7. Validation and error contracts are inconsistent for admin mutations.

This means the current admin experience can look complete but is not reliably auditable or operationally safe.

## 2. Product-level goals

1. Admin area works end-to-end without placeholders.
2. Approval process is deterministic, auditable, retryable, and idempotent.
3. No decision is lost due to process crash or restart.
4. Clear ownership boundaries between API, worker, and UI.
5. Every admin action has event/audit traceability.

## 3. Architecture principles

1. API owns source of truth (Postgres).
2. Worker owns long-running and external-check orchestration.
3. Redis queue is transport only, never source of truth.
4. UI is a projection of persisted state, not orchestration logic.
5. Every transition is explicit via state machine.
6. All commands are idempotent and safe to retry.

## 4. Target domain model

Add these tables (Drizzle + migration):

1. `approval_requests`
2. `approval_steps`
3. `approval_decisions`
4. `admin_users`
5. `admin_sessions`
6. `system_settings`
7. `audit_logs`

### 4.1 `approval_requests`

Fields:

1. `id` (uuid, pk)
2. `story_id` (fk -> `stories.id`)
3. `status` (`queued`, `processing`, `awaiting_manual_review`, `approved`, `rejected`, `failed`, `cancelled`)
4. `priority` (int)
5. `idempotency_key` (unique)
6. `submitted_by` (fk -> `admin_users.id`, nullable for system)
7. `assigned_reviewer` (fk -> `admin_users.id`, nullable)
8. `final_confidence` (real, nullable)
9. `final_reason` (text, nullable)
10. `created_at`, `updated_at`, `started_at`, `completed_at`

Indexes:

1. `(status, priority, created_at)`
2. `(story_id, created_at desc)`
3. unique `(idempotency_key)`

### 4.2 `approval_steps`

Fields:

1. `id` (uuid, pk)
2. `request_id` (fk -> `approval_requests.id`)
3. `step_type` (`cross_check`, `ai_score`, `policy_gate`, `manual_review`)
4. `status` (`pending`, `running`, `passed`, `failed`, `skipped`)
5. `input_json` (jsonb)
6. `output_json` (jsonb)
7. `error_json` (jsonb)
8. `started_at`, `completed_at`, `duration_ms`

### 4.3 `approval_decisions`

Fields:

1. `id` (uuid, pk)
2. `request_id` (fk)
3. `decision` (`approved`, `rejected`, `escalated`)
4. `reason` (text)
5. `confidence` (real)
6. `decided_by` (fk -> `admin_users.id`, nullable for automated)
7. `source` (`automated`, `manual`)
8. `created_at`

## 5. Approval state machine (authoritative)

Transitions:

1. `queued -> processing`
2. `processing -> approved`
3. `processing -> rejected`
4. `processing -> awaiting_manual_review`
5. `awaiting_manual_review -> approved`
6. `awaiting_manual_review -> rejected`
7. `processing -> failed`
8. `failed -> queued` (retry)
9. `queued|processing -> cancelled`

Rules:

1. Only one active request per story unless previous request terminal.
2. Terminal states are immutable except via explicit retry command.
3. Transition writes are transactional with step/decision records.
4. Every transition emits one audit event.

## 6. Service boundaries

### 6.1 API (synchronous command/query)

Owns:

1. AuthN/AuthZ
2. Admin CRUD
3. Approval request creation/cancel/retry
4. Manual decision endpoints
5. Dashboard read models

Never does long-running cross-check orchestration inline on request threads.

### 6.2 Worker (asynchronous orchestration)

Owns:

1. Pulling approval jobs from queue
2. Executing cross-check + AI + policy steps
3. Writing step outputs and transitions
4. Requeue with capped retry and backoff

### 6.3 UI (read/write client)

Owns:

1. Command submission
2. Displaying persisted status
3. Manual review actions
4. Failure/retry UX

Never computes approval outcome itself.

## 7. API contracts (v1 target)

Add/normalize endpoints:

1. `POST /v1/admin/approval/requests`
2. `GET /v1/admin/approval/requests`
3. `GET /v1/admin/approval/requests/:id`
4. `POST /v1/admin/approval/requests/:id/retry`
5. `POST /v1/admin/approval/requests/:id/cancel`
6. `POST /v1/admin/approval/requests/:id/manual-decision`
7. `GET /v1/admin/approval/requests/:id/steps`

Response contract:

1. Keep single envelope shape: `{ success, data, meta?, timestamp }`
2. Use stable error body: `{ success:false, error:{ code, message, details? }, timestamp }`
3. Add request correlation id header for traceability.

## 8. Admin panel completion design

### 8.1 Dashboard

Metrics backed by DB queries + queue stats, not mock fallbacks:

1. pending approvals
2. processing approvals
3. approval SLA breach count
4. worker heartbeat freshness

### 8.2 Stories page

Requirements:

1. Server-side search/filter/pagination only.
2. Optimistic delete/update with rollback.
3. Route generation must respect custom admin path.

### 8.3 Sources page

Requirements:

1. Source toggles persist to DB and produce audit log entry.
2. Manual ingestion trigger creates queue job row + status.
3. Show last successful ingestion timestamp from persisted data.

### 8.4 Settings page

Requirements:

1. Replace in-memory settings with `system_settings`.
2. Versioned writes with optimistic concurrency (`version`).
3. History in `audit_logs`.

### 8.5 Users page

Requirements:

1. Real `admin_users` CRUD with hashed passwords and role-based permissions.
2. Session/token revocation support.
3. Role matrix (`admin`, `editor`, `reviewer`, `viewer`).

### 8.6 Approval page

Requirements:

1. Show request list + filters by status/age/assignee.
2. Show step timeline and evidence payloads.
3. Manual approve/reject with reason required.
4. Retry/cancel controls with server-side authorization.

## 9. Security design

1. Move from static token-only model to session-backed auth (`admin_sessions`).
2. Keep `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
3. Support token rotation and explicit session expiration.
4. Admin guard should support one canonical auth path (cookie) and optionally `Authorization: Bearer` for API clients.
5. All mutation endpoints require role checks.

## 10. Reliability and observability

SLOs:

1. Admin API success rate: 99.9%
2. Approval decision latency p95 < 120s (external APIs included)
3. No lost approval requests on restart

Metrics:

1. `approval_requests_total{status=...}`
2. `approval_step_duration_seconds{step_type=...}`
3. `approval_queue_lag_seconds`
4. `admin_mutation_failures_total{endpoint=...}`

Logs/traces:

1. Include `request_id`, `approval_request_id`, `story_id`, `admin_user_id`.
2. Structured error codes for client handling.

## 11. Testing strategy

### 11.1 API tests

1. Contract tests for every admin/approval endpoint.
2. Authorization matrix tests by role.
3. State transition invariant tests.

### 11.2 Worker tests

1. Deterministic step execution tests with mocked validators.
2. Retry/backoff/idempotency tests.
3. Crash-recovery test: job resumed without duplicate decisions.

### 11.3 E2E tests

1. Playwright admin login -> submit approval -> auto outcome.
2. Playwright manual-review flow.
3. Story/source/settings/users critical flows.

## 12. Implementation plan (execution order)

1. Foundation
   1. Add new schema + migrations.
   2. Implement `ApprovalRepository` and `SettingsRepository`.
2. Approval backend
   1. Replace mock approval endpoints with persisted request APIs.
   2. Add worker approval processor and state machine service.
3. Admin backend completion
   1. Implement users/auth/session modules.
   2. Replace in-memory settings with DB-backed settings.
4. Frontend completion
   1. Wire pages to real endpoints.
   2. Add robust loading/error/retry UX and route-path normalization.
5. Hardening
   1. Add contract/e2e tests and CI gates.
   2. Add dashboards/alerts for approval lag and failures.

## 13. Definition of done

The system is considered complete only when all are true:

1. No mock approval endpoints remain.
2. Approval lifecycle is fully persisted and auditable.
3. Worker processes approval queue and respects retries/idempotency.
4. Users/settings/sources/stories/admin dashboards are fully functional.
5. Critical admin and approval e2e tests pass in CI.
6. Recovery from API/worker restart loses zero approval requests.

