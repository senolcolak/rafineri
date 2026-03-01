# Repository Guidelines

This document defines how AI agents and contributors should work in `rustchat`.

## Project Overview

Rustchat is a self-hosted collaboration platform with:
- Rust backend (`backend/`) using Axum + Tokio + SQLx
- Vue 3 + TypeScript frontend (`frontend/`)
- Push notification proxy service (`push-proxy/`)
- Compatibility layers for external clients (`/api/v4`, websocket, calls plugin routes)

## Communication Rules

- Respond to users in the same language they use.
- Keep code, comments, docs, commit messages, and PR text in English.
- Keep changes scoped to the request; do not bundle unrelated refactors.

## Compatibility-First Workflow (Mandatory)

Use this workflow for any change that can affect external client compatibility (API v4 routes, websocket events, pagination, error semantics, calls behavior):

1. Analyze upstream behavior first (read-only):
   - `../mattermost`
   - `../mattermost-mobile`
2. Create a new analysis folder: `previous-analyses/YYYY-MM-DD-<topic>/`
3. Start from templates in `previous-analyses/_TEMPLATE/`:
   - `SUMMARY.md`
   - `SERVER_FINDINGS.md`
   - `MOBILE_FINDINGS.md`
   - `GAP_PLAN.md`
4. Document exact contract details before coding:
   - HTTP status codes and response shape
   - Required headers and error payload semantics
   - Websocket event names and payload fields
5. Implement only after the gap is explicit and testable.

Rules:
- Never edit upstream reference repositories.
- Do not treat “close enough” behavior as compatible when clients depend on exact wire contracts.

## Repository Layout

- `backend/`: API server, websocket, persistence, compatibility endpoints
- `frontend/`: web client (feature-based architecture under `src/features`)
- `push-proxy/`: mobile push notification service
- `scripts/`: smoke tests and operational helpers
- `tools/mm-compat/`: compatibility extraction/report tooling
- `previous-analyses/`: compatibility research history
- `docker-compose.yml`: local multi-service development stack

## Build, Test, and Verification Commands

## Backend

```bash
cd backend
cargo fmt
cargo clippy --all-targets --all-features -- -D warnings
cargo check
cargo test --no-fail-fast -- --nocapture
```

If tests require local dependencies, start them first:

```bash
docker compose up -d postgres redis rustfs
```

## Frontend

```bash
cd frontend
npm ci
npm run build
```

Optional end-to-end tests:

```bash
npm run test:e2e
```

## Compatibility smoke checks

```bash
./scripts/mm_compat_smoke.sh
./scripts/mm_mobile_smoke.sh
```

## Full stack local run

```bash
cp .env.example .env
docker compose up -d --build
```

## Coding Standards

### Rust backend
- Prefer explicit `Result`-based error handling; avoid panics in production paths.
- Keep handlers thin; place logic in services/repositories.
- Preserve existing API contract shapes unless the task explicitly changes them.

### Frontend
- Keep feature boundaries intact (`core/` vs `features/`).
- Use typed API/client models; avoid introducing untyped payload handling.
- Maintain compatibility-sensitive event names and payload formats.

### Command Invocation Policy (Permanent)
- Rustchat uses command invocation via `Ctrl/Cmd+K` (desktop) and `^k` token (mobile/typed input).
- Do not introduce `/`-triggered slash command UX as the primary command entry path.
- Command discovery UX must be command-menu based and keyboard-first.
- If backward compatibility paths exist, keep them internal-only and never present `/` as the user-facing standard.

## Testing Expectations

- Every bug fix should include or update a regression test when feasible.
- For compatibility-sensitive changes, verify:
  - status codes
  - response/error schema
  - websocket events
  - pagination and ordering behavior
- If automated coverage is not possible, include explicit manual verification steps in the PR.

## Security and Configuration

- Never commit secrets or credential files.
- Required local secrets are enforced in compose:
  - `RUSTCHAT_JWT_SECRET`
  - `RUSTCHAT_ENCRYPTION_KEY`
- For production-like runs:
  - set `RUSTCHAT_ENVIRONMENT=production`
  - set `RUSTCHAT_CORS_ALLOWED_ORIGINS` explicitly

## Commit and Pull Request Guidelines

- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, etc.).
- Keep commit scope focused and reviewable.
- Before opening PR, run backend + frontend verification commands listed above.
- In PR description, list:
  - what changed
  - how it was verified
  - compatibility impact (if any)

## Important Reminders

- Do exactly what was requested: no speculative features.
- Prefer editing existing files over creating new ones.
- If you see unrelated issues, note them separately; do not silently fix them in the same change.
