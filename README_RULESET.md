# TeachTok Engineering Ruleset (MVP)

Use this as the operating guide for coding agents and engineers building TeachTok.

## 1) Product North Star
- Build an MVP that feels as smooth and familiar as TikTok UX patterns, while focusing on **constructive, educational short-form content**.
- Optimize for fast iteration, measurable learning, and safety.
- Prioritize features that directly improve:
  1. creator upload success
  2. watch session quality
  3. trust & safety

## 2) Build Philosophy
- Ship in small, testable increments.
- Prefer simple solutions that are easy to change.
- Avoid speculative architecture; design for current needs with clear extension points.
- Every change should improve one of: reliability, speed, security, or developer velocity.

## 3) Monorepo Structure
Required top-level directories:
- `/frontend` — Next.js (TypeScript)
- `/backend` — NestJS (TypeScript)
- `/packages/shared` — shared contracts, schemas, constants (pure code only)
- `/docs` — architecture notes, API docs, runbooks
- `/infra` — deployment/environment setup docs

Rules:
- Frontend and backend must be independently deployable.
- No cross-imports between frontend and backend.
- Shared data contracts live in `packages/shared`.

## 4) Architecture Baseline
### Frontend (Next.js)
- Use App Router.
- Organize by features (`feed`, `upload`, `profile`, `auth`, `admin`).
- Use a single API client layer (`lib/apiClient`) for HTTP calls.
- Keep UI components reusable and small.

### Backend (NestJS)
- Feature modules under `src/modules/<feature>`.
- Keep controller/service/repository boundaries clear.
- Standard response and error shapes.
- Health endpoint remains unversioned: `GET /health`.

## 5) API & Contracts
- Version business APIs under `/v1`.
- Define request/response/error schemas first in shared contracts.
- Validate all external input at API boundaries.
- Return typed DTOs only.

## 6) Security Non-Negotiables
- Never commit secrets or tokens.
- Frontend uses only `NEXT_PUBLIC_*` vars.
- Backend verifies auth claims server-side (never trust client claims).
- Use CORS allowlist via environment variable.
- Apply rate limiting to auth and content creation endpoints.
- Never log JWTs, API keys, or sensitive payload data.

## 7) Data & Content Safety
- Plan for audience segmentation (adult/kids-safe experiences).
- Content lifecycle supports moderation states (`pending`, `ready`, `blocked`).
- Store minimal PII and follow least-privilege access.
- Design DB schema for ownership (`owner_id`) and auditability (`created_at`, `updated_at`).

## 8) Video Pipeline Principles
- Client uploads directly to storage/transcoding provider (signed URLs/direct upload).
- Backend coordinates upload sessions and stores metadata; do not proxy large video binaries through backend memory.
- Track processing state and failures explicitly.

## 9) Quality Standards
- TypeScript strict mode enabled.
- Lint + format enforced.
- Keep files small and cohesive.
- Avoid `any` unless documented and unavoidable.
- Add tests for critical paths (at minimum `/health`, auth guard behavior, and one feed/upload flow).

## 10) Delivery & Operations
- Every deploy setting must be documented in `infra/`.
- Use separate environments for local/dev/prod.
- Add runbooks for setup, rollback, key rotation, and incident basics.
- Observe key metrics (error rate, upload failures, API latency, watch completion).

## 11) Decision Discipline
- For impactful choices (auth, storage, schema, moderation, recommendation strategy), add a short ADR in `docs/decisions/`.
- ADR should include context, decision, alternatives, and consequences.

## 12) MVP Priority Order
1. Reliable auth + profile basics
2. Direct video upload + processing status
3. Feed playback + engagement actions
4. Moderation controls and reporting hooks
5. Performance tuning + analytics insights

---

## Working Agreement for Coding Agents
- Be practical, not theoretical.
- Make minimal safe changes that move the product forward.
- Explain tradeoffs briefly.
- Keep code and docs clean enough for the next engineer to ship fast.
