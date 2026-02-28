# TeachTok Build Plan - Phase 2 (Robust 1-Week Foundation)

## Document Purpose
This README is the execution blueprint for the next build phase.

- Scope: secure, scalable web app for first 100 users
- Audience: product, engineering, and operations
- Timebox: 7 days
- Principle: no shortcuts on security or data integrity

## Decisions Confirmed
Based on your latest direction:

1. Target audience includes users under 13 in the US.
2. Use direct learner accounts now, with parent-linked accounts as a core capability.
3. Email verification required for profile/settings access (not immediate playback gate for 13+ users).
4. Video provider: Mux.
5. Build in-app admin panel for you to manage content and view platform data.
6. Track watch history by content type tags.
7. Username cannot be edited after signup.
8. Exclude likes/comments.
9. Add subscription schema placeholders only (Stripe execution later).
10. US-only launch.
11. Week-1 auth abuse controls stay pragmatic: strict password complexity + baseline rate limiting now; advanced controls in the next phase.

## CTO Recommendation Summary

### Recommended Platform Stack
- Frontend: Next.js (existing)
- Backend API: NestJS on Render (existing)
- Auth + Database: Supabase (existing)
- Video ingestion + playback: Mux (new)
- Analytics storage: Postgres first, event warehouse later if needed

### Why this stack
- Fastest secure path in 1 week.
- Keeps architecture simple and extensible.
- Supports smooth streaming with Mux adaptive playback.
- Keeps sensitive authorization logic in backend control.

## Critical Product and Compliance Strategy (US, Under-13)

## Age and Consent Model (Recommended)
Implement an age-gated signup decision tree:

1. User enters birthdate (or month/year + day confirmation).
2. If user is 13+:
   - proceed with direct account flow
   - allow immediate content viewing after signup
   - require email verification for profile/settings and account recovery
3. If user is under 13:
   - collect parent/guardian email
   - create child account in `pending_parent_consent`
   - send parent consent link (signed, expiring token)
   - parent must approve before child can continue into full app

## Annual parental re-consent
Yes, this is a strong idea.

Plan:
- Consent record has `consent_expires_at` (1 year default).
- 30-day and 7-day reminder emails before expiration.
- If not renewed, account moves to `consent_expired_limited` (view-only or suspended based on policy).
- On renewal, log new consent event with policy version and timestamp.

Note: This is product/engineering planning, not legal advice. Before production launch to minors, confirm COPPA policy text and consent UX with counsel.

## Parent-Linked Account Strategy (High-Value Feature)

This is a strong differentiator and should be in the foundation now.

## Account hierarchy
- Parent account (full account owner)
- Child learner account(s)
- Link table supports one parent with multiple children

## Parent capabilities (v1)
1. View child watch history by content type
2. View weekly engagement summary
3. Set child content type preferences (allow/disable categories)
4. Optional watch-time guardrails (phase 2)

## Learner capabilities (v1)
1. Watch assigned/allowed content feed
2. View own progress summary by content type
3. No settings access if under 13 without active parent consent

## Core Architecture

## Frontend modules (App Router)
- `features/auth`
- `features/onboarding`
- `features/profile`
- `features/feed`
- `features/history`
- `features/admin`
- `features/parent`

All API calls continue through `frontend/lib/apiClient.ts`.

## Backend modules (NestJS `/v1`)
- `auth`
- `users`
- `profiles`
- `onboarding`
- `content`
- `engagement`
- `history`
- `parent`
- `admin`
- `billing` (placeholder schema + stubs)
- `mux`

## Database Design (Supabase/Postgres)

## Auth and identity
1. `auth.users` (managed by Supabase)
2. `public.profiles`
   - `id` uuid PK (matches auth user id)
   - `username` unique, immutable
   - `display_name`
   - `account_type` enum: `learner`, `parent`, `admin`
   - `email_verified_at` (mirror/derived)
   - `created_at`, `updated_at`

## Consent and family model
3. `public.parent_child_links`
   - `id`, `parent_user_id`, `child_user_id`, `relationship_status`
