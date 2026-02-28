# Backend SQL Migrations

This folder stores schema and policy migrations for Supabase/Postgres.

## Current migration
- `20260227120000_phase2_day1_schema_rls.sql`
  - Creates baseline Phase 2 tables/enums/indexes
  - Adds helper triggers (immutable username + updated_at)
  - Enables RLS and applies learner/parent/admin policies
- `20260228023000_phase2_day2_interim_parental_attestation.sql`
  - Adds interim parental attestation metadata columns on `parental_consents`
  - Supports no-email parent/guardian attestation for under-13 onboarding

## Apply migration
Use one of the following:

1. Supabase SQL Editor
   - Open the SQL editor in Supabase
   - Paste migration SQL and run in your dev project first

2. Supabase CLI (if configured)
   - Place migration in your configured migrations directory
   - Run your normal migration apply command

Apply in timestamp order so Day 1 schema exists before Day 2.3 attestation updates.

## Verification checklist (post-apply)
- Tables created successfully with no SQL errors
- RLS enabled on all user-owned tables
- Learner can read/write only own records where intended
- Parent can read linked child progress/history views
- Admin can manage content and read platform data
