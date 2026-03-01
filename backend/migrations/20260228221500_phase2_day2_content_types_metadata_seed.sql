-- TeachTok Phase 2 Day 2.11:
-- Expand content type metadata and seed active catalog for dynamic selection UIs.

BEGIN;

ALTER TABLE public.content_types
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icon_key text,
  ADD COLUMN IF NOT EXISTS sort_order integer;

UPDATE public.content_types
SET
  description = COALESCE(NULLIF(btrim(description), ''), name),
  sort_order = COALESCE(sort_order, 1000);

ALTER TABLE public.content_types
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN sort_order SET DEFAULT 1000,
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS content_types_active_sort_idx
  ON public.content_types (is_active, sort_order, name);

WITH seed(slug, name, description, icon_key, sort_order, is_active) AS (
  VALUES
    ('youth-hockey', 'Youth Hockey', 'Skills and skating drills in short, practical clips.', NULL, 10, true),
    ('youth-soccer', 'Youth Soccer', 'Specialized training for growing skills.', NULL, 20, true),
    ('youth-piano', 'Beginner Piano', 'Practical tips for foundational learning.', NULL, 30, true),
    ('minecraft', 'Minecraft', 'Boost creativity with short focused tutorials.', NULL, 40, true)
),
updated AS (
  UPDATE public.content_types AS content_type
  SET
    name = seed.name,
    description = seed.description,
    icon_key = seed.icon_key,
    sort_order = seed.sort_order,
    is_active = seed.is_active,
    updated_at = now()
  FROM seed
  WHERE lower(content_type.slug) = seed.slug
  RETURNING seed.slug
)
INSERT INTO public.content_types (slug, name, description, icon_key, sort_order, is_active)
SELECT seed.slug, seed.name, seed.description, seed.icon_key, seed.sort_order, seed.is_active
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM updated
  WHERE updated.slug = seed.slug
);

COMMIT;
