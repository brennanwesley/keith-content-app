"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  loginWithEmail,
  type LoginResult,
  signupWithEmail,
  type SignupResult,
} from "@/lib/apiClient";
import { AgeGateCard } from "@/features/onboarding/AgeGateCard";

type AuthMode = "signup" | "login";

type FormState = {
  email: string;
  username: string;
  password: string;
};

type AuthOutcome = {
  type: "success" | "error";
  message: string;
};

const initialFormState: FormState = {
  email: "",
  username: "",
  password: "",
};

function getPasswordRuleMessage(password: string): string | null {
  if (password.length < 10) {
    return "Password must be at least 10 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }

  return null;
}

function getUsernameRuleMessage(username: string): string | null {
  if (username.length < 3) {
    return "Username must be at least 3 characters.";
  }

  if (username.length > 32) {
    return "Username must be at most 32 characters.";
  }

  if (/\s/.test(username)) {
    return "Username cannot contain spaces. Use letters, numbers, and underscores only.";
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return "Username can contain only letters, numbers, and underscores.";
  }

  return null;
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<AuthOutcome | null>(null);
  const [loginSession, setLoginSession] = useState<LoginResult | null>(null);
  const [ageGateUserId, setAgeGateUserId] = useState<string | null>(null);

  const headingCopy = useMemo(
    () =>
      mode === "signup"
        ? {
            subtitle: "Start with email, username, and password.",
            cta: "Create account",
          }
        : {
            subtitle: "Use your email and password to continue.",
            cta: "Log in",
          },
    [mode],
  );
  const usernameInlineError =
    mode === "signup" && formState.username
      ? getUsernameRuleMessage(formState.username)
      : null;

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setOutcome(null);
    setLoginSession(null);
    setAgeGateUserId(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = formState.email.trim().toLowerCase();
    const username = formState.username.trim();
    const password = formState.password;

    if (!email) {
      setOutcome({ type: "error", message: "Email is required." });
      return;
    }

    if (!password) {
      setOutcome({ type: "error", message: "Password is required." });
      return;
    }

    if (mode === "signup") {
      if (!username) {
        setOutcome({ type: "error", message: "Username is required." });
        return;
      }

      const usernameMessage = getUsernameRuleMessage(formState.username);

      if (usernameMessage) {
        setOutcome({ type: "error", message: usernameMessage });
        return;
      }

      const passwordMessage = getPasswordRuleMessage(password);

      if (passwordMessage) {
        setOutcome({ type: "error", message: passwordMessage });
        return;
      }
    }

    setIsSubmitting(true);
    setOutcome(null);

    try {
      if (mode === "signup") {
        const signupResult: SignupResult = await signupWithEmail({
          email,
          username,
          password,
        });

        setFormState({
          email,
          username,
          password: "",
        });

        setOutcome({
          type: "success",
          message: `Account created for ${signupResult.email}. Check email to verify your account.`,
        });
        setAgeGateUserId(signupResult.userId);

        return;
      }

      const loginResult = await loginWithEmail({ email, password });
      setLoginSession(loginResult);
      setFormState((currentState) => ({
        ...currentState,
        email,
        password: "",
      }));

      setOutcome({
        type: "success",
        message: `Welcome back, ${loginResult.user.email}.`,
      });
      setAgeGateUserId(loginResult.user.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please retry.";

      setOutcome({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_24px_80px_-36px_rgba(37,244,238,0.45)] ring-1 ring-brand/20 backdrop-blur-sm sm:p-8">
        <header>
          <h1 className="font-brand bg-gradient-to-r from-foreground via-brand-muted to-accent bg-clip-text text-3xl text-transparent">
            Create Your Account
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/80">{headingCopy.subtitle}</p>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/35 p-1">
          <button
            type="button"
            onClick={() => {
              handleModeChange("signup");
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mode === "signup"
                ? "bg-gradient-to-r from-accent to-brand text-background"
                : "text-foreground/75 hover:text-foreground"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => {
              handleModeChange("login");
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mode === "login"
                ? "bg-gradient-to-r from-accent to-brand text-background"
                : "text-foreground/75 hover:text-foreground"
            }`}
          >
            Log in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground/85">Email</span>
            <input
              type="email"
              value={formState.email}
              onChange={(event) => {
                setFormState((currentState) => ({
                  ...currentState,
                  email: event.target.value,
                }));
              }}
              className="w-full rounded-2xl border border-white/15 bg-surface-soft/80 px-4 py-3 text-base outline-none transition focus:border-brand/70"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          {mode === "signup" ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground/85">Username</span>
              <input
                type="text"
                value={formState.username}
                onChange={(event) => {
                  setFormState((currentState) => ({
                    ...currentState,
                    username: event.target.value,
                  }));
                }}
                className="w-full rounded-2xl border border-white/15 bg-surface-soft/80 px-4 py-3 text-base outline-none transition focus:border-brand/70"
                placeholder="your_username"
                autoComplete="username"
                pattern="[A-Za-z0-9_]{3,32}"
                title="3-32 characters. Use letters, numbers, and underscores only. No spaces."
                minLength={3}
                maxLength={32}
                required
              />
              <p
                className={`text-xs ${
                  usernameInlineError ? "text-accent-strong" : "text-foreground/65"
                }`}
              >
                {usernameInlineError ?? "Use 3-32 characters: letters, numbers, and underscores only (no spaces)."}
              </p>
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground/85">Password</span>
            <input
              type="password"
              value={formState.password}
              onChange={(event) => {
                setFormState((currentState) => ({
                  ...currentState,
                  password: event.target.value,
                }));
              }}
              className="w-full rounded-2xl border border-white/15 bg-surface-soft/80 px-4 py-3 text-base outline-none transition focus:border-brand/70"
              placeholder="Enter password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 10 : 1}
              maxLength={128}
              required
            />
          </label>

          {mode === "signup" ? (
            <p className="rounded-xl border border-brand/25 bg-black/30 px-3 py-2 text-xs text-foreground/75">
              Password rules: 10+ chars, at least one uppercase, one lowercase, and one number.
            </p>
          ) : null}

          {outcome ? (
            <p
              className={`rounded-xl border px-3 py-2 text-sm ${
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
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-brand px-5 py-3 text-base font-extrabold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Working..." : headingCopy.cta}
          </button>
        </form>

        {loginSession ? (
          <article className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-foreground/80">
            <p className="font-semibold text-foreground">Login session ready</p>
            <p className="mt-1">User ID: {loginSession.user.id}</p>
            <p className="mt-1">Email verified: {loginSession.user.emailVerified ? "yes" : "no"}</p>
            <p className="mt-3 text-foreground/65">
              Next phase will wire this token into protected API calls.
            </p>
          </article>
        ) : null}

        {ageGateUserId ? <AgeGateCard userId={ageGateUserId} /> : null}

        <footer className="mt-auto pt-6">
          <Link href="/" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
            ← Back to home
          </Link>
        </footer>
      </section>
    </main>
  );
}
