# TeachTok Phase 2 - Execution Checklist (1 Week)

This checklist is a practical day-by-day guide for build execution.
Use it with `README_BUILD_PLAN.md` as the strategy source of truth.

## How to use this checklist
- Check off items as they are completed.
- Keep tasks high-level; do not block progress on perfect detail.
- If an unplanned task is security/data/blocker critical, do it and log it.
- End each day by confirming the **Daily sign-off** section.
- Build-step IDs use `Day.Step` format for quick reference (example: `1.4`).

---

## Day 1 - Foundation and schema
**Goal:** Get core architecture and data model ready with secure access boundaries.

### Build steps
- [x] 1.1 Confirm final scope, in-scope/out-of-scope boundaries, and day owners.
- [x] 1.2 Implement baseline database schema for profiles, consent, content, and engagement.
- [x] 1.3 Add/verify RLS policies for learner, parent, and admin access paths.
- [x] 1.4 Scaffold backend modules and shared API contracts for week-1 features.
- [x] 1.5 Validate environment variables and deployment config for frontend/backend.


### Test and validation
- [x] Migrations run cleanly in dev.
- [x] RLS checks pass for learner, parent, and admin scenarios.
- [x] Health checks and app boot are stable.

### Daily sign-off
- [x] Day 1 acceptance criteria met.
- [x] Blockers documented. (No Day 1 blockers)

---

## Day 2 - Auth, age gate, and parental consent core
**Goal:** Make account creation safe, simple, and policy-correct.

### Build steps
- [x] 2.1 Implement signup/login with required fields.
- [x] 2.2 Add age-gate decision flow (13+ vs under-13).
- [x] 2.3 Implement interim under-13 parent/guardian attestation modal workflow (no email service yet).
- [x] 2.4 Enforce password re-authentication gate for email changes (interim replacement for email verification service).
- [ ] 2.5 Capture consent status and consent timeline fields.

### Test and validation
- [x] Under-13 user cannot proceed without approved consent (interim attestation approval required).
- [x] 13+ user can access core learning flow after signup.
- [ ] Consent status is visible in admin/backoffice views.

### Daily sign-off
- [ ] Day 2 acceptance criteria met.
- [ ] Blockers documented.
### Additional Build Steps for Day 2
#### Phase 1 — Fix flow immediately (fast, high impact)
- [x] Split login vs signup post-submit behavior:
- [x] signup keeps onboarding
- [x] login goes directly to feed
- [x] Add content page Skip → feed button in same footer row style as Back.
- [x] Add feed header icon/button → settings page.
- [x] Edge case fallback: if an existing account is missing age-gate completion, require one-time age gate before feed.
#### Phase 2 — Enable real preferences
- [x] DB migration for user_content_preferences + RLS.
- [x] Backend endpoints:
- [x] GET /v1/content-types
- [x] GET /v1/me/content-preferences
- [x] PUT /v1/me/content-preferences
- [x] Settings page tabs:
- [x] Content Types
- [x] Account Profile (reuse password re-auth change-email flow)
- [x] Parent/Guardian Link (MVP placeholder + status first)
#### Phase 3 — Security hardening + audit
- [x] Protect sensitive endpoints with authenticated user context.
- [x] Stop trusting userId from client body for protected writes (derive from auth token).
- [x] Add account_security_events writes for credential changes.

