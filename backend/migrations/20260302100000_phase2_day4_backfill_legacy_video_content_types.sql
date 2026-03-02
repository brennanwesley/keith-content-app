-- TeachTok Phase 2 Day 4.15:
-- One-time backfill so legacy video_content_types assignments remain usable
-- after admin flows move to content_tags/video_content_tags.

BEGIN;

-- Ensure each legacy content_type has at least one canonical content_tag.
-- Prefer the same UUID. If a tag already exists with the same slug, reuse that tag.
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
WHERE NOT EXISTS (
  SELECT 1
  FROM public.content_tags AS content_tag
  WHERE content_tag.id = content_type.id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.content_tags AS content_tag
  WHERE lower(content_tag.slug) = lower(content_type.slug)
)
ON CONFLICT (id) DO NOTHING;

-- Ensure canonical type->tag mappings exist so recommendation joins stay intact.
WITH canonical_type_tags AS (
  SELECT
    content_type.id AS content_type_id,
    COALESCE(content_tag_by_id.id, content_tag_by_slug.id) AS content_tag_id
  FROM public.content_types AS content_type
  LEFT JOIN public.content_tags AS content_tag_by_id
    ON content_tag_by_id.id = content_type.id
  LEFT JOIN LATERAL (
    SELECT content_tag.id
    FROM public.content_tags AS content_tag
    WHERE lower(content_tag.slug) = lower(content_type.slug)
    ORDER BY content_tag.created_at ASC
    LIMIT 1
  ) AS content_tag_by_slug ON true
)
INSERT INTO public.content_type_tag_mappings (
  content_type_id,
  content_tag_id,
  weight,
  created_at,
  updated_at
)
SELECT
  canonical_type_tags.content_type_id,
  canonical_type_tags.content_tag_id,
  1.0,
  now(),
  now()
FROM canonical_type_tags
WHERE canonical_type_tags.content_tag_id IS NOT NULL
ON CONFLICT (content_type_id, content_tag_id) DO NOTHING;

-- Backfill legacy video->content_type assignments into video_content_tags.
WITH canonical_type_tags AS (
  SELECT
    content_type.id AS content_type_id,
    COALESCE(content_tag_by_id.id, content_tag_by_slug.id) AS content_tag_id
  FROM public.content_types AS content_type
  LEFT JOIN public.content_tags AS content_tag_by_id
    ON content_tag_by_id.id = content_type.id
  LEFT JOIN LATERAL (
    SELECT content_tag.id
    FROM public.content_tags AS content_tag
    WHERE lower(content_tag.slug) = lower(content_type.slug)
    ORDER BY content_tag.created_at ASC
    LIMIT 1
  ) AS content_tag_by_slug ON true
)
INSERT INTO public.video_content_tags (video_id, content_tag_id, created_at)
SELECT
  video_content_type.video_id,
  canonical_type_tags.content_tag_id,
  video_content_type.created_at
FROM public.video_content_types AS video_content_type
JOIN canonical_type_tags
  ON canonical_type_tags.content_type_id = video_content_type.content_type_id
WHERE canonical_type_tags.content_tag_id IS NOT NULL
ON CONFLICT (video_id, content_tag_id) DO NOTHING;

COMMIT;
