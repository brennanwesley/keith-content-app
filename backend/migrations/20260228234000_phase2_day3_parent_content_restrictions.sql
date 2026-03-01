-- TeachTok Phase 2 Day 3.6 + 3.7:
-- Parent-managed content restrictions for linked child accounts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.parent_content_restrictions (
  parent_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content_type_id uuid NOT NULL REFERENCES public.content_types (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_user_id, child_user_id, content_type_id),
  CONSTRAINT parent_content_restrictions_distinct_users_chk
    CHECK (parent_user_id <> child_user_id)
);

CREATE INDEX IF NOT EXISTS parent_content_restrictions_child_idx
  ON public.parent_content_restrictions (child_user_id);

CREATE INDEX IF NOT EXISTS parent_content_restrictions_content_type_idx
  ON public.parent_content_restrictions (content_type_id);

DROP TRIGGER IF EXISTS set_parent_content_restrictions_updated_at ON public.parent_content_restrictions;
CREATE TRIGGER set_parent_content_restrictions_updated_at
BEFORE UPDATE ON public.parent_content_restrictions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.parent_content_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_content_restrictions_select_scoped ON public.parent_content_restrictions;
CREATE POLICY parent_content_restrictions_select_scoped
ON public.parent_content_restrictions
FOR SELECT
TO authenticated
USING (
  parent_user_id = auth.uid()
  OR child_user_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS parent_content_restrictions_insert_parent_or_admin ON public.parent_content_restrictions;
CREATE POLICY parent_content_restrictions_insert_parent_or_admin
ON public.parent_content_restrictions
FOR INSERT
TO authenticated
WITH CHECK (parent_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS parent_content_restrictions_update_parent_or_admin ON public.parent_content_restrictions;
CREATE POLICY parent_content_restrictions_update_parent_or_admin
ON public.parent_content_restrictions
FOR UPDATE
TO authenticated
USING (parent_user_id = auth.uid() OR public.is_admin())
WITH CHECK (parent_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS parent_content_restrictions_delete_parent_or_admin ON public.parent_content_restrictions;
CREATE POLICY parent_content_restrictions_delete_parent_or_admin
ON public.parent_content_restrictions
FOR DELETE
TO authenticated
USING (parent_user_id = auth.uid() OR public.is_admin());

COMMIT;