#### Phase 4 — Demo/Auth split + scalable content-type platform (Approved Option 3)
- [x] 2.6 Route namespace split:
- [x] Add `/demo/content`, `/demo/feed/youth-hockey`, and `/demo/settings` for demo-only traffic.
- [x] Keep authenticated app routes (`/content`, `/feed/*`, `/settings`) isolated from demo flow.
- [x] 2.7 Route access controls + session boundaries:
- [x] Enforce auth guard behavior for authenticated routes and prevent cross-flow overlap.
- [x] Keep demo users stateless for account features (no profile writes, no preference persistence).
- [x] 2.8 Navigation updates:
- [x] Landing CTAs: `Create Account / Log In` and `Start Demo`.
- [x] Content footer left action changes from `Back to home` to `Account Settings`.
- [x] Demo settings route should show read-only/no-session account messaging.
- [x] 2.9 Settings IA simplification:
- [x] Reduce tabs to only `Content Types` and `Account Profile`.
- [x] Move parent/guardian into Account Profile as a status section below email change.
- [x] Parent/guardian section copy: `Connect a Parent/Guardian account by entering the email here:` with input-style placeholder `Feature coming soon!`.
- [x] 2.10 Sign-out behavior:
- [x] Sign-out must clear local auth session and redirect to landing page (`/`).
- [x] 2.11 Content type data model expansion (scalable foundation):
- [x] Add migration to extend `content_types` with descriptive fields (minimum `description`; optionally `sort_order`, `icon_key`).
- [x] Keep `is_active` as visibility control for whether a content type is selectable.
- [x] Seed active content types: `youth-hockey`, `youth-soccer`, `youth-piano`, `minecraft`.
- [x] 2.12 API and backend support:
- [x] Update `/v1/content-types` contract to return expanded content metadata.
- [x] Preserve authenticated persistence in `user_content_preferences` for created-account users only.
- [x] 2.13 Content selection UX behavior:
- [x] Render dynamic content cards from `/v1/content-types` (no hardcoded cards).
- [x] Allow multi-select on cards; clicking a card should toggle selection, not immediately redirect.
- [x] Add a primary `Start Learning` action that submits selected preferences for authenticated users.
- [x] Demo users can select/skip and proceed without saving account preferences.
- [x] 2.14 Settings content tab UX:
- [x] Show selected content types as pill badges.
- [x] Empty state (no selections): `No content types selected. Please select your preferred content.`
- [x] 2.15 Feed integration staging:
- [x] Keep current feed source unchanged for now (youth hockey clips) while finalizing content-type UX.
- [x] Defer video-to-content-type filtering integration to Day 4/Day 5 feed pipeline tasks.
- [x] 2.16 Validation and regression checks:
- [x] Verify demo and authenticated instances remain isolated across devices/sessions.
- [x] Verify no demo path writes to account-owned tables.
- [x] Verify sign-out redirect, settings tab behavior, and content preference save/load UX.

## Day 3 - Profiles, parent links, and category preferences
**Goal:** Finalize account controls and family-link behavior using Day 2 baseline work.

### Build steps
- [x] 3.1 Implement profile view/update for allowed fields (email update + password re-auth shipped).
- [x] 3.2 Enforce immutable username after account creation (username only set during signup; no update endpoint exposed).
- [x] 3.3 Implement parent-child linking flows (top priority; API + UI linking flow shipped).
- [x] 3.4 Support **optional** parent-linking for 13+ users (13+ users proceed via direct-access age-gate path).
- [x] 3.5 Add learner category preference controls (content-type preference selection + persistence shipped).
- [x] 3.6 Add parent controls to view and adjust child content preferences (top priority).
- [x] 3.7 Add effective preference resolver (`parent restriction wins`) with conflict handling.
- [x] 3.8 Add watch event contract + instrumentation bootstrap so data collection starts before full history UI.

### Test and validation
- [x] Parent can only access linked child data scope (covered by backend E2E: linked/unlinked and role-forbidden child restriction access cases).
- [ ] Learner preference changes are saved and reflected in feed filters (deferred: feed filtering integration is staged for Day 4/5).
- [x] Parent restrictions override learner preferences when conflicts exist (covered by backend E2E effective preference assertions).

### Daily sign-off
- [ ] Day 3 acceptance criteria met.
- [x] Blockers documented.

Blockers:
- Full "reflected in feed filters" validation depends on Day 4/5 feed filter integration work. Current Day 3 validation confirms preference persistence and effective preference contract only.

---

## Day 4 - Content operations and Mux pipeline
**Goal:** Enable reliable admin content ingestion and publishing lifecycle beyond schema scaffolding.

