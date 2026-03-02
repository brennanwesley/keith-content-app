"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  archiveAdminContentTag,
  createAdminVideo,
  createAdminContentTag,
  createMuxDirectUpload,
  listAdminContentTags,
  listAdminVideos,
  unarchiveAdminContentTag,
  updateAdminVideo,
  updateAdminContentTag,
  type AdminContentTagSummary,
  type AdminVideoSummary,
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
  contentTagIds: string[];
};

type ManagedVideoDraft = {
  title: string;
  description: string;
  thumbnailUrl: string;
  status: VideoStatus;
  contentTagIds: string[];
};

type ManagedContentTagDraft = {
  name: string;
  description: string;
};

type CreateContentTagFormState = {
  name: string;
  description: string;
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
  contentTagIds: [],
};

const initialCreateContentTagFormState: CreateContentTagFormState = {
  name: "",
  description: "",
};

function sortContentTagsByName(
  contentTags: AdminContentTagSummary[],
): AdminContentTagSummary[] {
  return [...contentTags].sort((firstTag, secondTag) =>
    firstTag.name.localeCompare(secondTag.name),
  );
}

function buildManagedDraftMap(
  videos: AdminVideoSummary[],
): Record<string, ManagedVideoDraft> {
  const draftByVideoId: Record<string, ManagedVideoDraft> = {};

  for (const video of videos) {
    draftByVideoId[video.id] = {
      title: video.title,
      description: video.description ?? "",
      thumbnailUrl: video.thumbnailUrl ?? "",
      status: video.status,
      contentTagIds: [...video.contentTagIds],
    };
  }

  return draftByVideoId;
}

