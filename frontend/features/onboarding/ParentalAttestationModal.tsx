"use client";

import { useState } from "react";
import {
  submitParentalAttestation,
  type ParentalAttestationResult,
} from "@/lib/apiClient";

type ParentalAttestationModalProps = {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: (result: ParentalAttestationResult) => void;
};

const INTERIM_PARENTAL_ATTESTATION_COPY =
  "By checking this box and typing my full legal name, I certify that I am the child's legal parent or guardian and I consent to the child's use of TeachTok under these Terms and Privacy Policy.";

export function ParentalAttestationModal({
  isOpen,
  userId,
  onClose,
  onSuccess,
}: ParentalAttestationModalProps) {
  const [parentEmail, setParentEmail] = useState("");
  const [parentFullName, setParentFullName] = useState("");
  const [relationshipToChild, setRelationshipToChild] = useState("");
  const [attestationAccepted, setAttestationAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!attestationAccepted) {
      setErrorMessage("A legal parent or guardian must accept the attestation.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await submitParentalAttestation({
        userId,
        parentEmail,
        parentFullName,
        relationshipToChild,
        attestationAccepted,
      });

      onSuccess(result);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to record parental consent.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-surface p-5 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.75)] sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
          Parent/Guardian Consent
        </p>
        <h3 className="mt-2 text-xl font-bold text-foreground">
          Interim parental attestation
        </h3>
        <p className="mt-2 rounded-xl border border-brand/25 bg-black/35 px-3 py-2 text-sm text-foreground/80">
          {INTERIM_PARENTAL_ATTESTATION_COPY}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-foreground/85">Parent email</span>
            <input
              type="email"
              value={parentEmail}
              onChange={(event) => {
                setParentEmail(event.target.value);
              }}
              className="w-full rounded-xl border border-white/15 bg-surface-soft/85 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
              placeholder="parent@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-foreground/85">Full legal name</span>
            <input
              type="text"
              value={parentFullName}
              onChange={(event) => {
                setParentFullName(event.target.value);
              }}
              className="w-full rounded-xl border border-white/15 bg-surface-soft/85 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
              placeholder="Full legal name"
              autoComplete="name"
              minLength={3}
              maxLength={120}
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-foreground/85">Relationship to child</span>
            <input
              type="text"
              value={relationshipToChild}
              onChange={(event) => {
                setRelationshipToChild(event.target.value);
              }}
              className="w-full rounded-xl border border-white/15 bg-surface-soft/85 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
              placeholder="Mother, Father, Guardian..."
              minLength={2}
              maxLength={60}
              required
            />
          </label>

          <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <input
              type="checkbox"
              checked={attestationAccepted}
              onChange={(event) => {
                setAttestationAccepted(event.target.checked);
              }}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground/80">
              I certify that I am a legal parent or guardian and approve this learner using TeachTok.
            </span>
          </label>

          {errorMessage ? (
            <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-strong">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-foreground/80 transition hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-2 text-sm font-extrabold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Agree and continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