### Build steps
- [x] 4.1 Build admin content create/manage flow (admin video create/list/update API + frontend admin studio route shipped).
- [x] 4.2 Enable multiple content-type tags per video in API/admin flows (join-table assignments now handled on create/update).
- [ ] 4.3 Implement Mux direct upload flow (module/env scaffolding exists; upload APIs pending).
- [ ] 4.4 Implement webhook handling for processing status updates.
- [ ] 4.5 Complete lifecycle handling (`draft -> processing -> ready`) in backend workflows.
- [ ] 4.6 Dependency hardening: feed/video catalog IDs must come from backend (not static client IDs) to support reliable joins for watch history and analytics.

### Test and validation
- [ ] Admin can upload and publish content.
- [ ] Feed only returns `ready` content.
- [ ] Multi-tag assignment appears correctly in content queries.

### Daily sign-off
- [ ] Day 4 acceptance criteria met.
- [ ] Blockers documented.

---

## Day 5 - Feed quality, history, and analytics basics
**Goal:** Move from static demo feed behavior to data-driven feed quality and measurable engagement baseline.

### Build steps
- [ ] 5.1 Integrate production playback source and preloading behavior (current feed remains staged/static youth hockey clips).
- [ ] 5.2 Implement tag-based filtering and simple feed ordering.
- [ ] 5.3 Implement watch event ingestion (batched) against `watch_events`.
- [ ] 5.4 Build learner watch history grouped by content type.
- [ ] 5.5 Build parent child-history view and usage stats from watch/progress/session data.
- [ ] 5.6 Keep feed ranking strategy pluggable (lightweight scaffolding only, no ML).
- [ ] 5.7 Capture events needed for future personalization (lightweight scaffolding only, no ML).

### Test and validation
- [ ] Watch history is grouped correctly by content type.
- [ ] Engagement events persist and can be queried.
- [ ] Feed behavior is stable on desktop/mobile.

### Daily sign-off
- [ ] Day 5 acceptance criteria met.
- [ ] Blockers documented.

---

## Day 6 - Security and performance hardening
**Goal:** Close remaining security/performance gaps to reach week-1 production safety baseline.

### Build steps
- [x] 6.1 Enforce password policy (min 10 + uppercase + lowercase + number).
- [ ] 6.2 Add baseline rate limiting on signup/login/consent endpoints.
- [ ] 6.3 Add core security headers and strict CORS allowlist hardening (baseline CORS config exists).
- [ ] 6.4 Add audit logging for admin, consent, and profile changes (email-change events are already logged).
- [ ] 6.5 Run baseline load/performance tests up to target usage.
- [ ] 6.6 Harden parent/link/history endpoints (authorization boundaries, abuse protections, and regression tests).

### Test and validation
- [x] Password policy validation works as expected.
- [ ] Rate limiting activates on repeated auth/consent attempts.
- [ ] Latency/error rates are acceptable at target load.

### Daily sign-off
- [ ] Day 6 acceptance criteria met.
- [ ] Blockers documented.

---

## Day 7 - Release readiness and QA
**Goal:** Confirm end-to-end stability and release confidence.

### Build steps
- [ ] 7.1 Run end-to-end regression on critical user flows.
- [ ] 7.1a Execute QA matrix by role + age/compliance state (admin, parent, learner 13+, learner under-13).
- [ ] 7.2 Validate deploy, rollback, and key-rotation runbooks.
- [ ] 7.3 Finalize API, architecture, and ops documentation.
- [ ] 7.4 Perform release checklist review and go/no-go call.

### Test and validation
- [ ] Critical flows pass (auth, onboarding, feed/settings now; expand to history/admin as those modules ship).
- [ ] Deployment verification is complete.
- [ ] Rollback rehearsal is complete.

### Daily sign-off
- [ ] Day 7 acceptance criteria met.
- [ ] Release candidate approved.

---

## Out-of-scope guardrail (week 1)
- Likes/comments
- User-generated uploads
- Full recommendation ML system
- Subscription billing execution (schema placeholders only)

## Flex work log (unplanned but necessary)
Use this section daily for urgent items not explicitly listed above.

- Date:
- Issue:
- Why it was necessary:
- Impact:
- Follow-up:
