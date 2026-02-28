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
- [ ] Protect sensitive endpoints with authenticated user context.
- [ ] Stop trusting userId from client body for protected writes (derive from auth token).
- [ ] Add account_security_events writes for credential changes.

## Day 3 - Profiles, parent links, and category preferences
**Goal:** Complete account controls and family-link behavior.

### Build steps
- [ ] 3.1 Implement profile view/update for allowed fields.
- [ ] 3.2 Enforce immutable username after account creation.
- [ ] 3.3 Implement parent-child linking flows.
- [ ] 3.4 Support **optional** parent-linking for 13+ users.
- [ ] 3.5 Add learner category preference controls (interests/preferences).
- [ ] 3.6 Add parent controls to view and adjust child content preferences.

### Test and validation
- [ ] Parent can only access linked child data scope.
- [ ] Learner preference changes are saved and reflected in feed filters.
- [ ] Parent restrictions override learner preferences when conflicts exist.

### Daily sign-off
- [ ] Day 3 acceptance criteria met.
- [ ] Blockers documented.

---

## Day 4 - Content operations and Mux pipeline
**Goal:** Enable reliable admin content ingestion and publishing lifecycle.

### Build steps
- [ ] 4.1 Build admin content create/manage flow.
- [ ] 4.2 Enable multiple content-type tags per video.
- [ ] 4.3 Implement Mux direct upload flow.
- [ ] 4.4 Implement webhook handling for processing status updates.
- [ ] 4.5 Complete lifecycle handling (`draft -> processing -> ready`).

### Test and validation
- [ ] Admin can upload and publish content.
- [ ] Feed only returns `ready` content.
- [ ] Multi-tag assignment appears correctly in content queries.

### Daily sign-off
- [ ] Day 4 acceptance criteria met.
- [ ] Blockers documented.

---

## Day 5 - Feed quality, history, and analytics basics
**Goal:** Deliver a solid learner feed and measurable engagement baseline.

### Build steps
- [ ] 5.1 Integrate production playback source and preloading behavior.
- [ ] 5.2 Implement tag-based filtering and simple feed ordering.
- [ ] 5.3 Implement watch event ingestion (batched).
- [ ] 5.4 Build watch history grouped by content type.
- [ ] 5.5 Keep feed ranking strategy pluggable (lightweight scaffolding only, no ML).
- [ ] 5.6 Capture events needed for future personalization (lightweight scaffolding only, no ML).

### Test and validation
- [ ] Watch history is grouped correctly by content type.
- [ ] Engagement events persist and can be queried.
- [ ] Feed behavior is stable on desktop/mobile.

### Daily sign-off
- [ ] Day 5 acceptance criteria met.
- [ ] Blockers documented.

---

## Day 6 - Security and performance hardening
**Goal:** Reach week-1 production safety baseline.

### Build steps
- [ ] 6.1 Enforce password policy (min 10 + uppercase + lowercase + number).
- [ ] 6.2 Add baseline rate limiting on signup/login/consent endpoints.
- [ ] 6.3 Add core security headers and strict CORS allowlist.
- [ ] 6.4 Add audit logging for admin, consent, and profile changes.
- [ ] 6.5 Run baseline load/performance tests up to target usage.

### Test and validation
- [ ] Password policy validation works as expected.
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
- [ ] 7.2 Validate deploy, rollback, and key-rotation runbooks.
- [ ] 7.3 Finalize API, architecture, and ops documentation.
- [ ] 7.4 Perform release checklist review and go/no-go call.

### Test and validation
- [ ] Critical flows pass (auth, onboarding, feed, history, admin).
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
