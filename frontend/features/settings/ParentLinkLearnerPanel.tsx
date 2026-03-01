"use client";

import { useEffect, useMemo, useState } from "react";
import {
  acceptParentLink,
  getMyParentLinks,
  revokeParentLink,
  type ParentLinkSummary,
} from "@/lib/apiClient";
import type { StoredAuthSession } from "@/lib/authSession";

type Outcome = {
  type: "success" | "error";
  message: string;
};

type ParentLinkLearnerPanelProps = {
  authSession: StoredAuthSession;
};

export function ParentLinkLearnerPanel({ authSession }: ParentLinkLearnerPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [childLinks, setChildLinks] = useState<ParentLinkSummary[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const pendingIncomingLinks = useMemo(
    () => childLinks.filter((link) => link.relationshipStatus === "pending"),
    [childLinks],
  );

  const activeParentLinks = useMemo(
    () => childLinks.filter((link) => link.relationshipStatus === "active"),
    [childLinks],
  );

  useEffect(() => {
    let cancelled = false;

    const loadLinks = async () => {
      setIsLoading(true);
      setOutcome(null);

      try {
        const linksResult = await getMyParentLinks(authSession.accessToken);

        if (cancelled) {
          return;
        }

        setChildLinks(linksResult.asChild);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unable to load parent links.";
        setOutcome({ type: "error", message });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadLinks();

    return () => {
      cancelled = true;
    };
  }, [authSession.accessToken, reloadKey]);

  const handleAcceptLink = async (linkId: string) => {
    try {
      await acceptParentLink(authSession.accessToken, linkId);
      setOutcome({ type: "success", message: "Parent link accepted." });
      setReloadKey((currentKey) => currentKey + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to accept parent link.";
      setOutcome({ type: "error", message });
    }
  };

  const handleDeclineOrRevoke = async (linkId: string) => {
    try {
      await revokeParentLink(authSession.accessToken, linkId);
      setOutcome({ type: "success", message: "Parent link removed." });
      setReloadKey((currentKey) => currentKey + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to remove parent link.";
      setOutcome({ type: "error", message });
    }
  };

  return (
    <section className="rounded-2xl border border-white/12 bg-surface-soft/35 p-3">
      <p className="text-sm text-foreground/80">
        Review parent-link requests and active linked parent accounts.
      </p>

      {isLoading ? <p className="mt-3 text-xs text-foreground/70">Loading links...</p> : null}

      <div className="mt-3 space-y-2">
        {pendingIncomingLinks.length > 0 ? (
          pendingIncomingLinks.map((link) => (
            <div key={link.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-sm font-semibold text-foreground/90">
                Parent request from @{link.parentUsername}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleAcceptLink(link.id);
                  }}
                  className="inline-flex rounded-lg border border-brand/35 bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand-muted transition hover:border-accent/60 hover:text-foreground"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeclineOrRevoke(link.id);
                  }}
                  className="inline-flex rounded-lg border border-accent/35 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent-strong transition hover:border-accent/60"
                >
                  Decline
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-foreground/70">No pending parent-link requests.</p>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
          Active linked parents
        </p>
        {activeParentLinks.length === 0 ? (
          <p className="text-xs text-foreground/70">No active linked parent accounts.</p>
        ) : (
          activeParentLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <p className="text-sm text-foreground/85">@{link.parentUsername}</p>
              <button
                type="button"
                onClick={() => {
                  void handleDeclineOrRevoke(link.id);
                }}
                className="text-xs font-semibold text-accent-strong hover:text-foreground"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {outcome ? (
        <p
          className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
            outcome.type === "success"
              ? "border-brand/35 bg-brand/10 text-brand-muted"
              : "border-accent/40 bg-accent/10 text-accent-strong"
          }`}
        >
          {outcome.message}
        </p>
      ) : null}
    </section>
  );
}
