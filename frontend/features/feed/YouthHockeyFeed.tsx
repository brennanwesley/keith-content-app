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
    <main className="relative h-[100dvh] overflow-hidden bg-[#081923] text-white">
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

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/75" />

            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <Link
                href="/content"
                className="pointer-events-auto rounded-full border border-white/30 bg-black/35 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/95"
              >
                Topics
              </Link>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                Youth Hockey
              </p>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                Clip {index + 1} of {youthHockeyVideos.length}
              </p>
              <h2 className="mt-2 font-brand text-3xl leading-tight text-white">{video.caption}</h2>
              <p className="mt-2 text-sm text-white/80">Swipe up anytime for the next lesson.</p>
            </div>

            {needsTapToStart && index === activePanelIndex ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 px-6">
                <button
                  type="button"
                  onClick={() => {
                    void handleTapToStart();
                  }}
                  className="rounded-2xl border border-white/40 bg-white/20 px-6 py-3 text-base font-bold text-white backdrop-blur-sm"
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
          className="flex h-[100dvh] snap-start items-center justify-center bg-gradient-to-b from-[#0d2735] to-[#143b4d] px-6"
        >
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-7 text-center backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
              That&apos;s all for now
            </p>
            <h2 className="font-brand mt-3 text-3xl text-white">More videos coming soon!</h2>
            <button
              type="button"
              onClick={handleReplay}
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#2d8ca5] px-4 py-3 text-base font-bold text-white transition hover:bg-[#236f83]"
            >
              Replay
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
