-- TeachTok Phase 2 Day 2.5 (phase 2 execution):
-- Persist learner content type preferences for feed personalization and settings controls.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_content_preferences (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content_type_id uuid NOT NULL REFERENCES public.content_types (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_type_id)
);

CREATE INDEX IF NOT EXISTS user_content_preferences_content_type_idx
  ON public.user_content_preferences (content_type_id);

DROP TRIGGER IF EXISTS set_user_content_preferences_updated_at ON public.user_content_preferences;
CREATE TRIGGER set_user_content_preferences_updated_at
BEFORE UPDATE ON public.user_content_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_content_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_content_preferences_select_scoped ON public.user_content_preferences;
CREATE POLICY user_content_preferences_select_scoped
ON public.user_content_preferences
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS user_content_preferences_insert_scoped ON public.user_content_preferences;
CREATE POLICY user_content_preferences_insert_scoped
ON public.user_content_preferences
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS user_content_preferences_update_scoped ON public.user_content_preferences;
CREATE POLICY user_content_preferences_update_scoped
ON public.user_content_preferences
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS user_content_preferences_delete_scoped ON public.user_content_preferences;
CREATE POLICY user_content_preferences_delete_scoped
ON public.user_content_preferences
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

COMMIT;
