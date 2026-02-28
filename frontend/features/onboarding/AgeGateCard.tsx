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
  userId: string;
};

export function AgeGateCard({ userId }: AgeGateCardProps) {
  const [birthdate, setBirthdate] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AgeGateResult | null>(null);
  const [attestationResult, setAttestationResult] =
    useState<ParentalAttestationResult | null>(null);
  const [isParentalModalOpen, setIsParentalModalOpen] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!birthdate) {
      setErrorMessage("Birthdate is required.");
      return;
    }

    const normalizedCountryCode = countryCode.trim().toUpperCase();

    if (normalizedCountryCode.length !== 2) {
      setErrorMessage("Country code must be exactly 2 letters (example: US).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const ageGateResult = await submitAgeGate({
        userId,
        birthdate,
        countryCode: normalizedCountryCode,
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
    <article className="mt-6 rounded-2xl border border-brand/25 bg-black/35 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
        Step 2.2 Age Gate
      </p>
      <h2 className="mt-2 text-lg font-bold text-foreground">
        Confirm learner age
      </h2>
      <p className="mt-1 text-sm text-foreground/75">
        We use this to route 13+ users to direct access and under-13 users to parent consent.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-foreground/85">Birthdate</span>
          <input
            type="date"
            value={birthdate}
            onChange={(event) => {
              setBirthdate(event.target.value);
            }}
            className="w-full rounded-xl border border-white/15 bg-surface-soft/85 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-foreground/85">Country code</span>
          <input
            type="text"
            value={countryCode}
            onChange={(event) => {
              setCountryCode(event.target.value);
            }}
            className="w-full rounded-xl border border-white/15 bg-surface-soft/85 px-3 py-2 text-sm uppercase outline-none transition focus:border-brand/70"
            maxLength={2}
            minLength={2}
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
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-2.5 text-sm font-extrabold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Checking..." : "Submit age gate"}
        </button>
      </form>

      {result ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-surface-soft/55 p-3 text-sm text-foreground/80">
          <p>
            Calculated age: <span className="font-semibold text-foreground">{result.calculatedAge}</span>
          </p>
          <p className="mt-1">
            Decision: <span className="font-semibold text-foreground">{result.nextStep}</span>
          </p>

          {result.nextStep === "direct_access" ? (
            <Link
              href="/content"
              className="mt-3 inline-flex text-sm font-semibold text-brand-muted hover:text-accent-strong"
            >
              Continue to content selection →
            </Link>
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
                    href="/content"
                    className="inline-flex text-sm font-semibold text-brand-muted hover:text-accent-strong"
                  >
                    Continue to content selection →
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
        userId={userId}
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
