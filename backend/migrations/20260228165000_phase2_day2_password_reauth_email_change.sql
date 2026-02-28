-- Phase 2 Day 2.4 interim policy shift:
-- no email verification service for now; password re-authentication is required for email changes.
-- Backfill existing auth users so sign-in is not blocked by missing email confirmation.

update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;
