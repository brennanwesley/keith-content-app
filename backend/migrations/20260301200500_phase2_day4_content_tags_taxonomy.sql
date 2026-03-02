-- TeachTok Phase 2 Day 4.9:
-- Introduce dedicated admin content-tag taxonomy and bridge mappings for recommendation flow.

BEGIN;

CREATE TABLE IF NOT EXISTS public.content_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_tags_slug_lower_idx
  ON public.content_tags (lower(slug));

CREATE INDEX IF NOT EXISTS content_tags_active_name_idx
  ON public.content_tags (is_active, name);

CREATE TABLE IF NOT EXISTS public.video_content_tags (
  video_id uuid NOT NULL REFERENCES public.videos (id) ON DELETE CASCADE,
  content_tag_id uuid NOT NULL REFERENCES public.content_tags (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, content_tag_id)
);

CREATE INDEX IF NOT EXISTS video_content_tags_content_tag_idx
  ON public.video_content_tags (content_tag_id);

CREATE TABLE IF NOT EXISTS public.content_type_tag_mappings (
  content_type_id uuid NOT NULL REFERENCES public.content_types (id) ON DELETE CASCADE,
  content_tag_id uuid NOT NULL REFERENCES public.content_tags (id) ON DELETE CASCADE,
  weight numeric(6,3) NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type_id, content_tag_id),
  CONSTRAINT content_type_tag_mappings_weight_positive_chk CHECK (weight > 0)
);

CREATE INDEX IF NOT EXISTS content_type_tag_mappings_content_tag_idx
  ON public.content_type_tag_mappings (content_tag_id);

CREATE INDEX IF NOT EXISTS content_type_tag_mappings_content_type_weight_idx
  ON public.content_type_tag_mappings (content_type_id, weight);

DROP TRIGGER IF EXISTS set_content_tags_updated_at ON public.content_tags;
CREATE TRIGGER set_content_tags_updated_at
BEFORE UPDATE ON public.content_tags
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_content_type_tag_mappings_updated_at ON public.content_type_tag_mappings;
CREATE TRIGGER set_content_type_tag_mappings_updated_at
BEFORE UPDATE ON public.content_type_tag_mappings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.content_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_content_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_type_tag_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_tags_select_authenticated ON public.content_tags;
CREATE POLICY content_tags_select_authenticated
ON public.content_tags
FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS content_tags_insert_admin_only ON public.content_tags;
CREATE POLICY content_tags_insert_admin_only
ON public.content_tags
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS content_tags_update_admin_only ON public.content_tags;
CREATE POLICY content_tags_update_admin_only
ON public.content_tags
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS content_tags_delete_admin_only ON public.content_tags;
CREATE POLICY content_tags_delete_admin_only
ON public.content_tags
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS video_content_tags_select_accessible_video ON public.video_content_tags;
CREATE POLICY video_content_tags_select_accessible_video
ON public.video_content_tags
FOR SELECT
TO authenticated
USING (public.can_access_video(video_id));

DROP POLICY IF EXISTS video_content_tags_insert_admin_only ON public.video_content_tags;
CREATE POLICY video_content_tags_insert_admin_only
ON public.video_content_tags
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS video_content_tags_update_admin_only ON public.video_content_tags;
CREATE POLICY video_content_tags_update_admin_only
ON public.video_content_tags
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS video_content_tags_delete_admin_only ON public.video_content_tags;
CREATE POLICY video_content_tags_delete_admin_only
ON public.video_content_tags
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS content_type_tag_mappings_select_authenticated ON public.content_type_tag_mappings;
CREATE POLICY content_type_tag_mappings_select_authenticated
ON public.content_type_tag_mappings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS content_type_tag_mappings_insert_admin_only ON public.content_type_tag_mappings;
CREATE POLICY content_type_tag_mappings_insert_admin_only
ON public.content_type_tag_mappings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS content_type_tag_mappings_update_admin_only ON public.content_type_tag_mappings;
CREATE POLICY content_type_tag_mappings_update_admin_only
ON public.content_type_tag_mappings
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS content_type_tag_mappings_delete_admin_only ON public.content_type_tag_mappings;
CREATE POLICY content_type_tag_mappings_delete_admin_only
ON public.content_type_tag_mappings
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Backfill from current content-type assignments so existing admin video metadata remains usable.
INSERT INTO public.content_tags (id, slug, name, description, is_active, created_at, updated_at)
SELECT
  content_type.id,
  content_type.slug,
  content_type.name,
  COALESCE(NULLIF(btrim(content_type.description), ''), content_type.name),
  content_type.is_active,
  now(),
  now()
FROM public.content_types AS content_type
ON CONFLICT (id) DO UPDATE
SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.video_content_tags (video_id, content_tag_id, created_at)
SELECT
  video_content_type.video_id,
  video_content_type.content_type_id,
  video_content_type.created_at
FROM public.video_content_types AS video_content_type
JOIN public.content_tags AS content_tag
  ON content_tag.id = video_content_type.content_type_id
ON CONFLICT (video_id, content_tag_id) DO NOTHING;

INSERT INTO public.content_type_tag_mappings (
  content_type_id,
  content_tag_id,
  weight,
  created_at,
  updated_at
)
SELECT
  content_type.id,
  content_type.id,
  1.0,
  now(),
  now()
FROM public.content_types AS content_type
JOIN public.content_tags AS content_tag
  ON content_tag.id = content_type.id
ON CONFLICT (content_type_id, content_tag_id) DO NOTHING;

COMMIT;
