export type VideoStatus =
  | 'draft'
  | 'processing'
  | 'ready'
  | 'blocked'
  | 'archived';

export type ContentTypeTag = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
};

export type VideoSummary = {
  id: string;
  title: string;
  status: VideoStatus;
  contentTypeSlugs: string[];
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};
