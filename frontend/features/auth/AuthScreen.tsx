"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  changeEmailWithPassword,
  type ChangeEmailResult,
  loginWithEmail,
  type LoginResult,
  signupWithEmail,
  type AccountType,
  type SignupResult,
} from "@/lib/apiClient";
import { saveAuthSession } from "@/lib/authSession";
import { AgeGateCard } from "@/features/onboarding/AgeGateCard";

type AuthMode = "signup" | "login";
type SignupAccountType = Extract<AccountType, "learner" | "parent">;

type FormState = {
  email: string;
  username: string;
  password: string;
  accountType: SignupAccountType;
};

type AuthOutcome = {
  type: "success" | "error";
  message: string;
};

type EmailChangeState = {
  newEmail: string;
  password: string;
};

const initialFormState: FormState = {
  email: "",
  username: "",
  password: "",
  accountType: "learner",
};

const initialEmailChangeState: EmailChangeState = {
  newEmail: "",
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
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<AuthOutcome | null>(null);
  const [loginSession, setLoginSession] = useState<LoginResult | null>(null);
  const [ageGateUserId, setAgeGateUserId] = useState<string | null>(null);
  const [ageGateFlow, setAgeGateFlow] = useState<AuthMode>("signup");
  const [emailChangeState, setEmailChangeState] =
    useState<EmailChangeState>(initialEmailChangeState);
  const [emailChangeOutcome, setEmailChangeOutcome] = useState<AuthOutcome | null>(null);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const headingCopy = useMemo(
    () =>
      mode === "signup"
        ? {
            subtitle: "Choose learner or parent, then continue with email and password.",
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
    setAgeGateFlow("signup");
    setEmailChangeState(initialEmailChangeState);
    setEmailChangeOutcome(null);
  };

  const handleEmailChangeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!loginSession) {
      setEmailChangeOutcome({
        type: "error",
        message: "You need an active login session before changing email.",
      });
      return;
    }

    const currentEmail = loginSession.user.email.trim().toLowerCase();
    const newEmail = emailChangeState.newEmail.trim().toLowerCase();

    if (!newEmail) {
      setEmailChangeOutcome({ type: "error", message: "New email is required." });
      return;
    }

    if (newEmail === currentEmail) {
      setEmailChangeOutcome({
        type: "error",
        message: "New email must be different from current email.",
      });
      return;
    }

    if (!emailChangeState.password) {
      setEmailChangeOutcome({
        type: "error",
        message: "Current password is required to change email.",
      });
      return;
    }

    setIsChangingEmail(true);
    setEmailChangeOutcome(null);

    try {
      const changeResult: ChangeEmailResult = await changeEmailWithPassword(
        loginSession.accessToken,
        {
        newEmail,
        password: emailChangeState.password,
        },
      );

      const updatedSession = {
        ...loginSession,
        user: {
          ...loginSession.user,
          email: changeResult.email,
          emailVerified: changeResult.emailVerified,
        },
      };

      setLoginSession(updatedSession);
      saveAuthSession(updatedSession);

      setFormState((currentState) => ({
        ...currentState,
        email: changeResult.email,
      }));

      setEmailChangeState({
        newEmail: "",
        password: "",
      });

      setEmailChangeOutcome({
        type: "success",
        message: `Email updated to ${changeResult.email}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update email right now.";

      setEmailChangeOutcome({ type: "error", message });
    } finally {
      setIsChangingEmail(false);
    }
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
          accountType: formState.accountType,
        });
        const bootstrapSession = await loginWithEmail({ email, password });

        setFormState({
          email,
          username,
          password: "",
          accountType: formState.accountType,
        });
        setLoginSession(bootstrapSession);
        saveAuthSession(bootstrapSession);
        setEmailChangeOutcome(null);
        setEmailChangeState(initialEmailChangeState);

        setOutcome({
          type: "success",
          message: `Account created for ${signupResult.email}.`,
        });

        if (bootstrapSession.user.accountType !== "learner") {
          const accountRedirectPath =
            bootstrapSession.user.accountType === "admin" ? "/admin" : "/settings";
          const accountRedirectLabel =
            bootstrapSession.user.accountType === "admin"
              ? "admin content controls"
              : "account controls";

          setAgeGateUserId(null);
          setOutcome({
            type: "success",
            message: `Account created for ${signupResult.email}. Redirecting to ${accountRedirectLabel}...`,
          });
          router.push(accountRedirectPath);

          return;
        }

        setAgeGateFlow("signup");
        setAgeGateUserId(signupResult.userId);

        return;
      }

      const loginResult = await loginWithEmail({ email, password });
      setLoginSession(loginResult);
      saveAuthSession(loginResult);
      setEmailChangeOutcome(null);
      setEmailChangeState(initialEmailChangeState);
      setFormState((currentState) => ({
        ...currentState,
        email,
        password: "",
      }));

      if (loginResult.user.accountType !== "learner") {
        const accountRedirectPath =
          loginResult.user.accountType === "admin" ? "/admin" : "/settings";
        const accountRedirectLabel =
          loginResult.user.accountType === "admin"
            ? "admin content controls"
            : "account controls";

        setAgeGateUserId(null);
        setOutcome({
          type: "success",
          message: `Welcome back, ${loginResult.user.email}. Redirecting to ${accountRedirectLabel}...`,
        });
        router.push(accountRedirectPath);

        return;
      }

      if (loginResult.user.hasCompletedAgeGate) {
        setAgeGateUserId(null);
        setOutcome({
          type: "success",
          message: `Welcome back, ${loginResult.user.email}. Redirecting to your feed...`,
        });
        router.push("/feed/youth-hockey");

        return;
      }

      setAgeGateFlow("login");
      setAgeGateUserId(loginResult.user.id);

      setOutcome({
        type: "success",
        message:
          "Welcome back. A one-time age confirmation is required before entering your feed.",
      });
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
          {mode === "signup" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-foreground/85">Account type</legend>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/35 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormState((currentState) => ({
                      ...currentState,
                      accountType: "learner",
                    }));
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    formState.accountType === "learner"
                      ? "bg-gradient-to-r from-accent to-brand text-background"
                      : "text-foreground/75 hover:text-foreground"
                  }`}
                >
                  Learner (13+ or under-13)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormState((currentState) => ({
                      ...currentState,
                      accountType: "parent",
                    }));
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    formState.accountType === "parent"
                      ? "bg-gradient-to-r from-accent to-brand text-background"
                      : "text-foreground/75 hover:text-foreground"
                  }`}
                >
                  Parent/Guardian
                </button>
              </div>
            </fieldset>
          ) : null}

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

            <form onSubmit={handleEmailChangeSubmit} className="mt-4 space-y-3">
              <p className="rounded-xl border border-brand/25 bg-black/35 px-3 py-2 text-xs text-foreground/75">
                To change email, re-enter your current password for confirmation.
              </p>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
                  New email
                </span>
                <input
                  type="email"
                  value={emailChangeState.newEmail}
                  onChange={(event) => {
                    setEmailChangeState((currentState) => ({
                      ...currentState,
                      newEmail: event.target.value,
                    }));
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
                  value={emailChangeState.password}
                  onChange={(event) => {
                    setEmailChangeState((currentState) => ({
                      ...currentState,
                      password: event.target.value,
                    }));
                  }}
                  className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {emailChangeOutcome ? (
                <p
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    emailChangeOutcome.type === "success"
                      ? "border-brand/35 bg-brand/10 text-brand-muted"
                      : "border-accent/40 bg-accent/10 text-accent-strong"
                  }`}
                >
                  {emailChangeOutcome.message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isChangingEmail}
                className="inline-flex w-full items-center justify-center rounded-xl border border-brand/35 bg-brand/15 px-4 py-2 text-sm font-semibold text-brand-muted transition hover:border-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChangingEmail ? "Updating..." : "Update email"}
              </button>
            </form>
          </article>
        ) : null}

        {ageGateUserId && loginSession ? (
          <AgeGateCard
            accessToken={loginSession.accessToken}
            continueHref={ageGateFlow === "login" ? "/feed/youth-hockey" : "/content"}
            continueLabel={
              ageGateFlow === "login"
                ? "Continue to your feed"
                : "Continue to content selection"
            }
          />
        ) : null}

        <footer className="mt-auto pt-6">
          <Link href="/" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
            ← Back to home
          </Link>
        </footer>
      </section>
    </main>
  );
}
