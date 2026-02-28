"use client";

import Link from "next/link";
import { useState } from "react";

type SettingsTab = "content" | "account" | "parent";

const tabLabels: Record<SettingsTab, string> = {
  content: "Content Types",
  account: "Account Profile",
  parent: "Parent/Guardian Link",
};

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("content");

  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_24px_80px_-36px_rgba(37,244,238,0.45)] ring-1 ring-brand/20 backdrop-blur-sm sm:p-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-muted">
            Account controls
          </p>
          <h1 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-accent bg-clip-text text-3xl text-transparent">
            Settings
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/80">
            Manage your content lanes, account details, and family linking in one place.
          </p>
        </header>

        <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/35 p-1">
          {(Object.keys(tabLabels) as SettingsTab[]).map((tab) => {
            const isActive = activeTab === tab;

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
          {activeTab === "content" ? (
            <p>
              Content type preference controls land in Phase 2. This tab is where learners will add
              and remove feed topics.
            </p>
          ) : null}

          {activeTab === "account" ? (
            <p>
              Account credential updates (including password-confirmed sensitive changes) will live
              here.
            </p>
          ) : null}

          {activeTab === "parent" ? (
            <p>
              Parent/guardian linking and relationship status management will be managed from this
              tab.
            </p>
          ) : null}
        </article>

        <footer className="mt-auto flex items-center justify-between gap-4 pt-6">
          <Link href="/feed/youth-hockey" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
            ← Back to feed
          </Link>
          <Link href="/content" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
            Content selection →
          </Link>
        </footer>
      </section>
    </main>
  );
}