function buildManagedContentTagDraftMap(
  contentTags: AdminContentTagSummary[],
): Record<string, ManagedContentTagDraft> {
  const draftByContentTagId: Record<string, ManagedContentTagDraft> = {};

  for (const contentTag of contentTags) {
    draftByContentTagId[contentTag.id] = {
      name: contentTag.name,
      description: contentTag.description,
    };
  }

  return draftByContentTagId;
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
  const [contentTags, setContentTags] = useState<AdminContentTagSummary[]>([]);
  const [videos, setVideos] = useState<AdminVideoSummary[]>([]);
  const [createFormState, setCreateFormState] =
    useState<CreateFormState>(initialCreateFormState);
  const [createContentTagFormState, setCreateContentTagFormState] =
    useState<CreateContentTagFormState>(initialCreateContentTagFormState);
  const [managedVideoDraftById, setManagedVideoDraftById] = useState<
    Record<string, ManagedVideoDraft>
  >({});
  const [managedContentTagDraftById, setManagedContentTagDraftById] = useState<
    Record<string, ManagedContentTagDraft>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingCreateContentTag, setIsSubmittingCreateContentTag] =
    useState(false);
  const [updatingVideoId, setUpdatingVideoId] = useState<string | null>(null);
  const [updatingContentTagId, setUpdatingContentTagId] = useState<string | null>(
    null,
  );
  const [togglingContentTagId, setTogglingContentTagId] = useState<string | null>(
    null,
  );
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const [selectedUploadFileByVideoId, setSelectedUploadFileByVideoId] = useState<
    Record<string, File | null>
  >({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const isAdmin = authSession?.user.accountType === "admin";

  const loadAdminData = async (accessToken: string) => {
    const [contentTagsResult, videosResult] = await Promise.allSettled([
      listAdminContentTags(accessToken),
      listAdminVideos(accessToken),
    ]);

    if (contentTagsResult.status === "fulfilled") {
      setContentTags(sortContentTagsByName(contentTagsResult.value));
      setManagedContentTagDraftById(
        buildManagedContentTagDraftMap(contentTagsResult.value),
      );
    } else {
      setContentTags([]);
      setManagedContentTagDraftById({});
    }

    if (videosResult.status === "fulfilled") {
      setVideos(videosResult.value);
      setManagedVideoDraftById(buildManagedDraftMap(videosResult.value));
    } else {
      setVideos([]);
      setManagedVideoDraftById({});
    }

    const loadFailures: string[] = [];

    if (contentTagsResult.status === "rejected") {
      loadFailures.push(
        contentTagsResult.reason instanceof Error
          ? contentTagsResult.reason.message
          : "Unable to load content tags.",
      );
    }

    if (videosResult.status === "rejected") {
      loadFailures.push(
        videosResult.reason instanceof Error
          ? videosResult.reason.message
          : "Unable to load admin videos.",
      );
    }

    if (loadFailures.length > 0) {
      throw new Error(loadFailures.join(" "));
    }
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

  const handleToggleCreateTag = (contentTagId: string) => {
    setCreateFormState((current) => {
      if (current.contentTagIds.includes(contentTagId)) {
        return {
          ...current,
          contentTagIds: current.contentTagIds.filter((id) => id !== contentTagId),
        };
      }

      return {
        ...current,
        contentTagIds: [...current.contentTagIds, contentTagId],
      };
    });
  };

  const handleToggleManagedTag = (videoId: string, contentTagId: string) => {
    setManagedVideoDraftById((currentDraftByVideoId) => {
      const currentDraft = currentDraftByVideoId[videoId];

      if (!currentDraft) {
        return currentDraftByVideoId;
      }

      const nextIds = currentDraft.contentTagIds.includes(contentTagId)
        ? currentDraft.contentTagIds.filter((id) => id !== contentTagId)
        : [...currentDraft.contentTagIds, contentTagId];

      return {
        ...currentDraftByVideoId,
        [videoId]: {
          ...currentDraft,
          contentTagIds: nextIds,
        },
      };
    });
  };

  const upsertManagedContentTag = (contentTag: AdminContentTagSummary) => {
    setContentTags((currentContentTags) =>
      sortContentTagsByName([
        ...currentContentTags.filter(
          (existingContentTag) => existingContentTag.id !== contentTag.id,
        ),
        contentTag,
      ]),
    );

    setManagedContentTagDraftById((currentDraftByContentTagId) => ({
      ...currentDraftByContentTagId,
      [contentTag.id]: {
        name: contentTag.name,
        description: contentTag.description,
      },
    }));
  };

  const handleCreateContentTag = async () => {
    if (!authSession || !isAdmin) {
      setOutcome({
        type: "error",
        message: "Only admin accounts can create content tags.",
      });
      return;
    }

    const trimmedName = createContentTagFormState.name.trim();

    if (trimmedName.length < 2) {
      setOutcome({
        type: "error",
        message: "Content tag name must be at least 2 characters.",
      });
      return;
    }

    setIsSubmittingCreateContentTag(true);
    setOutcome(null);

    try {
      const trimmedDescription = createContentTagFormState.description.trim();
      const createdContentTag = await createAdminContentTag(authSession.accessToken, {
        name: trimmedName,
        description: trimmedDescription,
      });

      upsertManagedContentTag(createdContentTag);
      setCreateContentTagFormState(initialCreateContentTagFormState);
      setOutcome({
        type: "success",
        message: `Created content tag "${createdContentTag.name}" successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create content tag right now.";

      setOutcome({ type: "error", message });
    } finally {
      setIsSubmittingCreateContentTag(false);
    }
  };

  const handleSaveContentTag = async (contentTagId: string) => {
    if (!authSession || !isAdmin) {
      setOutcome({
        type: "error",
        message: "Only admin accounts can update content tags.",
      });
      return;
    }

    const draft = managedContentTagDraftById[contentTagId];

    if (!draft) {
      return;
    }

    const trimmedName = draft.name.trim();

    if (trimmedName.length < 2) {
      setOutcome({
        type: "error",
        message: "Content tag name must be at least 2 characters.",
      });
      return;
    }

    setUpdatingContentTagId(contentTagId);
    setOutcome(null);

    try {
      const trimmedDescription = draft.description.trim();
      const updatedContentTag = await updateAdminContentTag(
        authSession.accessToken,
        contentTagId,
        {
          name: trimmedName,
          description: trimmedDescription,
        },
      );

      upsertManagedContentTag(updatedContentTag);
      setOutcome({
        type: "success",
        message: `Updated content tag "${updatedContentTag.name}" successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update content tag right now.";

      setOutcome({ type: "error", message });
    } finally {
      setUpdatingContentTagId(null);
    }
  };

  const handleToggleContentTagActiveState = async (
    contentTag: AdminContentTagSummary,
  ) => {
    if (!authSession || !isAdmin) {
      setOutcome({
        type: "error",
        message: "Only admin accounts can manage content tag status.",
      });
      return;
    }

    setTogglingContentTagId(contentTag.id);
    setOutcome(null);

    try {
      const updatedContentTag = contentTag.isActive
        ? await archiveAdminContentTag(authSession.accessToken, contentTag.id)
        : await unarchiveAdminContentTag(authSession.accessToken, contentTag.id);

      upsertManagedContentTag(updatedContentTag);
      setOutcome({
        type: "success",
        message: updatedContentTag.isActive
          ? `Unarchived content tag "${updatedContentTag.name}".`
          : `Archived content tag "${updatedContentTag.name}".`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update content tag status right now.";

      setOutcome({ type: "error", message });
    } finally {
      setTogglingContentTagId(null);
    }
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
        contentTagIds: createFormState.contentTagIds,
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

    const normalizedTitle = draft.title.trim();

    if (normalizedTitle.length < 3) {
      setOutcome({
        type: "error",
        message: "Video title must be at least 3 characters before saving.",
      });
      return;
    }

    setUpdatingVideoId(videoId);
    setOutcome(null);

    try {
      const normalizedDescription = draft.description.trim();
      const normalizedThumbnailUrl = draft.thumbnailUrl.trim();
      const updatedVideo = await updateAdminVideo(authSession.accessToken, videoId, {
        title: normalizedTitle,
        description: normalizedDescription.length > 0 ? normalizedDescription : null,
        status: draft.status,
        thumbnailUrl: normalizedThumbnailUrl.length > 0 ? normalizedThumbnailUrl : null,
        contentTagIds: draft.contentTagIds,
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
              Admin controls
            </p>
            <h1 className="font-brand mt-3 bg-gradient-to-r from-foreground via-brand-muted to-accent bg-clip-text text-3xl text-transparent">
              Content Studio
            </h1>
            <p className="mt-3 text-sm leading-6 text-foreground/80">
              Create video records, upload MP4 files to Mux, and assign one or more content tags.
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
            Create video record
          </h2>
          <p className="mt-2 text-xs text-foreground/70">
            Step 1: save a title and tags for a video record. Step 2: upload the MP4 in the
            Manage videos section below.
          </p>

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
              <span className="text-xs font-semibold text-foreground/80">
                Description (optional metadata)
              </span>
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
              <span className="text-xs font-semibold text-foreground/80">
                Duration seconds (optional)
              </span>
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
              <span className="text-xs font-semibold text-foreground/80">
                Thumbnail URL (optional)
              </span>
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
            {contentTags.length === 0 ? (
              <p className="mt-2 text-xs text-accent-strong">
                No content tags are available yet. Create one in Tag Library below.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {contentTags.map((contentTag) => {
                  const isSelected = createFormState.contentTagIds.includes(contentTag.id);
                  const canSelect = contentTag.isActive || isSelected;

                  return (
                    <button
                      key={contentTag.id}
                      type="button"
                      onClick={() => {
                        handleToggleCreateTag(contentTag.id);
                      }}
                      disabled={!canSelect}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isSelected
                          ? "border-brand/60 bg-brand/20 text-brand-muted"
                          : "border-white/20 bg-black/35 text-foreground/75 hover:text-foreground"
                      } ${!canSelect ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {contentTag.name}
                      {!contentTag.isActive ? " (archived)" : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              void handleCreateVideo();
            }}
            disabled={isSubmittingCreate}
            className="mt-5 rounded-2xl bg-gradient-to-r from-accent to-brand px-4 py-2 text-sm font-extrabold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmittingCreate ? "Creating..." : "Create video record"}
          </button>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Tag Library
          </h2>
          <p className="mt-2 text-xs text-foreground/70">
            Create, edit, archive, and unarchive content tags used for video assignment and
            recommendation matching.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-foreground/80">Tag name</span>
              <input
                type="text"
                value={createContentTagFormState.name}
                onChange={(event) => {
                  setCreateContentTagFormState((current) => ({
                    ...current,
                    name: event.target.value,
                  }));
                }}
                className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                placeholder="Sick Move"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-foreground/80">Description</span>
              <textarea
                value={createContentTagFormState.description}
                onChange={(event) => {
                  setCreateContentTagFormState((current) => ({
                    ...current,
                    description: event.target.value,
                  }));
                }}
                rows={2}
                className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                placeholder="Optional guidance for admins and future recommendations."
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              void handleCreateContentTag();
            }}
            disabled={isSubmittingCreateContentTag}
            className="mt-4 rounded-xl border border-accent/35 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent-strong transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmittingCreateContentTag ? "Creating tag..." : "Create content tag"}
          </button>

          {contentTags.length === 0 ? (
            <p className="mt-4 text-xs text-foreground/65">No content tags created yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {contentTags.map((contentTag) => {
                const contentTagDraft = managedContentTagDraftById[contentTag.id] ?? {
                  name: contentTag.name,
                  description: contentTag.description,
                };

                return (
                  <article
                    key={contentTag.id}
                    className="rounded-xl border border-white/10 bg-surface-soft/70 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70">
                        {contentTag.slug}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          contentTag.isActive
                            ? "border-brand/40 bg-brand/15 text-brand-muted"
                            : "border-white/20 bg-black/35 text-foreground/60"
                        }`}
                      >
                        {contentTag.isActive ? "active" : "archived"}
                      </span>
                    </div>

                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input
                        type="text"
                        value={contentTagDraft.name}
                        onChange={(event) => {
                          const nextName = event.target.value;
                          setManagedContentTagDraftById((currentDraftByContentTagId) => ({
                            ...currentDraftByContentTagId,
                            [contentTag.id]: {
                              ...contentTagDraft,
                              name: nextName,
                            },
                          }));
                        }}
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs outline-none transition focus:border-brand/70"
                      />

                      <textarea
                        value={contentTagDraft.description}
                        onChange={(event) => {
                          const nextDescription = event.target.value;
                          setManagedContentTagDraftById((currentDraftByContentTagId) => ({
                            ...currentDraftByContentTagId,
                            [contentTag.id]: {
                              ...contentTagDraft,
                              description: nextDescription,
                            },
                          }));
                        }}
                        rows={2}
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs outline-none transition focus:border-brand/70"
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveContentTag(contentTag.id);
                        }}
                        disabled={updatingContentTagId === contentTag.id}
                        className="rounded-lg border border-brand/35 bg-brand/15 px-3 py-1.5 text-[11px] font-semibold text-brand-muted transition hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingContentTagId === contentTag.id ? "Saving..." : "Save tag"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleContentTagActiveState(contentTag);
                        }}
                        disabled={togglingContentTagId === contentTag.id}
                        className="rounded-lg border border-white/20 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-foreground/80 transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {togglingContentTagId === contentTag.id
                          ? "Updating..."
                          : contentTag.isActive
                            ? "Archive"
                            : "Unarchive"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

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
          <p className="mt-2 text-xs text-foreground/70">
            Upload MP4 files to Mux per video, then adjust status and tag assignments.
          </p>
          <p className="mt-1 text-[11px] text-foreground/60">
            Metadata edits save independently. You do not need to re-upload MP4 files to update title,
            description, thumbnail, status, or tags.
          </p>

          {isLoading ? (
            <p className="mt-3 text-sm text-foreground/75">Loading admin videos...</p>
          ) : videos.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/75">No videos created yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {videos.map((video) => {
                const managedDraft = managedVideoDraftById[video.id];
                const managedVideoState: ManagedVideoDraft = managedDraft ?? {
                  title: video.title,
                  description: video.description ?? "",
                  thumbnailUrl: video.thumbnailUrl ?? "",
                  status: video.status,
                  contentTagIds: [...video.contentTagIds],
                };

                return (
                  <article
                    key={video.id}
                    className="rounded-2xl border border-white/10 bg-surface-soft/70 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          {managedVideoState.title}
                        </h3>
                        {managedVideoState.description.trim().length > 0 ? (
                          <p className="mt-1 text-xs text-foreground/70">
                            {managedVideoState.description}
                          </p>
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

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold text-foreground/80">Title</span>
                        <input
                          type="text"
                          value={managedVideoState.title}
                          onChange={(event) => {
                            const nextTitle = event.target.value;
                            setManagedVideoDraftById((currentDraftByVideoId) => ({
                              ...currentDraftByVideoId,
                              [video.id]: {
                                ...managedVideoState,
                                title: nextTitle,
                              },
                            }));
                          }}
                          className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                          placeholder="Video title"
                        />
                      </label>

                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold text-foreground/80">Description</span>
                        <textarea
                          value={managedVideoState.description}
                          onChange={(event) => {
                            const nextDescription = event.target.value;
                            setManagedVideoDraftById((currentDraftByVideoId) => ({
                              ...currentDraftByVideoId,
                              [video.id]: {
                                ...managedVideoState,
                                description: nextDescription,
                              },
                            }));
                          }}
                          rows={2}
                          className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                          placeholder="Optional metadata shown in the studio and playback UI."
                        />
                      </label>

                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold text-foreground/80">Thumbnail URL</span>
                        <input
                          type="url"
                          value={managedVideoState.thumbnailUrl}
                          onChange={(event) => {
                            const nextThumbnailUrl = event.target.value;
                            setManagedVideoDraftById((currentDraftByVideoId) => ({
                              ...currentDraftByVideoId,
                              [video.id]: {
                                ...managedVideoState,
                                thumbnailUrl: nextThumbnailUrl,
                              },
                            }));
                          }}
                          className="w-full rounded-xl border border-white/15 bg-surface-soft/80 px-3 py-2 text-sm outline-none transition focus:border-brand/70"
                          placeholder="https://example.com/thumb.jpg"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[200px,1fr]">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-foreground/80">Status</span>
                        <select
                          value={managedVideoState.status}
                          onChange={(event) => {
                            const nextStatus = event.target.value as VideoStatus;
                            setManagedVideoDraftById((currentDraftByVideoId) => ({
                              ...currentDraftByVideoId,
                              [video.id]: {
                                ...managedVideoState,
                                status: nextStatus,
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
                          {contentTags.map((contentTag) => {
                            const selectedIds = managedVideoState.contentTagIds;
                            const isSelected = selectedIds.includes(contentTag.id);
                            const canSelect = contentTag.isActive || isSelected;

                            return (
                              <button
                                key={`${video.id}-${contentTag.id}`}
                                type="button"
                                onClick={() => {
                                  handleToggleManagedTag(video.id, contentTag.id);
                                }}
                                disabled={!canSelect}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                  isSelected
                                    ? "border-brand/60 bg-brand/20 text-brand-muted"
                                    : "border-white/20 bg-black/35 text-foreground/75 hover:text-foreground"
                                } ${!canSelect ? "cursor-not-allowed opacity-50" : ""}`}
                              >
                                {contentTag.name}
                                {!contentTag.isActive ? " (archived)" : ""}
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
