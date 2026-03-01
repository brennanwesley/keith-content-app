"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createAdminVideo,
  createMuxDirectUpload,
  getContentTypes,
  listAdminVideos,
  updateAdminVideo,
  type AdminVideoSummary,
  type ContentTypeSummary,
  type VideoStatus,
} from "@/lib/apiClient";
import { clearAuthSession, readAuthSession } from "@/lib/authSession";

type Outcome = {
  type: "success" | "error";
  message: string;
};

type CreateFormState = {
  title: string;
  description: string;
  status: VideoStatus;
  durationSeconds: string;
  thumbnailUrl: string;
  contentTypeIds: string[];
};

type ManagedVideoDraft = {
  status: VideoStatus;
  contentTypeIds: string[];
};

const videoStatuses: VideoStatus[] = [
  "draft",
  "processing",
  "ready",
  "blocked",
  "archived",
];

const initialCreateFormState: CreateFormState = {
  title: "",
  description: "",
  status: "draft",
  durationSeconds: "",
  thumbnailUrl: "",
  contentTypeIds: [],
};

function buildManagedDraftMap(
  videos: AdminVideoSummary[],
): Record<string, ManagedVideoDraft> {
  const draftByVideoId: Record<string, ManagedVideoDraft> = {};

  for (const video of videos) {
    draftByVideoId[video.id] = {
      status: video.status,
      contentTypeIds: [...video.contentTypeIds],
    };
  }

  return draftByVideoId;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function AdminContentPage() {
  const [authSession, setAuthSession] = useState(() => readAuthSession());
  const [contentTypes, setContentTypes] = useState<ContentTypeSummary[]>([]);
  const [videos, setVideos] = useState<AdminVideoSummary[]>([]);
  const [createFormState, setCreateFormState] =
    useState<CreateFormState>(initialCreateFormState);
  const [managedVideoDraftById, setManagedVideoDraftById] = useState<
    Record<string, ManagedVideoDraft>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [updatingVideoId, setUpdatingVideoId] = useState<string | null>(null);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const [selectedUploadFileByVideoId, setSelectedUploadFileByVideoId] = useState<
    Record<string, File | null>
  >({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const isAdmin = authSession?.user.accountType === "admin";

  const loadAdminData = async (accessToken: string) => {
    const [availableContentTypes, adminVideos] = await Promise.all([
      getContentTypes(),
      listAdminVideos(accessToken),
    ]);

    setContentTypes(availableContentTypes);
    setVideos(adminVideos);
    setManagedVideoDraftById(buildManagedDraftMap(adminVideos));
  };

  const refreshAdminData = async (accessToken: string) => {
    setIsLoading(true);
    setOutcome(null);

    try {
      await loadAdminData(accessToken);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to refresh admin data right now.";

      setOutcome({ type: "error", message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateAdminData = async () => {
      if (!authSession) {
        setIsLoading(false);
        return;
      }

      if (authSession.user.accountType !== "admin") {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        await loadAdminData(authSession.accessToken);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load admin content controls right now.";

        setOutcome({ type: "error", message });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void hydrateAdminData();

    return () => {
      cancelled = true;
    };
  }, [authSession]);

  const handleToggleCreateTag = (contentTypeId: string) => {
    setCreateFormState((current) => {
      if (current.contentTypeIds.includes(contentTypeId)) {
        return {
          ...current,
          contentTypeIds: current.contentTypeIds.filter((id) => id !== contentTypeId),
        };
      }

      return {
        ...current,
        contentTypeIds: [...current.contentTypeIds, contentTypeId],
      };
    });
  };

  const handleToggleManagedTag = (videoId: string, contentTypeId: string) => {
    setManagedVideoDraftById((currentDraftByVideoId) => {
      const currentDraft = currentDraftByVideoId[videoId];

      if (!currentDraft) {
        return currentDraftByVideoId;
      }

      const nextIds = currentDraft.contentTypeIds.includes(contentTypeId)
        ? currentDraft.contentTypeIds.filter((id) => id !== contentTypeId)
        : [...currentDraft.contentTypeIds, contentTypeId];

      return {
        ...currentDraftByVideoId,
        [videoId]: {
          ...currentDraft,
          contentTypeIds: nextIds,
        },
      };
    });
  };

  const handleCreateVideo = async () => {
    if (!authSession || !isAdmin) {
      setOutcome({
        type: "error",
        message: "Only admin accounts can create videos.",
      });
      return;
    }

    if (!createFormState.title.trim()) {
      setOutcome({
        type: "error",
        message: "Video title is required.",
      });
      return;
    }

    const trimmedDuration = createFormState.durationSeconds.trim();
    let parsedDuration: number | null | undefined;

    if (trimmedDuration.length > 0) {
      const numericDuration = Number(trimmedDuration);

      if (!Number.isInteger(numericDuration) || numericDuration < 0) {
        setOutcome({
          type: "error",
          message: "Duration must be a non-negative whole number.",
        });
        return;
      }

      parsedDuration = numericDuration;
    }

    setIsSubmittingCreate(true);
    setOutcome(null);

    try {
      const createdVideo = await createAdminVideo(authSession.accessToken, {
        title: createFormState.title,
        description:
          createFormState.description.trim().length > 0
            ? createFormState.description.trim()
            : null,
        status: createFormState.status,
        durationSeconds: parsedDuration,
        thumbnailUrl:
          createFormState.thumbnailUrl.trim().length > 0
            ? createFormState.thumbnailUrl.trim()
            : null,
        contentTypeIds: createFormState.contentTypeIds,
      });

      const nextVideos = [createdVideo, ...videos];
      setVideos(nextVideos);
      setManagedVideoDraftById(buildManagedDraftMap(nextVideos));
      setCreateFormState(initialCreateFormState);
      setOutcome({
        type: "success",
        message: `Video \"${createdVideo.title}\" created successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create video right now.";

      setOutcome({ type: "error", message });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleSaveManagedVideo = async (videoId: string) => {
    if (!authSession || !isAdmin) {
      setOutcome({
        type: "error",
        message: "Only admin accounts can update videos.",
      });
      return;
    }

    const draft = managedVideoDraftById[videoId];

    if (!draft) {
      return;
    }

    setUpdatingVideoId(videoId);
    setOutcome(null);

    try {
      const updatedVideo = await updateAdminVideo(authSession.accessToken, videoId, {
        status: draft.status,
        contentTypeIds: draft.contentTypeIds,
      });

      const nextVideos = videos.map((video) =>
        video.id === updatedVideo.id ? updatedVideo : video,
      );

      setVideos(nextVideos);
      setManagedVideoDraftById(buildManagedDraftMap(nextVideos));
      setOutcome({
        type: "success",
        message: `Updated \"${updatedVideo.title}\" successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update video right now.";

      setOutcome({ type: "error", message });
    } finally {
      setUpdatingVideoId(null);
    }
  };

  const handleUploadVideoToMux = async (videoId: string) => {
    if (!authSession || !isAdmin) {
      setOutcome({
        type: "error",
        message: "Only admin accounts can upload videos to Mux.",
      });
      return;
    }

    const selectedFile = selectedUploadFileByVideoId[videoId] ?? null;

    if (!selectedFile) {
      setOutcome({
        type: "error",
        message: "Please choose an MP4 file before uploading to Mux.",
      });
      return;
    }

    setUploadingVideoId(videoId);
    setOutcome(null);

    try {
      const directUpload = await createMuxDirectUpload(authSession.accessToken, {
        videoId,
        playbackPolicy: "public",
      });

      const uploadResponse = await fetch(directUpload.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Mux upload failed with HTTP ${uploadResponse.status}.`);
      }

      setSelectedUploadFileByVideoId((currentSelection) => ({
        ...currentSelection,
        [videoId]: null,
      }));

      setOutcome({
        type: "success",
        message:
          "Upload sent to Mux. Processing has started and status will update after webhook events arrive.",
      });

      await refreshAdminData(authSession.accessToken);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload this file to Mux right now.";

      setOutcome({ type: "error", message });
    } finally {
      setUploadingVideoId(null);
    }
  };

  const handleSignOut = () => {
    clearAuthSession();
    setAuthSession(null);
  };

  if (!authSession) {
    return (
      <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
        <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col justify-center rounded-3xl border border-white/10 bg-surface/95 p-6 text-center shadow-[0_24px_80px_-36px_rgba(254,44,85,0.42)] ring-1 ring-accent/25 backdrop-blur-sm sm:p-8">
          <p className="text-sm text-foreground/80">
            Admin session missing. Please log in with your admin account.
          </p>
          <Link href="/auth" className="mt-4 text-sm font-semibold text-brand-muted hover:text-accent-strong">
            Go to account login →
          </Link>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
        <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col justify-center rounded-3xl border border-white/10 bg-surface/95 p-6 text-center shadow-[0_24px_80px_-36px_rgba(254,44,85,0.42)] ring-1 ring-accent/25 backdrop-blur-sm sm:p-8">
          <p className="text-sm text-foreground/80">
            This area is restricted to admin accounts.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Link href="/settings" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
              Go to settings
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm font-semibold text-accent-strong hover:text-brand-muted"
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-5xl flex-col rounded-3xl border border-white/10 bg-surface/95 p-6 shadow-[0_24px_80px_-36px_rgba(37,244,238,0.45)] ring-1 ring-brand/20 backdrop-blur-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-brand-muted">
              Day 4 admin controls
            </p>
            <h1 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-accent bg-clip-text text-3xl text-transparent">
              Content Studio
            </h1>
            <p className="mt-3 text-sm leading-6 text-foreground/80">
              Create videos, set readiness states, and assign one or more content tags.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!authSession) {
                  return;
                }

                void refreshAdminData(authSession.accessToken);
              }}
              className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-foreground/80 hover:text-foreground"
            >
              Refresh
            </button>
            <Link href="/settings" className="text-sm font-semibold text-brand-muted hover:text-accent-strong">
              Settings
            </Link>
          </div>
        </header>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Create video
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold text-foreground/80">Title</span>
              <input
                type="text"
                value={createFormState.title}
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    title: event.target.value,
                  }));
                }}
                className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                placeholder="Youth Hockey Positioning Basics"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-foreground/80">Status</span>
              <select
                value={createFormState.status}
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    status: event.target.value as VideoStatus,
                  }));
                }}
                className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
              >
                {videoStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold text-foreground/80">Description</span>
              <textarea
                value={createFormState.description}
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    description: event.target.value,
                  }));
                }}
                rows={3}
                className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                placeholder="Optional short overview for coaches, learners, and parents."
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-foreground/80">Duration seconds</span>
              <input
                type="number"
                min={0}
                step={1}
                value={createFormState.durationSeconds}
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    durationSeconds: event.target.value,
                  }));
                }}
                className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                placeholder="95"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-foreground/80">Thumbnail URL</span>
              <input
                type="url"
                value={createFormState.thumbnailUrl}
                onChange={(event) => {
                  setCreateFormState((current) => ({
                    ...current,
                    thumbnailUrl: event.target.value,
                  }));
                }}
                className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                placeholder="https://example.com/thumb.jpg"
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">
              Content tags (multi-select)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {contentTypes.map((contentType) => {
                const isSelected = createFormState.contentTypeIds.includes(contentType.id);

                return (
                  <button
                    key={contentType.id}
                    type="button"
                    onClick={() => {
                      handleToggleCreateTag(contentType.id);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      isSelected
                        ? "border-brand/60 bg-brand/20 text-brand-muted"
                        : "border-white/20 bg-black/35 text-foreground/75 hover:text-foreground"
                    }`}
                  >
                    {contentType.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void handleCreateVideo();
            }}
            disabled={isSubmittingCreate}
            className="mt-5 rounded-2xl bg-gradient-to-r from-accent to-brand px-4 py-2 text-sm font-extrabold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmittingCreate ? "Creating..." : "Create video"}
          </button>
        </div>

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

        <section className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Manage videos
          </h2>

          {isLoading ? (
            <p className="mt-3 text-sm text-foreground/75">Loading admin videos...</p>
          ) : videos.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/75">No videos created yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {videos.map((video) => {
                const managedDraft = managedVideoDraftById[video.id];

                return (
                  <article
                    key={video.id}
                    className="rounded-2xl border border-white/10 bg-surface-soft/70 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{video.title}</h3>
                        {video.description ? (
                          <p className="mt-1 text-xs text-foreground/70">{video.description}</p>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-brand/35 bg-brand/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-muted">
                        {video.status}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-foreground/60">
                      Created: {formatDateTime(video.createdAt)} • Published: {formatDateTime(video.publishedAt)}
                    </p>

                    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/75">
                        Mux upload
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="video/mp4"
                          onChange={(event) => {
                            const selectedFile = event.target.files?.[0] ?? null;
                            setSelectedUploadFileByVideoId((currentSelection) => ({
                              ...currentSelection,
                              [video.id]: selectedFile,
                            }));
                          }}
                          className="max-w-full text-xs text-foreground/75 file:mr-3 file:rounded-lg file:border file:border-white/20 file:bg-black/35 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground/80"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void handleUploadVideoToMux(video.id);
                          }}
                          disabled={uploadingVideoId === video.id}
                          className="rounded-xl border border-accent/35 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent-strong transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadingVideoId === video.id
                            ? "Uploading..."
                            : "Upload MP4 to Mux"}
                        </button>
                      </div>

                      {selectedUploadFileByVideoId[video.id] ? (
                        <p className="mt-2 text-[11px] text-foreground/65">
                          Selected file: {selectedUploadFileByVideoId[video.id]?.name}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[200px,1fr]">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-foreground/80">Status</span>
                        <select
                          value={managedDraft?.status ?? video.status}
                          onChange={(event) => {
                            const nextStatus = event.target.value as VideoStatus;
                            setManagedVideoDraftById((currentDraftByVideoId) => ({
                              ...currentDraftByVideoId,
                              [video.id]: {
                                status: nextStatus,
                                contentTypeIds:
                                  currentDraftByVideoId[video.id]?.contentTypeIds ??
                                  [...video.contentTypeIds],
                              },
                            }));
                          }}
                          className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                        >
                          {videoStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div>
                        <p className="text-xs font-semibold text-foreground/80">Content tags</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {contentTypes.map((contentType) => {
                            const selectedIds =
                              managedDraft?.contentTypeIds ?? video.contentTypeIds;
                            const isSelected = selectedIds.includes(contentType.id);

                            return (
                              <button
                                key={`${video.id}-${contentType.id}`}
                                type="button"
                                onClick={() => {
                                  handleToggleManagedTag(video.id, contentType.id);
                                }}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                  isSelected
                                    ? "border-brand/60 bg-brand/20 text-brand-muted"
                                    : "border-white/20 bg-black/35 text-foreground/75 hover:text-foreground"
                                }`}
                              >
                                {contentType.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveManagedVideo(video.id);
                      }}
                      disabled={updatingVideoId === video.id}
                      className="mt-4 rounded-xl border border-brand/35 bg-brand/15 px-3 py-2 text-xs font-semibold text-brand-muted transition hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingVideoId === video.id ? "Saving..." : "Save changes"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