4. `public.parental_consents`
   - `id`, `child_user_id`, `parent_user_id` (nullable before account creation)
   - `parent_email`
   - `consent_status` enum: `pending`, `approved`, `rejected`, `expired`, `revoked`
   - `approved_at`, `expires_at`
   - `policy_version`
   - `ip_address`, `user_agent`
   - `token_hash`, `token_expires_at`
5. `public.age_gates`
   - `user_id`, `birthdate`, `calculated_age_at_signup`, `country_code`

## Content model
6. `public.content_types`
   - `id`, `slug`, `name`, `is_active`
7. `public.videos`
   - `id`, `title`, `description`, `status` (`draft`, `processing`, `ready`, `blocked`, `archived`)
   - `owner_id` (admin)
   - `duration_seconds`
   - `thumbnail_url`
   - timestamps
8. `public.video_content_types`
   - many-to-many mapping for tags
9. `public.video_assets`
   - `video_id`, `provider` (`mux`), `mux_asset_id`, `mux_playback_id`, `playback_policy`
   - `encoding_status`, `error_reason`

## Engagement and progress
10. `public.watch_events`
    - `id`, `user_id`, `video_id`, `event_type` (`play`, `pause`, `progress_25`, `progress_50`, `progress_75`, `complete`, `replay`)
    - `position_seconds`, `occurred_at`, `session_id`
11. `public.video_progress`
    - `user_id`, `video_id`, `last_position_seconds`, `completion_percent`, `completed_at`
12. `public.watch_sessions`
    - `session_id`, `user_id`, `video_id`, `started_at`, `ended_at`, `watch_seconds`
13. `public.engagement_daily_rollups`
    - `user_id`, `content_type_id`, `date`, `watch_seconds`, `completions`, `active_minutes`

## Subscription-ready placeholders
14. `public.billing_customers`
    - `user_id`, `stripe_customer_id`
15. `public.subscriptions`
    - `user_id`, `plan_code`, `status`, `current_period_end`

## RLS and Access Policies (Non-Negotiable)

Apply RLS to every user-owned table.

- Learner can access only own profile/history/progress.
- Parent can access linked child aggregated stats and allowed views.
- Admin role can manage content and view platform analytics.
- No direct client-side write access to sensitive admin tables.
- Service role key used only in backend.

## Video Pipeline (Mux)

## Admin ingestion flow
1. Admin opens `/admin/content`.
2. Admin creates content record with tags/content types.
3. Backend creates Mux direct upload URL.
4. Browser uploads directly to Mux (backend does not proxy large binaries).
5. Mux webhook updates asset status in backend.
6. Video becomes `ready` when asset + playback info is available.

## Playback flow
1. Feed request returns ready videos filtered by allowed content types.
2. Backend returns playback ID/token details.
3. Frontend player uses adaptive playback.
4. Next video metadata preloaded.
5. Engagement events streamed in batched calls.

## Smooth Playback Engineering Targets
- Time to first frame under 1.5s on stable mobile network.
- Rebuffer ratio under 2%.
- Playback error rate under 1%.
- 95th percentile feed API latency under 250ms.

## Onboarding and UX Plan

## 13+ flow
1. Signup: email, username, password
2. Basic onboarding step: choose content interests
3. Enter feed quickly
4. Profile/settings gated by email verification

## Under-13 flow
1. Age gate identifies under-13
2. Parent email collection screen
3. Parent consent email verification
4. Child account activation after approval
5. Parent-child link created

## Security Hardening Checklist

## Auth and account security
- Password policy: minimum 10 characters with at least one uppercase, one lowercase, and one number
- Baseline rate limiting on signup/login/consent endpoints (IP + account identifier scope, tuned to reduce onboarding friction)
- Session expiration and refresh policy
- Immutable username after creation
- Post-week-1 hardening (deferred unless abuse appears): breached-password denylist, temporary lockout/backoff, and bot challenge on signup/consent

## API and infra security
- Strict CORS allowlist
- Input validation at every API boundary
- Security headers (CSP, X-Frame-Options, etc.)
- Audit logging for admin, consent, profile updates
- No secrets in frontend

