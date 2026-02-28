"use client";

import Link from "next/link";
import { useState } from "react";
import {
  submitAgeGate,
  type AgeGateResult,
  type ParentalAttestationResult,
} from "@/lib/apiClient";
import { ParentalAttestationModal } from "./ParentalAttestationModal";

type AgeGateCardProps = {
  accessToken: string;
  continueHref?: string;
  continueLabel?: string;
};

export function AgeGateCard({
  accessToken,
  continueHref = "/content",
  continueLabel = "Continue to content selection",
}: AgeGateCardProps) {
  const [birthdate, setBirthdate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AgeGateResult | null>(null);
  const [attestationResult, setAttestationResult] =
    useState<ParentalAttestationResult | null>(null);
  const [isParentalModalOpen, setIsParentalModalOpen] = useState(false);
  const hasDirectAccess = result?.nextStep === "direct_access";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!birthdate) {
      setErrorMessage("Birthdate is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const ageGateResult = await submitAgeGate(accessToken, {
        birthdate,
        countryCode: "US",
      });

      setResult(ageGateResult);
      setAttestationResult(null);

      if (ageGateResult.nextStep === "parent_consent_required") {
        setIsParentalModalOpen(true);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit age gate.";

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="mt-6 overflow-hidden rounded-2xl border border-brand/25 bg-black/35 p-4">
      <h2 className="mt-2 text-lg font-bold text-foreground">
        Confirm learner age
      </h2>
      <p className="mt-1 text-sm text-foreground/75">
        We use this to route 13+ users to direct access and under-13 users to parent consent.
        Region is currently assumed as US for this step.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block w-full max-w-full space-y-1">
          <span className="text-sm font-semibold text-foreground/85">Birthdate</span>
          <input
            type="date"
            value={birthdate}
            onChange={(event) => {
              setBirthdate(event.target.value);
            }}
            disabled={isSubmitting || hasDirectAccess}
            className="block h-11 w-full min-w-0 max-w-full rounded-xl border border-white/15 bg-surface-soft/85 px-4 py-2.5 text-sm outline-none transition focus:border-brand/70 disabled:cursor-not-allowed disabled:opacity-75"
            style={{ width: "100%", maxWidth: "100%" }}
            required
          />
        </label>

        {errorMessage ? (
          <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-strong">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || hasDirectAccess}
          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-75 ${
            hasDirectAccess
              ? "border border-brand/35 bg-brand/20 text-brand-muted"
              : "bg-gradient-to-r from-accent to-brand text-background hover:brightness-110"
          }`}
        >
          {isSubmitting ? "Checking..." : hasDirectAccess ? "Age verified" : "Verify Age"}
        </button>
      </form>

      {result ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-surface-soft/55 p-3 text-sm text-foreground/80">
          {result.nextStep === "direct_access" ? (
            <div className="space-y-3">
              <p className="rounded-xl border border-brand/35 bg-brand/10 px-3 py-2 text-base font-bold text-brand-muted">
                Access Granted!
              </p>
              <Link
                href={continueHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-base font-extrabold text-background transition hover:brightness-110"
              >
                {continueLabel}
                <span aria-hidden>→</span>
              </Link>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {attestationResult ? (
                <>
                  <p className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand-muted">
                    Parent/guardian attestation has been recorded for this learner.
                  </p>
                  <p className="text-xs text-foreground/70">
                    Policy version: {attestationResult.policyVersion} • Expires: {" "}
                    {new Date(attestationResult.expiresAt).toLocaleDateString()}
                  </p>
                  <Link
                    href={continueHref}
                    className="inline-flex text-sm font-semibold text-brand-muted hover:text-accent-strong"
                  >
                    {continueLabel} →
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground/75">
                    Parent or legal guardian attestation is required before continuing.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsParentalModalOpen(true);
                    }}
                    className="inline-flex rounded-lg border border-brand/35 px-3 py-2 text-sm font-semibold text-brand-muted transition hover:border-accent/50 hover:text-foreground"
                  >
                    Open parental consent terms
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}

      <ParentalAttestationModal
        isOpen={isParentalModalOpen}
        accessToken={accessToken}
        onClose={() => {
          setIsParentalModalOpen(false);
        }}
        onSuccess={(submittedResult) => {
          setAttestationResult(submittedResult);
        }}
      />
    </article>
  );
}
