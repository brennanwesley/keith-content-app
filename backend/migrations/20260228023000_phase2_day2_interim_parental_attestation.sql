-- TeachTok Phase 2 Day 2.3 (interim):
-- Capture parent/guardian attestation metadata without requiring outbound email service.

BEGIN;

ALTER TABLE public.parental_consents
  ADD COLUMN IF NOT EXISTS parent_full_name text,
  ADD COLUMN IF NOT EXISTS relationship_to_child text,
  ADD COLUMN IF NOT EXISTS consent_method text NOT NULL DEFAULT 'email_verification',
  ADD COLUMN IF NOT EXISTS attestation_text text,
  ADD COLUMN IF NOT EXISTS attested_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.parental_consents
    ADD CONSTRAINT parental_consents_consent_method_chk
      CHECK (consent_method IN ('email_verification', 'interim_attestation'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMIT;
