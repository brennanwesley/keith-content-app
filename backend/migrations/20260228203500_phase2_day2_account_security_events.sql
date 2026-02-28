-- TeachTok Phase 2 Day 2.6 (phase 3 security hardening):
-- Add immutable audit trail for account credential changes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  ip_address inet,
  user_agent text,
  event_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_security_events_user_created_idx
  ON public.account_security_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS account_security_events_event_type_idx
  ON public.account_security_events (event_type, created_at DESC);

ALTER TABLE public.account_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_security_events_select_scoped ON public.account_security_events;
CREATE POLICY account_security_events_select_scoped
ON public.account_security_events
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS account_security_events_insert_scoped ON public.account_security_events;
CREATE POLICY account_security_events_insert_scoped
ON public.account_security_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin());

COMMIT;
