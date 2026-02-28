"use client";

import Link from "next/link";
import type { StoredAuthSession } from "@/lib/authSession";

type ParentLinkTabProps = {
  authSession: StoredAuthSession | null;
  isSessionReady: boolean;
};

export function ParentLinkTab({ authSession, isSessionReady }: ParentLinkTabProps) {
  if (isSessionReady && !authSession) {
    return (
      <div className="space-y-3">
        <p>Log in to view or manage parent/guardian link status.</p>
        <Link
          href="/auth"
          className="inline-flex text-sm font-semibold text-brand-muted hover:text-accent-strong"
        >
          Go to log in →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p>
        Parent/guardian linking and relationship status management will be managed from this tab.
      </p>
      <p className="rounded-xl border border-white/12 bg-surface-soft/40 px-3 py-2 text-xs text-foreground/70">
        Status: no linked parent/guardian account yet.
      </p>
    </div>
  );
}
