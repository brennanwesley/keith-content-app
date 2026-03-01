"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getContentTypes, type ContentTypeSummary } from "@/lib/apiClient";

type Outcome = {
  type: "success" | "error";
  message: string;
};

export default function DemoContentSelectionPage() {
  const router = useRouter();
  const [contentTypes, setContentTypes] = useState<ContentTypeSummary[]>([]);
  const [selectedContentTypeIds, setSelectedContentTypeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadContentTypes = async () => {
      try {
        const availableContentTypes = await getContentTypes();

        if (cancelled) {
          return;
        }

        setContentTypes(availableContentTypes);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load content types right now.";

        setOutcome({ type: "error", message });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadContentTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleContentType = (contentTypeId: string) => {
    setSelectedContentTypeIds((currentIds) => {
      if (currentIds.includes(contentTypeId)) {
        return currentIds.filter((currentId) => currentId !== contentTypeId);
      }

      return [...currentIds, contentTypeId];
    });

    setOutcome(null);
  };

  const handleStartLearning = () => {
    router.push("/demo/feed/youth-hockey");
  };

  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_24px_80px_-36px_rgba(254,44,85,0.42)] ring-1 ring-accent/25 backdrop-blur-sm sm:p-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-muted">
            Demo mode
          </p>
          <h1 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-brand bg-clip-text text-3xl text-transparent">
            Content Selection
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/80">
            Explore the experience instantly. Demo preferences are temporary and are not saved
            to an account.
          </p>
        </header>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-foreground/75">
          Selected (demo only): {selectedContentTypeIds.length}
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-foreground/70">Loading available content types...</p>
        ) : (
          <div className="mt-6 space-y-3">
            {contentTypes.map((contentType) => {
              const isSelected = selectedContentTypeIds.includes(contentType.id);

              return (
                <button
                  key={contentType.id}
                  type="button"
                  onClick={() => {
                    toggleContentType(contentType.id);
                  }}
                  className={`w-full rounded-3xl border px-5 py-5 text-left transition ${
                    isSelected
                      ? "border-brand/60 bg-brand/10 shadow-[0_18px_40px_-25px_rgba(37,244,238,0.55)]"
                      : "border-brand/30 bg-surface-soft hover:-translate-y-0.5 hover:border-accent/55"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{contentType.name}</p>
                      <p className="mt-1 text-sm text-foreground/75">{contentType.description}</p>
                    </div>
                    <span
                      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                        isSelected
                          ? "border-brand bg-brand text-background"
                          : "border-white/25 bg-black/30 text-foreground/65"
                      }`}
                      aria-hidden
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  </div>
                </button>
              );
            })}

            {contentTypes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-accent/35 bg-black/30 px-4 py-3 text-sm text-foreground/70">
                No content types are available yet.
              </p>
            ) : null}
          </div>
        )}

        {outcome ? (
          <p
            className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
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
          onClick={handleStartLearning}
          disabled={isLoading}
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-brand px-5 py-3 text-base font-extrabold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Start Learning
        </button>

        <footer className="mt-auto flex items-center justify-between gap-4 pt-6">
          <Link
            href="/demo/settings"
            className="text-sm font-semibold text-brand-muted hover:text-accent-strong"
          >
            ← Account Settings
          </Link>
          <Link
            href="/demo/feed/youth-hockey"
            className="text-sm font-semibold text-brand-muted hover:text-accent-strong"
          >
            Skip →
          </Link>
        </footer>
      </section>
    </main>
  );
}
