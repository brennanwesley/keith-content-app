"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getFeedCatalog } from "@/lib/apiClient";
import { readAuthSession } from "@/lib/authSession";
import { youthHockeyVideos } from "./videoData";

type FeedSource = "backend" | "static";

type YouthHockeyFeedProps = {
  backHref?: string;
  settingsHref?: string;
  source?: FeedSource;
};

type TapFeedbackState = {
  icon: "play" | "pause";
  panelIndex: number;
  isVisible: boolean;
};

export function YouthHockeyFeed({
  backHref = "/content",
  settingsHref = "/settings",
  source = "backend",
}: YouthHockeyFeedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<Array<HTMLElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const tapFeedbackFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const tapFeedbackClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const [feedVideos, setFeedVideos] = useState(() =>
    source === "static" ? youthHockeyVideos : [],
  );
  const [isCatalogLoading, setIsCatalogLoading] = useState(
    source === "backend",
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [needsTapToStart, setNeedsTapToStart] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [tapFeedback, setTapFeedback] = useState<TapFeedbackState | null>(null);
  const endPanelIndex = feedVideos.length;

  useEffect(() => {
    if (source === "static") {
      setFeedVideos(youthHockeyVideos);
      setCatalogError(null);
      setIsCatalogLoading(false);
      return;
    }

    const authSession = readAuthSession();

    if (!authSession) {
      setFeedVideos([]);
      setCatalogError("Session expired. Please return to Content Selection and sign in again.");
      setIsCatalogLoading(false);
      return;
    }

    let cancelled = false;

    const loadFeedCatalog = async () => {
      setIsCatalogLoading(true);
      setCatalogError(null);

      try {
        const catalog = await getFeedCatalog(authSession.accessToken);

        if (cancelled) {
          return;
        }

        setFeedVideos(
          catalog.videos.map((video, index) => ({
            id: video.id,
            src: video.playbackUrl,
            caption:
              video.title.trim().length > 0 ? video.title : `Lesson clip ${index + 1}`,
          })),
        );
        setActivePanelIndex(0);
        setNeedsTapToStart(false);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load your feed catalog right now.";

        setFeedVideos([]);
        setCatalogError(message);
      } finally {
        if (!cancelled) {
          setIsCatalogLoading(false);
        }
      }
    };

    void loadFeedCatalog();

    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    const rootElement = containerRef.current;

    if (!rootElement) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

        if (!visibleEntry) {
          return;
        }

        const panelIndex = panelRefs.current.findIndex(
          (panelElement) => panelElement === visibleEntry.target,
        );

        if (panelIndex >= 0) {
          setActivePanelIndex((currentIndex) =>
            currentIndex === panelIndex ? currentIndex : panelIndex,
          );
        }
      },
      {
        root: rootElement,
        threshold: [0.55, 0.7, 0.9],
      },
    );

    panelRefs.current.forEach((panelElement) => {
      if (panelElement) {
        observer.observe(panelElement);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [feedVideos.length]);

  useEffect(() => {
    return () => {
      if (tapFeedbackFadeTimeoutRef.current) {
        clearTimeout(tapFeedbackFadeTimeoutRef.current);
      }

      if (tapFeedbackClearTimeoutRef.current) {
        clearTimeout(tapFeedbackClearTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncPlayback = async () => {
      videoRefs.current.forEach((videoElement, videoIndex) => {
        if (!videoElement) {
          return;
        }

        if (videoIndex !== activePanelIndex) {
          videoElement.pause();
        }
      });

      if (activePanelIndex >= feedVideos.length) {
        return;
      }

      const activeVideo = videoRefs.current[activePanelIndex];

      if (!activeVideo) {
        return;
      }

      const nextVideo = videoRefs.current[activePanelIndex + 1];

      if (nextVideo) {
        nextVideo.preload = "auto";
      }

      activeVideo.muted = false;
      activeVideo.defaultMuted = false;
      activeVideo.volume = 1;
      activeVideo.preload = "auto";

      try {
        await activeVideo.play();

        if (!cancelled) {
          setNeedsTapToStart(false);
        }
      } catch {
        if (!cancelled && !hasUserInteracted) {
          setNeedsTapToStart(true);
        }
      }
    };

    void syncPlayback();

    return () => {
      cancelled = true;
    };
  }, [activePanelIndex, feedVideos.length, hasUserInteracted]);

  const handleTapToStart = async () => {
    const activeVideo = videoRefs.current[activePanelIndex];

    if (!activeVideo) {
      return;
    }

    setHasUserInteracted(true);
    setNeedsTapToStart(false);

    activeVideo.muted = false;

    try {
      await activeVideo.play();
    } catch {
      setNeedsTapToStart(true);
    }
  };

  const showTapFeedback = (
    icon: TapFeedbackState["icon"],
    panelIndex: number,
  ) => {
    if (tapFeedbackFadeTimeoutRef.current) {
      clearTimeout(tapFeedbackFadeTimeoutRef.current);
    }

    if (tapFeedbackClearTimeoutRef.current) {
      clearTimeout(tapFeedbackClearTimeoutRef.current);
    }

    setTapFeedback({
      icon,
      panelIndex,
      isVisible: true,
    });

    tapFeedbackFadeTimeoutRef.current = setTimeout(() => {
      setTapFeedback((current) => {
        if (!current || current.panelIndex !== panelIndex) {
          return current;
        }

        return {
          ...current,
          isVisible: false,
        };
      });
    }, 180);

    tapFeedbackClearTimeoutRef.current = setTimeout(() => {
      setTapFeedback((current) => {
        if (!current || current.panelIndex !== panelIndex) {
          return current;
        }

        return null;
      });
    }, 520);
  };

  const handleVideoTap = async (panelIndex: number) => {
    if (panelIndex !== activePanelIndex || panelIndex >= feedVideos.length) {
      return;
    }

    const activeVideo = videoRefs.current[panelIndex];

    if (!activeVideo) {
      return;
    }

    setHasUserInteracted(true);

    if (activeVideo.paused || activeVideo.ended) {
      activeVideo.muted = false;
      activeVideo.defaultMuted = false;

      try {
        await activeVideo.play();
        setNeedsTapToStart(false);
        showTapFeedback("play", panelIndex);
      } catch {
        setNeedsTapToStart(true);
      }

      return;
    }

    activeVideo.pause();
    setNeedsTapToStart(false);
    showTapFeedback("pause", panelIndex);
  };

  const handleReplay = () => {
    const firstVideo = videoRefs.current[0];

    if (firstVideo) {
      firstVideo.currentTime = 0;
    }

    setActivePanelIndex(0);
    setNeedsTapToStart(false);

    containerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#040406] text-white">
      <div
        ref={containerRef}
        className="h-[100dvh] snap-y snap-mandatory overflow-y-auto overscroll-y-contain scroll-smooth"
      >
        {isCatalogLoading ? (
          <section className="flex h-[100dvh] snap-start items-center justify-center bg-gradient-to-b from-[#08080f] via-[#0c0b14] to-[#12060c] px-6 text-center">
            <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-black/45 p-7 shadow-[0_26px_65px_-38px_rgba(37,244,238,0.6)] ring-1 ring-brand/25 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                Feed loading
              </p>
              <h2 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-accent bg-clip-text text-3xl text-transparent">
                Loading your ready videos...
              </h2>
            </div>
          </section>
        ) : catalogError ? (
          <section className="flex h-[100dvh] snap-start items-center justify-center bg-gradient-to-b from-[#08080f] via-[#0c0b14] to-[#12060c] px-6 text-center">
            <div className="w-full max-w-sm rounded-3xl border border-accent/35 bg-black/45 p-7 shadow-[0_26px_65px_-38px_rgba(254,44,85,0.65)] ring-1 ring-accent/25 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-strong">
                Feed unavailable
              </p>
              <p className="mt-3 text-sm text-white/85">{catalogError}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={backHref}
                  className="rounded-xl border border-brand/45 bg-black/55 px-4 py-2 text-sm font-semibold text-brand-muted transition hover:text-white"
                >
                  Back to content
                </Link>
                <Link
                  href={settingsHref}
                  className="rounded-xl border border-brand/45 bg-black/55 px-4 py-2 text-sm font-semibold text-brand-muted transition hover:text-white"
                >
                  Settings
                </Link>
              </div>
            </div>
          </section>
        ) : feedVideos.length === 0 ? (
          <section className="flex h-[100dvh] snap-start items-center justify-center bg-gradient-to-b from-[#08080f] via-[#0c0b14] to-[#12060c] px-6 text-center">
            <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-black/45 p-7 shadow-[0_26px_65px_-38px_rgba(37,244,238,0.6)] ring-1 ring-brand/25 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                No eligible clips yet
              </p>
              <p className="mt-3 text-sm text-white/85">
                Your feed has no ready videos that match your allowed content preferences.
              </p>
              <Link
                href={backHref}
                className="mt-5 inline-flex rounded-xl border border-brand/45 bg-black/55 px-4 py-2 text-sm font-semibold text-brand-muted transition hover:text-white"
              >
                Back to content
              </Link>
            </div>
          </section>
        ) : (
          feedVideos.map((video, index) => (
          <section
            key={video.id}
            ref={(panelElement) => {
              panelRefs.current[index] = panelElement;
            }}
            className="relative h-[100dvh] snap-start overflow-hidden"
          >
            <video
              ref={(videoElement) => {
                videoRefs.current[index] = videoElement;
              }}
              src={video.src}
              className="h-full w-full object-cover"
              onClick={() => {
                void handleVideoTap(index);
              }}
              loop
              playsInline
              autoPlay
              controls={false}
              preload={index <= activePanelIndex + 1 ? "auto" : "metadata"}
              disablePictureInPicture
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/72 via-black/10 to-black/82" />

            {tapFeedback && tapFeedback.panelIndex === index ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <div
                  className={`flex size-20 items-center justify-center rounded-full border border-white/35 bg-black/55 text-4xl text-white shadow-[0_18px_38px_-24px_rgba(0,0,0,0.8)] backdrop-blur-sm transition-all duration-300 ${
                    tapFeedback.isVisible ? "scale-100 opacity-100" : "scale-110 opacity-0"
                  }`}
                >
                  <span aria-hidden>{tapFeedback.icon === "pause" ? "⏸" : "▶"}</span>
                </div>
              </div>
            ) : null}

            <div className="absolute inset-x-0 top-0 z-10 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <Link
                href={backHref}
                aria-label="Back to content selection"
                className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-brand/45 bg-black/55 text-lg font-bold text-brand-muted transition hover:border-accent/50 hover:text-white"
              >
                <span aria-hidden>←</span>
              </Link>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-accent/90">
                Youth Hockey
              </p>
              <Link
                href={settingsHref}
                aria-label="Open settings"
                className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-brand/45 bg-black/55 text-sm font-bold text-brand-muted transition hover:border-accent/50 hover:text-white"
              >
                <span aria-hidden>⚙</span>
              </Link>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                Clip {index + 1} of {feedVideos.length}
              </p>
              <h2 className="font-brand mt-2 bg-gradient-to-r from-white via-brand-muted to-accent bg-clip-text text-3xl leading-tight text-transparent">
                {video.caption}
              </h2>
              <p className="mt-2 text-sm text-white/80">Swipe up anytime for the next lesson.</p>
            </div>

            {needsTapToStart && index === activePanelIndex ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-6">
                <button
                  type="button"
                  onClick={() => {
                    void handleTapToStart();
                  }}
                  className="rounded-2xl border border-white/20 bg-gradient-to-r from-accent to-brand px-6 py-3 text-base font-bold text-background shadow-[0_20px_36px_-22px_rgba(254,44,85,0.85)]"
                >
                  Tap to start with sound
                </button>
              </div>
            ) : null}
          </section>
          ))
        )}

        {!isCatalogLoading && !catalogError && feedVideos.length > 0 ? (
          <section
            ref={(panelElement) => {
              panelRefs.current[endPanelIndex] = panelElement;
            }}
            className="flex h-[100dvh] snap-start items-center justify-center bg-gradient-to-b from-[#09090f] via-[#0c0b14] to-[#12060c] px-6"
          >
            <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-black/45 p-7 text-center shadow-[0_26px_65px_-38px_rgba(37,244,238,0.6)] ring-1 ring-brand/25 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                That&apos;s all for now
              </p>
              <h2 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-accent bg-clip-text text-3xl text-transparent">
                More videos coming soon!
              </h2>
              <button
                type="button"
                onClick={handleReplay}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-base font-extrabold text-background transition hover:brightness-110"
              >
                Replay
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
