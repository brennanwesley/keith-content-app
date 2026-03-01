"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getChildContentRestrictions,
  getContentTypes,
  getMyParentLinks,
  requestParentLink,
  revokeParentLink,
  updateChildContentRestrictions,
  type ChildContentRestrictionsResult,
  type ContentTypeSummary,
  type ParentLinkSummary,
} from "@/lib/apiClient";
import type { StoredAuthSession } from "@/lib/authSession";

type Outcome = {
  type: "success" | "error";
  message: string;
};

type ParentLinkParentPanelProps = {
  authSession: StoredAuthSession;
};

export function ParentLinkParentPanel({ authSession }: ParentLinkParentPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingRestrictions, setIsSavingRestrictions] = useState(false);
  const [contentTypes, setContentTypes] = useState<ContentTypeSummary[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLinkSummary[]>([]);
  const [selectedChildUserId, setSelectedChildUserId] = useState<string | null>(null);
  const [childRestrictions, setChildRestrictions] =
    useState<ChildContentRestrictionsResult | null>(null);
  const [blockedContentTypeIds, setBlockedContentTypeIds] = useState<string[]>([]);
  const [childUsernameInput, setChildUsernameInput] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const activeChildLinks = useMemo(
    () => parentLinks.filter((link) => link.relationshipStatus === "active"),
    [parentLinks],
  );

  useEffect(() => {
    let cancelled = false;

    const loadParentData = async () => {
      setIsLoading(true);
      setOutcome(null);

      try {
        const [linksResult, availableContentTypes] = await Promise.all([
          getMyParentLinks(authSession.accessToken),
          getContentTypes(),
        ]);

        if (cancelled) {
          return;
        }

        setParentLinks(linksResult.asParent);
        setContentTypes(availableContentTypes);

        const nextSelectedChildId =
          linksResult.asParent.find((link) => link.relationshipStatus === "active")
            ?.childUserId ?? null;

        setSelectedChildUserId((currentSelectedChildId) => {
          if (
            currentSelectedChildId &&
            linksResult.asParent.some(
              (link) =>
                link.relationshipStatus === "active" &&
                link.childUserId === currentSelectedChildId,
            )
          ) {
            return currentSelectedChildId;
          }

          return nextSelectedChildId;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unable to load parent controls.";

        setOutcome({ type: "error", message });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadParentData();

    return () => {
      cancelled = true;
    };
  }, [authSession.accessToken, reloadKey]);

  useEffect(() => {
    if (!selectedChildUserId) {
      setChildRestrictions(null);
      setBlockedContentTypeIds([]);
      return;
    }

    let cancelled = false;

    const loadChildRestrictions = async () => {
      setIsLoading(true);
      setOutcome(null);

      try {
        const restrictions = await getChildContentRestrictions(
          authSession.accessToken,
          selectedChildUserId,
        );

        if (cancelled) {
          return;
        }

        setChildRestrictions(restrictions);
        setBlockedContentTypeIds(restrictions.blockedContentTypeIds);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load child content restrictions.";

        setOutcome({ type: "error", message });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadChildRestrictions();

    return () => {
      cancelled = true;
    };
  }, [authSession.accessToken, selectedChildUserId]);

  const handleRequestLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const childUsername = childUsernameInput.trim();

    if (!childUsername) {
      setOutcome({ type: "error", message: "Child username is required." });
      return;
    }

    try {
      await requestParentLink(authSession.accessToken, { childUsername });
      setChildUsernameInput("");
      setOutcome({ type: "success", message: "Parent-link request sent." });
      setReloadKey((currentKey) => currentKey + 1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to request parent link.";
      setOutcome({ type: "error", message });
    }
  };

  const handleRevoke = async (linkId: string) => {
    try {
      await revokeParentLink(authSession.accessToken, linkId);
      setOutcome({ type: "success", message: "Parent link revoked." });
      setReloadKey((currentKey) => currentKey + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to revoke link.";
      setOutcome({ type: "error", message });
    }
  };

  const handleToggleBlockedContentType = (contentTypeId: string) => {
    setBlockedContentTypeIds((currentBlockedIds) =>
      currentBlockedIds.includes(contentTypeId)
        ? currentBlockedIds.filter((currentId) => currentId !== contentTypeId)
        : [...currentBlockedIds, contentTypeId],
    );
  };

  const handleSaveRestrictions = async () => {
    if (!selectedChildUserId) {
      setOutcome({ type: "error", message: "Select an active child first." });
      return;
    }

    setIsSavingRestrictions(true);

    try {
      const nextRestrictions = await updateChildContentRestrictions(
        authSession.accessToken,
        selectedChildUserId,
        { blockedContentTypeIds },
      );

      setChildRestrictions(nextRestrictions);
      setBlockedContentTypeIds(nextRestrictions.blockedContentTypeIds);
      setOutcome({
        type: "success",
        message: `Restrictions saved for @${nextRestrictions.childUsername}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save child content restrictions.";
      setOutcome({ type: "error", message });
    } finally {
      setIsSavingRestrictions(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/12 bg-surface-soft/35 p-3">
      <p className="text-sm text-foreground/80">
        Manage linked learner accounts and apply parent content restrictions.
      </p>

      <form onSubmit={handleRequestLink} className="mt-3 space-y-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
            Request child link by username
          </span>
          <input
            type="text"
            value={childUsernameInput}
            onChange={(event) => {
              setChildUsernameInput(event.target.value);
            }}
            className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
            placeholder="child_username"
          />
        </label>
        <button
          type="submit"
          className="inline-flex rounded-xl border border-brand/35 bg-brand/15 px-4 py-2 text-sm font-semibold text-brand-muted transition hover:border-accent/60 hover:text-foreground"
        >
          Send link request
        </button>
      </form>

      <div className="mt-3 space-y-2">
        {parentLinks.map((link) => (
          <div key={link.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground/90">@{link.childUsername}</p>
              <span className="text-xs uppercase tracking-[0.12em] text-foreground/65">
                {link.relationshipStatus}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleRevoke(link.id);
              }}
              className="mt-2 text-xs font-semibold text-accent-strong hover:text-foreground"
            >
              Revoke link
            </button>
          </div>
        ))}
      </div>

      {activeChildLinks.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
              Manage active child
            </span>
            <select
              value={selectedChildUserId ?? ""}
              onChange={(event) => {
                setSelectedChildUserId(event.target.value || null);
              }}
              className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
            >
              {activeChildLinks.map((link) => (
                <option key={link.id} value={link.childUserId}>
                  @{link.childUsername}
                </option>
              ))}
            </select>
          </label>

          {contentTypes.map((contentType) => {
            const isBlocked = blockedContentTypeIds.includes(contentType.id);

            return (
              <label
                key={contentType.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-surface-soft/35 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground/90">{contentType.name}</p>
                  <p className="text-xs text-foreground/65">{contentType.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={isBlocked}
                  onChange={() => {
                    handleToggleBlockedContentType(contentType.id);
                  }}
                  className="size-4"
                />
              </label>
            );
          })}

          <button
            type="button"
            onClick={() => {
              void handleSaveRestrictions();
            }}
            disabled={isSavingRestrictions || !selectedChildUserId}
            className="inline-flex w-full items-center justify-center rounded-xl border border-brand/35 bg-brand/15 px-4 py-2 text-sm font-semibold text-brand-muted transition hover:border-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingRestrictions ? "Saving..." : "Save child restrictions"}
          </button>

          {childRestrictions ? (
            <p className="text-xs text-foreground/70">
              Effective lanes for @{childRestrictions.childUsername}: {" "}
              {childRestrictions.effectiveContentPreferences.effectiveContentTypes
                .map((contentType) => contentType.name)
                .join(", ") || "none"}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-foreground/70">
          No active child links yet. Send a request and have the learner accept it.
        </p>
      )}

      {isLoading ? <p className="mt-3 text-xs text-foreground/70">Loading...</p> : null}

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
