"use client";

import Link from "next/link";
import { useState } from "react";
import { changeEmailWithPassword } from "@/lib/apiClient";
import type { StoredAuthSession } from "@/lib/authSession";

type Outcome = {
  type: "success" | "error";
  message: string;
};

type AccountProfileTabProps = {
  authSession: StoredAuthSession | null;
  isSessionReady: boolean;
  onSessionUpdated: (session: StoredAuthSession) => void;
  onSignOut: () => void;
};

export function AccountProfileTab({
  authSession,
  isSessionReady,
  onSessionUpdated,
  onSignOut,
}: AccountProfileTabProps) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const handleEmailChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authSession) {
      setOutcome({
        type: "error",
        message: "Please log in first before changing account credentials.",
      });
      return;
    }

    const normalizedNewEmail = newEmail.trim().toLowerCase();
    if (!normalizedNewEmail) {
      setOutcome({ type: "error", message: "New email is required." });
      return;
    }

    if (normalizedNewEmail === authSession.user.email.trim().toLowerCase()) {
      setOutcome({
        type: "error",
        message: "New email must be different from current email.",
      });
      return;
    }

    if (!currentPassword) {
      setOutcome({
        type: "error",
        message: "Current password is required to confirm this change.",
      });
      return;
    }

    setIsChangingEmail(true);
    setOutcome(null);

    try {
      const changedAccount = await changeEmailWithPassword(
        authSession.accessToken,
        {
        newEmail: normalizedNewEmail,
        password: currentPassword,
        },
      );

      const updatedSession: StoredAuthSession = {
        ...authSession,
        user: {
          ...authSession.user,
          email: changedAccount.email,
          emailVerified: changedAccount.emailVerified,
        },
      };

      onSessionUpdated(updatedSession);
      setNewEmail("");
      setCurrentPassword("");
      setOutcome({
        type: "success",
        message: `Email updated to ${changedAccount.email}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update email right now.";

      setOutcome({ type: "error", message });
    } finally {
      setIsChangingEmail(false);
    }
  };

  if (isSessionReady && !authSession) {
    return (
      <div className="space-y-3">
        <p>Log in to update account credentials.</p>
        <Link
          href="/auth"
          className="inline-flex text-sm font-semibold text-brand-muted hover:text-accent-strong"
        >
          Go to log in →
        </Link>
      </div>
    );
  }

  if (!authSession) {
    return <p className="text-xs text-foreground/70">Checking account session...</p>;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleEmailChange} className="space-y-3">
        <p className="text-xs text-foreground/70">Current email: {authSession.user.email}</p>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
            New email
          </span>
          <input
            type="email"
            value={newEmail}
            onChange={(event) => {
              setNewEmail(event.target.value);
            }}
            className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
            placeholder="new-email@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
            Current password
          </span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
            }}
            className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
            placeholder="Enter current password"
            autoComplete="current-password"
            required
          />
        </label>

        {outcome ? (
          <p
            className={`rounded-xl border px-3 py-2 text-xs ${
              outcome.type === "success"
                ? "border-brand/35 bg-brand/10 text-brand-muted"
                : "border-accent/40 bg-accent/10 text-accent-strong"
            }`}
          >
            {outcome.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isChangingEmail}
          className="inline-flex w-full items-center justify-center rounded-xl border border-brand/35 bg-brand/15 px-4 py-2 text-sm font-semibold text-brand-muted transition hover:border-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChangingEmail ? "Updating..." : "Update email"}
        </button>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex w-full items-center justify-center rounded-xl border border-accent/35 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent-strong transition hover:border-accent/60"
        >
          Sign out on this device
        </button>
      </form>

      <section className="rounded-2xl border border-white/12 bg-surface-soft/35 p-3">
        <p className="text-sm text-foreground/80">
          Connect a Parent/Guardian account by entering the email here:
        </p>
        <div className="mt-2 w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm text-foreground/65">
          Feature coming soon!
        </div>
      </section>
    </div>
  );
}
