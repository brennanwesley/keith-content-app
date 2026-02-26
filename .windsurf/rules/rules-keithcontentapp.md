---
trigger: model_decision
---

### Frontend rules
- Use **App Router**.
- Organize by **features**, not only technical layers:
  - `/features/upload`
  - `/features/feed`
  - `/features/profile`
- UI components:
  - `/components` = reusable primitives (Button, Card, Modal)
  - `/features` = business UI (UploadPanel, FeedList)
- Data access:
  - All API calls go through `/lib/apiClient.ts`
  - No `fetch` scattered across random components
- State:
  - Prefer server components for read-only pages
  - Use TanStack Query (React Query) for feed/likes/comments caching
- Auth:
  - Supabase Auth client-side for session
  - Backend still enforces authorization for all protected ops

### Security
- Never expose Supabase `service_role` key. Only anon key in frontend env vars.
- Avoid rendering raw HTML from user content.
- Uploads: use signed URLs or a backend “init upload” endpoint.

---

## 5) API Design & Versioning
- Base path: choose one and stick to it:
  - Prefer `/v1` for longevity.
- Endpoints should be resource-based:
  - `POST /v1/videos/init-upload`
  - `POST /v1/videos/complete`
  - `GET /v1/feed`
  - `POST /v1/videos/:id/like`
- Every endpoint must define:
  - auth requirement
  - error codes
  - request/response schemas (shared contracts)

---

## 6) Video Pipeline Rules (MVP-first, scale-friendly)
- **Never** accept raw video uploads through backend process memory.
- MVP upload flow:
  1. Client requests upload init → backend issues signed upload URL (R2/S3) OR Mux direct upload
  2. Client uploads directly to storage/transcoder
  3. Backend receives callback / completion event
  4. Backend records metadata in Postgres
  5. Client consumes via CDN/playback URL

### MVP simplification
- If using **Mux**, use direct upload + playback IDs.
- Store only:
  - `owner_id`
  - `mux_asset_id` / `playback_id`
  - `duration`, `aspect_ratio`, `status`
  - `captions`, `topics`

---

## 7) Database Rules (Supabase/Postgres)
- Tables include:
  - `id` (uuid)
  - `created_at`, `updated_at`
  - `owner_id` for user-owned resources
- Use Supabase RLS from day 1 for user-owned tables.
- Avoid over-normalization early; keep tables understandable.
- Use migrations (SQL) stored in `/backend/migrations` (or `/supabase/migrations` if using Supabase CLI).

---

## 8) Environment Variables & Config
- Required env vars validated at startup.
- Provide `.env.example` in both apps.
- Typed config layer:
  - Backend: `@nestjs/config` + schema validation
  - Frontend: only `NEXT_PUBLIC_*` referenced in client code

---

## 9) Testing & “Don’t Break It” Rules
Minimum tests before adding major features:
- Backend:
  - smoke test: `/health`
  - one auth-protected endpoint test
- Frontend:
  - build must pass
  - optional: one test that “API health status displays correctly”

### CI (GitHub Actions)
- install, lint, typecheck, build for both frontend/backend
- run unit tests if present

---

## 10) Code Quality & Review Standards
- Lint: ESLint + Prettier (enforced).
- Every commit/PR must:
  - compile
  - pass lint
  - pass typecheck
- File size limits:
  - prefer <200 LOC per file
  - refactor if >300 LOC

---

## 11) Deployment Discipline (Render + Vercel)
- All deploy settings documented in:
  - `/infra/render.md`
  - `/infra/vercel.md`
- No manual “mystery settings.” Any non-default setting must be documented.
- Test environment separation:
  - separate Supabase project OR separate schema
  - separate storage bucket (R2/S3)
  - separate Mux environment keys

---

## 12) Data Privacy & Security Non-Negotiables
- Never store raw card data (Stripe only).
- Never log JWTs, cookies, or full request bodies containing secrets.
- Basic abuse controls early:
  - upload limits (size, type)
  - simple rate limiting
- Moderation hooks ready:
  - video status: `pending | ready | blocked`
  - allow admin override later

---

## 13) Documentation That Prevents Future Pain
Maintain:
- `/README.md` (local dev instructions)
- `/docs/decisions/*.md` (key choices and why)
- `/docs/api/*.md` (endpoint list + contracts)
- `/docs/runbooks/*.md` (deploy, rotate keys, debug)

---

## Cascade Standing Instruction
From now on, follow this **Engineering Rules of Engagement** exactly.  
If a requested change conflicts with these rules, raise it as a blocker and propose the smallest compliant alternative.