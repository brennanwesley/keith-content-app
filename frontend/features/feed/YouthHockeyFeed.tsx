"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { youthHockeyVideos } from "./videoData";

const END_PANEL_INDEX = youthHockeyVideos.length;

export function YouthHockeyFeed() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<Array<HTMLElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const [needsTapToStart, setNeedsTapToStart] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

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

      if (activePanelIndex >= youthHockeyVideos.length) {
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
  }, [activePanelIndex, hasUserInteracted]);

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
        {youthHockeyVideos.map((video, index) => (
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
              loop
              playsInline
              autoPlay
              controls={false}
              preload={index <= activePanelIndex + 1 ? "auto" : "metadata"}
              disablePictureInPicture
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/72 via-black/10 to-black/82" />

            <div className="absolute inset-x-0 top-0 z-10 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <Link
                href="/content"
                aria-label="Back to content selection"
                className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-brand/45 bg-black/55 text-lg font-bold text-brand-muted transition hover:border-accent/50 hover:text-white"
              >
                <span aria-hidden>←</span>
              </Link>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-accent/90">
                Youth Hockey
              </p>
              <Link
                href="/settings"
                aria-label="Open settings"
                className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-brand/45 bg-black/55 text-sm font-bold text-brand-muted transition hover:border-accent/50 hover:text-white"
              >
                <span aria-hidden>⚙</span>
              </Link>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                Clip {index + 1} of {youthHockeyVideos.length}
              </p>
              <h2 className="font-brand mt-2 bg-gradient-to-r from-white via-brand-muted to-accent bg-clip-text text-3xl leading-tight text-transparent">
                {video.caption}
              </h2>
              <p className="mt-2 text-sm text-white/80">Swipe up anytime for the next lesson.</p>
            </div>

            {needsTapToStart && index === activePanelIndex ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 px-6">
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
        ))}

        <section
          ref={(panelElement) => {
            panelRefs.current[END_PANEL_INDEX] = panelElement;
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
      </div>
    </main>
  );
}