## Data protection
- Encrypt in transit (TLS) and rely on managed at-rest encryption
- Minimize PII storage
- Retention policy for events/logs
- Regular backup and restore drill

## Immediate security action
Rotate exposed development tokens/keys before production use (Supabase access token and Stripe secret key). Never keep live secrets in local config files that may be shared.

## Admin Panel Strategy

Admin should be role-based, not URL-secret based.

- Route: `/admin/*`
- Access: authenticated user with `account_type = admin`
- Features in week 1:
  1. Upload/manage videos
  2. Assign content type tags
  3. View processing status and failures
  4. View top engagement KPIs by content type
  5. User and consent overview (read-focused)

## 7-Day Execution Plan

## Day 1 - Foundation and schema
- Finalize ADRs for consent model, Mux integration, account hierarchy
- Implement migrations + RLS policies
- Add backend module scaffolding and shared contracts

Acceptance:
- Migrations apply cleanly
- RLS policies tested for learner/parent/admin cases

## Day 2 - Auth, age gate, consent core
- Build auth flows and age-gate screens
- Implement parent consent token/email workflow
- Persist consent records and statuses

Acceptance:
- Under-13 account cannot proceed without approved consent
- Consent status visible in backend/admin

## Day 3 - Profile and parent-child linking
- Profile endpoints and settings UI
- Immutable username enforcement
- Parent-child linking and parent read access to child summaries

Acceptance:
- Profile edit works for allowed fields only
- Parent account can view linked child data scope

## Day 4 - Content and Mux pipeline
- Admin content creation UI
- Mux direct upload + webhook integration
- Video readiness lifecycle (`draft -> processing -> ready`)

Acceptance:
- Admin can upload and publish content
- Feed only serves `ready` videos

## Day 5 - Feed quality and engagement analytics
- Integrate adaptive playback source
- Batch watch event ingestion
- Build watch history by content type endpoints/UI

Acceptance:
- Watch history grouped by content type
- Engagement events persisted and queryable

## Day 6 - Security + performance hardening
- Add baseline rate limiting (auth + consent), security headers, audit logs
- Load/perf test to 100 users baseline
- Bug fixes and operational runbooks

Acceptance:
- Security checks pass, including password complexity and auth/consent rate-limit verification
- 100-user test target met with acceptable latency/error rates

## Day 7 - Final QA and release prep
- End-to-end regression pass
- Deployment verification and rollback rehearsal
- Documentation completion

Acceptance:
- Production release checklist complete
- Incident/rollback and key rotation runbooks complete

## Scope Boundaries for This Week

In scope:
- Robust auth/profile/onboarding
- Under-13 parent consent framework
- Parent-child linked accounts (core)
- Mux video ingestion/playback
- Watch history and engagement by content type
- Admin panel v1

Out of scope:
- Likes/comments
- User video uploads
- Subscription billing execution (schema only)
- Recommendation ML system

## Key Risks and Mitigations
1. Consent/legal ambiguity for minors
   - Mitigation: strict consent state machine + versioned policy logs + legal review
2. Video processing edge cases
   - Mitigation: explicit processing state and retry workflows
3. Timeline pressure
   - Mitigation: freeze non-critical features and maintain daily acceptance gates
4. Security drift
   - Mitigation: mandatory hardening checklist before release

## Definition of Done (Week 1)
A release candidate is complete when:
1. Under-13 accounts require verified parental consent.
2. Parent can view linked child progress by content type.
3. Admin can upload/manage videos and see content/engagement status.
4. Learners have stable playback and watch history grouped by content type.
5. RLS, auth guards, rate limits, and audit logs are active.
6. Docs include architecture decisions, API references, and runbooks.

## Next-step enhancements (post-week-1)
1. Parent controls for time limits and schedule-based content filtering
2. Subscription activation using Stripe
3. Recommendation layer from engagement data
4. Curriculum progression framework per content type
5. Enhanced parent insights dashboard
6. Advanced auth abuse protections (breached-password checks, lockout/backoff tuning, bot challenge)
