"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getContentTypes,
  getMyContentPreferences,
  updateMyContentPreferences,
  type ContentTypeSummary,
} from "@/lib/apiClient";
import type { StoredAuthSession } from "@/lib/authSession";

type Outcome = {
  type: "success" | "error";
  message: string;
};

type ContentPreferencesTabProps = {
  authSession: StoredAuthSession | null;
  isSessionReady: boolean;
};

export function ContentPreferencesTab({
  authSession,
  isSessionReady,
}: ContentPreferencesTabProps) {
  const [contentTypes, setContentTypes] = useState<ContentTypeSummary[]>([]);
  const [selectedContentTypeIds, setSelectedContentTypeIds] = useState<string[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!isSessionReady || !authSession) {
      setContentTypes([]);
      setSelectedContentTypeIds([]);
      return;
    }

    let cancelled = false;

    const loadContentPreferences = async () => {
      setIsLoadingContent(true);
      setOutcome(null);

      try {
        const [availableContentTypes, savedPreferences] = await Promise.all([
          getContentTypes(),
          getMyContentPreferences(authSession.accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setContentTypes(availableContentTypes);
        setSelectedContentTypeIds(savedPreferences.selectedContentTypeIds);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Failed to load content preferences.";

        setOutcome({ type: "error", message });
      } finally {
        if (!cancelled) {
          setIsLoadingContent(false);
        }
      }
    };

    void loadContentPreferences();

    return () => {
      cancelled = true;
    };
  }, [authSession, isSessionReady]);

  const toggleContentType = (contentTypeId: string) => {
    setSelectedContentTypeIds((currentIds) => {
      if (currentIds.includes(contentTypeId)) {
        return currentIds.filter((currentId) => currentId !== contentTypeId);
      }

      return [...currentIds, contentTypeId];
    });

    setOutcome(null);
  };

  const handleSave = async () => {
    if (!authSession) {
      setOutcome({
        type: "error",
        message: "Please log in first before updating content preferences.",
      });
      return;
    }

    setIsSavingContent(true);
    setOutcome(null);

    try {
      const updatedPreferences = await updateMyContentPreferences(
        authSession.accessToken,
        {
          contentTypeIds: selectedContentTypeIds,
        },
      );

      setSelectedContentTypeIds(updatedPreferences.selectedContentTypeIds);
      setOutcome({ type: "success", message: "Content preferences saved." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save content preferences.";

      setOutcome({ type: "error", message });
    } finally {
      setIsSavingContent(false);
    }
  };

  if (isSessionReady && !authSession) {
    return (
      <div className="space-y-3">
        <p>You need an active account session to manage content preferences.</p>
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
      <p>Select the content lanes you want included in your feed.</p>

      {isLoadingContent ? (
        <p className="text-xs text-foreground/70">Loading options...</p>
      ) : null}

      {!isLoadingContent && contentTypes.length === 0 ? (
        <p className="text-xs text-foreground/70">No content types are available yet.</p>
      ) : null}

      <div className="space-y-2">
        {contentTypes.map((contentType) => {
          const isSelected = selectedContentTypeIds.includes(contentType.id);

          return (
            <label
              key={contentType.id}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-white/12 bg-surface-soft/40 px-3 py-2"
            >
              <span className="text-sm font-semibold text-foreground/90">
                {contentType.name}
              </span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  toggleContentType(contentType.id);
                }}
                className="size-4 rounded border-white/20"
              />
            </label>
          );
        })}
      </div>

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
        type="button"
        onClick={() => {
          void handleSave();
        }}
        disabled={!authSession || isSavingContent || isLoadingContent}
        className="inline-flex w-full items-center justify-center rounded-xl border border-brand/35 bg-brand/15 px-4 py-2 text-sm font-semibold text-brand-muted transition hover:border-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSavingContent ? "Saving..." : "Save content preferences"}
      </button>
    </div>
  );
}
