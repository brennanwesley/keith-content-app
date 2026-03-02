-- TeachTok Phase 2 Day 4.12:
-- Keep status transitions flexible while excluding untagged ready videos from non-admin access paths.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_video(
  p_video_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.videos v
      WHERE v.id = p_video_id
        AND v.status = 'ready'::public.video_status
        AND EXISTS (
          SELECT 1
          FROM public.video_content_tags video_content_tag
          JOIN public.content_tags content_tag
            ON content_tag.id = video_content_tag.content_tag_id
          WHERE video_content_tag.video_id = v.id
            AND content_tag.is_active = true
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_video(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS videos_select_ready_or_admin ON public.videos;
CREATE POLICY videos_select_ready_or_admin
ON public.videos
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    status = 'ready'::public.video_status
    AND EXISTS (
      SELECT 1
      FROM public.video_content_tags video_content_tag
      JOIN public.content_tags content_tag
        ON content_tag.id = video_content_tag.content_tag_id
      WHERE video_content_tag.video_id = videos.id
        AND content_tag.is_active = true
    )
  )
);

COMMIT;
