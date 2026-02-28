-- TeachTok Phase 2 / Day 1
-- Items 1.2 + 1.3: baseline schema + RLS policies

begin;

create extension if not exists pgcrypto;

-- Enums
DO $$
BEGIN
  CREATE TYPE public.account_type AS ENUM ('learner', 'parent', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.parent_child_relationship_status AS ENUM ('pending', 'active', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.consent_status AS ENUM ('pending', 'approved', 'rejected', 'expired', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.video_status AS ENUM ('draft', 'processing', 'ready', 'blocked', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.video_provider AS ENUM ('mux');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.video_playback_policy AS ENUM ('public', 'signed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.video_encoding_status AS ENUM ('pending', 'preparing', 'ready', 'errored');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.watch_event_type AS ENUM (
    'play',
    'pause',
    'progress_25',
    'progress_50',
    'progress_75',
    'complete',
    'replay'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Generic helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_username_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'Username cannot be changed once created';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_parent_child_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_user_id IS DISTINCT FROM OLD.parent_user_id
     OR NEW.child_user_id IS DISTINCT FROM OLD.child_user_id THEN
    RAISE EXCEPTION 'Parent/child link identities cannot be reassigned';
  END IF;

  RETURN NEW;
END;
$$;

-- Core tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text,
  account_type public.account_type NOT NULL DEFAULT 'learner',
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format_chk CHECK (username ~ '^[a-zA-Z0-9_]{3,32}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username));

CREATE TABLE IF NOT EXISTS public.age_gates (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  birthdate date NOT NULL,
  calculated_age_at_signup smallint NOT NULL,
  country_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT age_gates_age_range_chk CHECK (calculated_age_at_signup BETWEEN 0 AND 120),
  CONSTRAINT age_gates_country_code_chk CHECK (char_length(country_code) = 2)
);

CREATE TABLE IF NOT EXISTS public.parent_child_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  relationship_status public.parent_child_relationship_status NOT NULL DEFAULT 'pending',
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_child_distinct_users_chk CHECK (parent_user_id <> child_user_id),
  CONSTRAINT parent_child_links_unique UNIQUE (parent_user_id, child_user_id)
);

CREATE INDEX IF NOT EXISTS parent_child_links_child_idx
  ON public.parent_child_links (child_user_id);

CREATE INDEX IF NOT EXISTS parent_child_links_parent_status_idx
  ON public.parent_child_links (parent_user_id, relationship_status);

CREATE TABLE IF NOT EXISTS public.parental_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  parent_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  parent_email text NOT NULL,
  consent_status public.consent_status NOT NULL DEFAULT 'pending',
  approved_at timestamptz,
  expires_at timestamptz,
  policy_version text NOT NULL,
  ip_address inet,
  user_agent text,
  token_hash text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parental_consents_approved_requires_approved_at_chk
    CHECK (
      consent_status <> 'approved'::public.consent_status
      OR approved_at IS NOT NULL
    ),
  CONSTRAINT parental_consents_approved_requires_expires_at_chk
    CHECK (
      consent_status <> 'approved'::public.consent_status
      OR expires_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS parental_consents_child_status_idx
  ON public.parental_consents (child_user_id, consent_status);

CREATE INDEX IF NOT EXISTS parental_consents_parent_user_idx
  ON public.parental_consents (parent_user_id);

CREATE INDEX IF NOT EXISTS parental_consents_parent_email_idx
  ON public.parental_consents (lower(parent_email));

CREATE TABLE IF NOT EXISTS public.content_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_types_slug_lower_idx
  ON public.content_types (lower(slug));

CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.video_status NOT NULL DEFAULT 'draft',
  owner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  duration_seconds integer,
  thumbnail_url text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT videos_duration_non_negative_chk CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS videos_status_idx
  ON public.videos (status);

CREATE INDEX IF NOT EXISTS videos_owner_idx
  ON public.videos (owner_id);

CREATE TABLE IF NOT EXISTS public.video_content_types (
  video_id uuid NOT NULL REFERENCES public.videos (id) ON DELETE CASCADE,
  content_type_id uuid NOT NULL REFERENCES public.content_types (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, content_type_id)
);

CREATE INDEX IF NOT EXISTS video_content_types_content_type_idx
  ON public.video_content_types (content_type_id);

CREATE TABLE IF NOT EXISTS public.video_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL UNIQUE REFERENCES public.videos (id) ON DELETE CASCADE,
  provider public.video_provider NOT NULL DEFAULT 'mux',
  mux_asset_id text,
  mux_playback_id text,
  playback_policy public.video_playback_policy NOT NULL DEFAULT 'public',
  encoding_status public.video_encoding_status NOT NULL DEFAULT 'pending',
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS video_assets_mux_asset_id_idx
  ON public.video_assets (mux_asset_id)
  WHERE mux_asset_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS video_assets_mux_playback_id_idx
  ON public.video_assets (mux_playback_id)
  WHERE mux_playback_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos (id) ON DELETE CASCADE,
  event_type public.watch_event_type NOT NULL,
  position_seconds integer,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_events_position_non_negative_chk
    CHECK (position_seconds IS NULL OR position_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS watch_events_user_occurred_idx
  ON public.watch_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS watch_events_video_occurred_idx
  ON public.watch_events (video_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.video_progress (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos (id) ON DELETE CASCADE,
  last_position_seconds integer NOT NULL DEFAULT 0,
  completion_percent numeric(5,2) NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id),
  CONSTRAINT video_progress_position_non_negative_chk CHECK (last_position_seconds >= 0),
  CONSTRAINT video_progress_completion_percent_chk CHECK (completion_percent BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS video_progress_video_idx
  ON public.video_progress (video_id);

CREATE TABLE IF NOT EXISTS public.watch_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  watch_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_sessions_watch_seconds_non_negative_chk CHECK (watch_seconds >= 0),
  CONSTRAINT watch_sessions_end_after_start_chk CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS watch_sessions_user_started_idx
  ON public.watch_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.engagement_daily_rollups (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content_type_id uuid NOT NULL REFERENCES public.content_types (id) ON DELETE CASCADE,
  date date NOT NULL,
  watch_seconds integer NOT NULL DEFAULT 0,
  completions integer NOT NULL DEFAULT 0,
  active_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_type_id, date),
  CONSTRAINT engagement_rollups_watch_seconds_non_negative_chk CHECK (watch_seconds >= 0),
  CONSTRAINT engagement_rollups_completions_non_negative_chk CHECK (completions >= 0),
  CONSTRAINT engagement_rollups_active_minutes_non_negative_chk CHECK (active_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS engagement_rollups_date_idx
  ON public.engagement_daily_rollups (date DESC);

CREATE TABLE IF NOT EXISTS public.billing_customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_code text NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx
  ON public.subscriptions (user_id, status);

-- RLS helper functions
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = COALESCE(p_user_id, auth.uid())
      AND p.account_type = 'admin'::public.account_type
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_parent_of(
  p_child_user_id uuid,
  p_parent_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_child_links pcl
    WHERE pcl.child_user_id = p_child_user_id
      AND pcl.parent_user_id = COALESCE(p_parent_user_id, auth.uid())
      AND pcl.relationship_status = 'active'::public.parent_child_relationship_status
  );
$$;

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
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_parent_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_video(uuid, uuid) TO authenticated;

-- Triggers
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS prevent_profiles_username_change ON public.profiles;
CREATE TRIGGER prevent_profiles_username_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_username_change();

DROP TRIGGER IF EXISTS set_age_gates_updated_at ON public.age_gates;
CREATE TRIGGER set_age_gates_updated_at
BEFORE UPDATE ON public.age_gates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_parent_child_links_updated_at ON public.parent_child_links;
CREATE TRIGGER set_parent_child_links_updated_at
BEFORE UPDATE ON public.parent_child_links
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS prevent_parent_child_link_reassignment ON public.parent_child_links;
CREATE TRIGGER prevent_parent_child_link_reassignment
BEFORE UPDATE ON public.parent_child_links
FOR EACH ROW
EXECUTE FUNCTION public.prevent_parent_child_reassignment();

DROP TRIGGER IF EXISTS set_parental_consents_updated_at ON public.parental_consents;
CREATE TRIGGER set_parental_consents_updated_at
BEFORE UPDATE ON public.parental_consents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_content_types_updated_at ON public.content_types;
CREATE TRIGGER set_content_types_updated_at
BEFORE UPDATE ON public.content_types
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_videos_updated_at ON public.videos;
CREATE TRIGGER set_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_video_assets_updated_at ON public.video_assets;
CREATE TRIGGER set_video_assets_updated_at
BEFORE UPDATE ON public.video_assets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_video_progress_updated_at ON public.video_progress;
CREATE TRIGGER set_video_progress_updated_at
BEFORE UPDATE ON public.video_progress
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_watch_sessions_updated_at ON public.watch_sessions;
CREATE TRIGGER set_watch_sessions_updated_at
BEFORE UPDATE ON public.watch_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_engagement_daily_rollups_updated_at ON public.engagement_daily_rollups;
CREATE TRIGGER set_engagement_daily_rollups_updated_at
BEFORE UPDATE ON public.engagement_daily_rollups
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_billing_customers_updated_at ON public.billing_customers;
CREATE TRIGGER set_billing_customers_updated_at
BEFORE UPDATE ON public.billing_customers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_daily_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_insert_self_or_admin ON public.profiles;
CREATE POLICY profiles_insert_self_or_admin
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_delete_admin_only ON public.profiles;
CREATE POLICY profiles_delete_admin_only
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Age gates
DROP POLICY IF EXISTS age_gates_select_self_or_admin ON public.age_gates;
CREATE POLICY age_gates_select_self_or_admin
ON public.age_gates
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS age_gates_insert_self_or_admin ON public.age_gates;
CREATE POLICY age_gates_insert_self_or_admin
ON public.age_gates
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS age_gates_update_self_or_admin ON public.age_gates;
CREATE POLICY age_gates_update_self_or_admin
ON public.age_gates
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS age_gates_delete_admin_only ON public.age_gates;
CREATE POLICY age_gates_delete_admin_only
ON public.age_gates
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Parent-child links
DROP POLICY IF EXISTS parent_child_links_select_scoped ON public.parent_child_links;
CREATE POLICY parent_child_links_select_scoped
ON public.parent_child_links
FOR SELECT
TO authenticated
USING (
  parent_user_id = auth.uid()
  OR child_user_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS parent_child_links_insert_parent_or_admin ON public.parent_child_links;
CREATE POLICY parent_child_links_insert_parent_or_admin
ON public.parent_child_links
FOR INSERT
TO authenticated
WITH CHECK (parent_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS parent_child_links_update_scoped ON public.parent_child_links;
CREATE POLICY parent_child_links_update_scoped
ON public.parent_child_links
FOR UPDATE
TO authenticated
USING (
  parent_user_id = auth.uid()
  OR child_user_id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  parent_user_id = auth.uid()
  OR child_user_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS parent_child_links_delete_parent_or_admin ON public.parent_child_links;
CREATE POLICY parent_child_links_delete_parent_or_admin
ON public.parent_child_links
FOR DELETE
TO authenticated
USING (parent_user_id = auth.uid() OR public.is_admin());

-- Parental consents (sensitive writes: admin/service-role only)
DROP POLICY IF EXISTS parental_consents_select_scoped ON public.parental_consents;
CREATE POLICY parental_consents_select_scoped
ON public.parental_consents
FOR SELECT
TO authenticated
USING (
  child_user_id = auth.uid()
  OR parent_user_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS parental_consents_insert_admin_only ON public.parental_consents;
CREATE POLICY parental_consents_insert_admin_only
ON public.parental_consents
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS parental_consents_update_admin_only ON public.parental_consents;
CREATE POLICY parental_consents_update_admin_only
ON public.parental_consents
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS parental_consents_delete_admin_only ON public.parental_consents;
CREATE POLICY parental_consents_delete_admin_only
ON public.parental_consents
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Content types
DROP POLICY IF EXISTS content_types_select_authenticated ON public.content_types;
CREATE POLICY content_types_select_authenticated
ON public.content_types
FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS content_types_insert_admin_only ON public.content_types;
CREATE POLICY content_types_insert_admin_only
ON public.content_types
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS content_types_update_admin_only ON public.content_types;
CREATE POLICY content_types_update_admin_only
ON public.content_types
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS content_types_delete_admin_only ON public.content_types;
CREATE POLICY content_types_delete_admin_only
ON public.content_types
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Videos
DROP POLICY IF EXISTS videos_select_ready_or_admin ON public.videos;
CREATE POLICY videos_select_ready_or_admin
ON public.videos
FOR SELECT
TO authenticated
USING (status = 'ready'::public.video_status OR public.is_admin());

DROP POLICY IF EXISTS videos_insert_admin_only ON public.videos;
CREATE POLICY videos_insert_admin_only
ON public.videos
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS videos_update_admin_only ON public.videos;
CREATE POLICY videos_update_admin_only
ON public.videos
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS videos_delete_admin_only ON public.videos;
CREATE POLICY videos_delete_admin_only
ON public.videos
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Video/content tags
DROP POLICY IF EXISTS video_content_types_select_accessible_video ON public.video_content_types;
CREATE POLICY video_content_types_select_accessible_video
ON public.video_content_types
FOR SELECT
TO authenticated
USING (public.can_access_video(video_id));

DROP POLICY IF EXISTS video_content_types_insert_admin_only ON public.video_content_types;
CREATE POLICY video_content_types_insert_admin_only
ON public.video_content_types
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS video_content_types_delete_admin_only ON public.video_content_types;
CREATE POLICY video_content_types_delete_admin_only
ON public.video_content_types
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Video assets
DROP POLICY IF EXISTS video_assets_select_accessible_video ON public.video_assets;
CREATE POLICY video_assets_select_accessible_video
ON public.video_assets
FOR SELECT
TO authenticated
USING (public.can_access_video(video_id));

DROP POLICY IF EXISTS video_assets_insert_admin_only ON public.video_assets;
CREATE POLICY video_assets_insert_admin_only
ON public.video_assets
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS video_assets_update_admin_only ON public.video_assets;
CREATE POLICY video_assets_update_admin_only
ON public.video_assets
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS video_assets_delete_admin_only ON public.video_assets;
CREATE POLICY video_assets_delete_admin_only
ON public.video_assets
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Watch events
DROP POLICY IF EXISTS watch_events_select_scoped ON public.watch_events;
CREATE POLICY watch_events_select_scoped
ON public.watch_events
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_active_parent_of(user_id)
  OR public.is_admin()
);

DROP POLICY IF EXISTS watch_events_insert_owner_only ON public.watch_events;
CREATE POLICY watch_events_insert_owner_only
ON public.watch_events
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_access_video(video_id)
);

-- Video progress
DROP POLICY IF EXISTS video_progress_select_scoped ON public.video_progress;
CREATE POLICY video_progress_select_scoped
ON public.video_progress
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_active_parent_of(user_id)
  OR public.is_admin()
);

DROP POLICY IF EXISTS video_progress_insert_owner_only ON public.video_progress;
CREATE POLICY video_progress_insert_owner_only
ON public.video_progress
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_access_video(video_id)
);

DROP POLICY IF EXISTS video_progress_update_owner_only ON public.video_progress;
CREATE POLICY video_progress_update_owner_only
ON public.video_progress
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (
  (user_id = auth.uid() AND public.can_access_video(video_id))
  OR public.is_admin()
);

-- Watch sessions
DROP POLICY IF EXISTS watch_sessions_select_scoped ON public.watch_sessions;
CREATE POLICY watch_sessions_select_scoped
ON public.watch_sessions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_active_parent_of(user_id)
  OR public.is_admin()
);

DROP POLICY IF EXISTS watch_sessions_insert_owner_only ON public.watch_sessions;
CREATE POLICY watch_sessions_insert_owner_only
ON public.watch_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_access_video(video_id)
);

DROP POLICY IF EXISTS watch_sessions_update_owner_only ON public.watch_sessions;
CREATE POLICY watch_sessions_update_owner_only
ON public.watch_sessions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (
  (user_id = auth.uid() AND public.can_access_video(video_id))
  OR public.is_admin()
);

-- Rollups
DROP POLICY IF EXISTS engagement_daily_rollups_select_scoped ON public.engagement_daily_rollups;
CREATE POLICY engagement_daily_rollups_select_scoped
ON public.engagement_daily_rollups
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_active_parent_of(user_id)
  OR public.is_admin()
);

DROP POLICY IF EXISTS engagement_daily_rollups_insert_admin_only ON public.engagement_daily_rollups;
CREATE POLICY engagement_daily_rollups_insert_admin_only
ON public.engagement_daily_rollups
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS engagement_daily_rollups_update_admin_only ON public.engagement_daily_rollups;
CREATE POLICY engagement_daily_rollups_update_admin_only
ON public.engagement_daily_rollups
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS engagement_daily_rollups_delete_admin_only ON public.engagement_daily_rollups;
CREATE POLICY engagement_daily_rollups_delete_admin_only
ON public.engagement_daily_rollups
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Billing placeholders
DROP POLICY IF EXISTS billing_customers_select_scoped ON public.billing_customers;
CREATE POLICY billing_customers_select_scoped
ON public.billing_customers
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS billing_customers_insert_admin_only ON public.billing_customers;
CREATE POLICY billing_customers_insert_admin_only
ON public.billing_customers
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS billing_customers_update_admin_only ON public.billing_customers;
CREATE POLICY billing_customers_update_admin_only
ON public.billing_customers
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS billing_customers_delete_admin_only ON public.billing_customers;
CREATE POLICY billing_customers_delete_admin_only
ON public.billing_customers
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS subscriptions_select_scoped ON public.subscriptions;
CREATE POLICY subscriptions_select_scoped
ON public.subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS subscriptions_insert_admin_only ON public.subscriptions;
CREATE POLICY subscriptions_insert_admin_only
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS subscriptions_update_admin_only ON public.subscriptions;
CREATE POLICY subscriptions_update_admin_only
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS subscriptions_delete_admin_only ON public.subscriptions;
CREATE POLICY subscriptions_delete_admin_only
ON public.subscriptions
FOR DELETE
TO authenticated
USING (public.is_admin());

commit;
