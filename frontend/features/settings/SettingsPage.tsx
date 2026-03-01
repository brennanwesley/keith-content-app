"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
  type StoredAuthSession,
} from "@/lib/authSession";
import { AccountProfileTab } from "./AccountProfileTab";
import { ContentPreferencesTab } from "./ContentPreferencesTab";

type SettingsTab = "content" | "account";

const tabLabels: Record<SettingsTab, string> = {
  content: "Content Types",
  account: "Account Profile",
};

export function SettingsPage() {
  const router = useRouter();
  const [authSession, setAuthSession] = useState<StoredAuthSession | null>(() =>
    readAuthSession(),
  );
  const [activeTab, setActiveTab] = useState<SettingsTab>("content");
  const isSessionReady = true;
  const accountType = authSession?.user.accountType ?? null;
  const isAdmin = accountType === "admin";
  const availableTabs: SettingsTab[] = isAdmin ? ["account"] : ["content", "account"];
  const selectedTab: SettingsTab = availableTabs.includes(activeTab)
    ? activeTab
    : availableTabs[0];

  const footerPrimaryLink = isAdmin
    ? {
        href: "/admin",
        label: "← Back to admin studio",
      }
    : {
        href: "/feed/youth-hockey",
        label: "← Back to feed",
      };

  const handleSessionUpdated = (nextSession: StoredAuthSession) => {
    setAuthSession(nextSession);
    saveAuthSession(nextSession);
  };

  const handleSignOut = () => {
    clearAuthSession();
    setAuthSession(null);
    router.replace("/");
  };

  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_24px_80px_-36px_rgba(37,244,238,0.45)] ring-1 ring-brand/20 backdrop-blur-sm sm:p-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-muted">
            {isAdmin ? "Admin account controls" : "Account controls"}
          </p>
          <h1 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-accent bg-clip-text text-3xl text-transparent">
            Settings
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/80">
            {isAdmin
              ? "Manage your admin account profile and jump back to Content Studio quickly."
              : "Manage your content lanes and account details in one place."}
          </p>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/35 p-1">
          {availableTabs.map((tab) => {
            const isActive = selectedTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                }}
                className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-gradient-to-r from-accent to-brand text-background"
                    : "text-foreground/75 hover:text-foreground"
                }`}
              >
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>

        <article className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-foreground/80">
          {selectedTab === "content" ? (
            <ContentPreferencesTab
              authSession={authSession}
              isSessionReady={isSessionReady}
            />
          ) : null}

          {selectedTab === "account" ? (
            <AccountProfileTab
              authSession={authSession}
              isSessionReady={isSessionReady}
              onSessionUpdated={handleSessionUpdated}
              onSignOut={handleSignOut}
            />
          ) : null}
        </article>

        <footer className="mt-auto flex items-center justify-between gap-4 pt-6">
          <Link href={footerPrimaryLink.href} className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
            {footerPrimaryLink.label}
          </Link>

          {!isAdmin ? (
            <Link href="/content" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
              Content selection →
            </Link>
          ) : null}
        </footer>
      </section>
    </main>
  );
}
