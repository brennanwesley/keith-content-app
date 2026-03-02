import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { SupabaseService } from '../supabase/supabase.service';
import { contentTypeIdSchema } from './content-id.schema';
import type { UpdateMyContentPreferencesInput } from './content.schemas';

const contentTypeRowSchema = z.object({
  id: contentTypeIdSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  icon_key: z.string().nullable().optional(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

const contentTypeIdRowSchema = z.object({
  id: contentTypeIdSchema,
});

const userContentPreferenceRowSchema = z.object({
  content_type_id: contentTypeIdSchema,
});

const parentContentRestrictionRowSchema = z.object({
  content_type_id: contentTypeIdSchema,
});

const activeParentLinkRowSchema = z.object({
  parent_user_id: z.string().uuid(),
});

const contentTypeTagMappingRowSchema = z.object({
  content_type_id: contentTypeIdSchema,
  content_tag_id: contentTypeIdSchema,
});

const contentTagIdRowSchema = z.object({
  id: contentTypeIdSchema,
});

const videoContentTagRowSchema = z.object({
  video_id: contentTypeIdSchema,
  content_tag_id: contentTypeIdSchema,
});

const feedVideoRowSchema = z.object({
  id: contentTypeIdSchema,
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'processing', 'ready', 'blocked', 'archived']),
  duration_seconds: z.union([z.number().int(), z.null()]),
  thumbnail_url: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const feedVideoAssetRowSchema = z.object({
  video_id: contentTypeIdSchema,
  mux_playback_id: z.string().trim().min(1).nullable(),
  playback_policy: z.enum(['public', 'signed']),
  encoding_status: z.enum(['pending', 'preparing', 'ready', 'errored']),
});

export type ContentTypeSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type UserContentPreferencesResult = {
  userId: string;
  selectedContentTypeIds: string[];
  selectedContentTypes: ContentTypeSummary[];
};

export type EffectiveContentPreferencesResult = {
  userId: string;
  selectedContentTypeIds: string[];
  selectedContentTypes: ContentTypeSummary[];
  blockedContentTypeIds: string[];
  blockedContentTypes: ContentTypeSummary[];
  effectiveContentTypeIds: string[];
  effectiveContentTypes: ContentTypeSummary[];
  isParentRestricted: boolean;
};

export type FeedCatalogVideoSummary = {
  id: string;
  title: string;
  description: string | null;
  status: 'ready';
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  playbackId: string;
  playbackPolicy: 'public' | 'signed';
  playbackUrl: string;
  contentTagIds: string[];
};

export type FeedCatalogResult = {
  userId: string;
  effectiveContentTypeIds: string[];
  videos: FeedCatalogVideoSummary[];
};

@Injectable()
export class ContentService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listContentTypes(): Promise<ContentTypeSummary[]> {
    const client = this.getClientOrThrow();

    const { data, error } = await client
      .from('content_types')
      .select('id, slug, name, description, icon_key, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new InternalServerErrorException('Failed to load content types.');
    }

    const parsedRows = z.array(contentTypeRowSchema).safeParse(data ?? []);

    if (!parsedRows.success) {
      throw new InternalServerErrorException(
        'Content types payload was invalid.',
      );
    }

    return parsedRows.data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      iconKey: row.icon_key ?? null,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    }));
  }

  async getMyContentPreferences(
    userId: string,
  ): Promise<UserContentPreferencesResult> {
    return this.getContentPreferencesForUser(userId);
  }

  async getContentPreferencesForUser(
    userId: string,
  ): Promise<UserContentPreferencesResult> {
    const client = this.getClientOrThrow();

    const { data: preferenceRows, error: preferenceError } = await client
      .from('user_content_preferences')
      .select('content_type_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (preferenceError) {
      throw new InternalServerErrorException(
        'Failed to load content preferences.',
      );
    }

    const parsedPreferenceRows = z
      .array(userContentPreferenceRowSchema)
      .safeParse(preferenceRows ?? []);

    if (!parsedPreferenceRows.success) {
      throw new InternalServerErrorException(
        'Stored content preference payload was invalid.',
      );
    }

    const selectedContentTypeIds = parsedPreferenceRows.data.map(
      (row) => row.content_type_id,
    );

    if (selectedContentTypeIds.length === 0) {
      return {
        userId,
        selectedContentTypeIds: [],
        selectedContentTypes: [],
      };
    }

    const { data: contentTypeRows, error: contentTypeError } = await client
      .from('content_types')
      .select('id, slug, name, description, icon_key, sort_order, is_active')
      .in('id', selectedContentTypeIds);

    if (contentTypeError) {
      throw new InternalServerErrorException(
        'Failed to load selected content types.',
      );
    }

    const parsedContentTypes = z
      .array(contentTypeRowSchema)
      .safeParse(contentTypeRows ?? []);

    if (!parsedContentTypes.success) {
      throw new InternalServerErrorException(
        'Selected content type payload was invalid.',
      );
    }

    const contentTypeById = new Map(
      parsedContentTypes.data.map((row) => [row.id, row]),
    );

    const selectedContentTypes = selectedContentTypeIds
      .map((contentTypeId) => contentTypeById.get(contentTypeId))
      .filter((row): row is z.infer<typeof contentTypeRowSchema> =>
        Boolean(row),
      )
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        iconKey: row.icon_key ?? null,
        sortOrder: row.sort_order,
        isActive: row.is_active,
      }));

    return {
      userId,
      selectedContentTypeIds,
      selectedContentTypes,
    };
  }

  async getEffectiveContentPreferences(
    userId: string,
  ): Promise<EffectiveContentPreferencesResult> {
    const selectedPreferences = await this.getContentPreferencesForUser(userId);
    const activeContentTypes = await this.listContentTypes();
    const activeContentTypeById = new Map(
      activeContentTypes.map((contentType) => [contentType.id, contentType]),
    );

    const baseSelectedContentTypeIds =
      selectedPreferences.selectedContentTypeIds.length > 0
        ? selectedPreferences.selectedContentTypeIds
        : activeContentTypes.map((contentType) => contentType.id);

    const blockedContentTypeIds = await this.listBlockedContentTypeIds(userId);
    const blockedContentTypeIdSet = new Set(blockedContentTypeIds);

    const effectiveContentTypeIds = baseSelectedContentTypeIds.filter(
      (contentTypeId) => !blockedContentTypeIdSet.has(contentTypeId),
    );

    const blockedContentTypes = blockedContentTypeIds
      .map((contentTypeId) => activeContentTypeById.get(contentTypeId))
      .filter((contentType): contentType is ContentTypeSummary =>
        Boolean(contentType),
      );

    const effectiveContentTypes = effectiveContentTypeIds
      .map((contentTypeId) => activeContentTypeById.get(contentTypeId))
      .filter((contentType): contentType is ContentTypeSummary =>
        Boolean(contentType),
      );

    return {
      userId,
      selectedContentTypeIds: selectedPreferences.selectedContentTypeIds,
      selectedContentTypes: selectedPreferences.selectedContentTypes,
      blockedContentTypeIds,
      blockedContentTypes,
      effectiveContentTypeIds,
      effectiveContentTypes,
      isParentRestricted: blockedContentTypeIds.length > 0,
    };
  }

  async getFeedCatalog(userId: string): Promise<FeedCatalogResult> {
    const client = this.getClientOrThrow();
    const effectivePreferences =
      await this.getEffectiveContentPreferences(userId);
    const effectiveContentTypeIds =
      effectivePreferences.effectiveContentTypeIds;

    if (effectiveContentTypeIds.length === 0) {
      return {
        userId,
        effectiveContentTypeIds,
        videos: [],
      };
    }

    const { data: mappingRows, error: mappingError } = await client
      .from('content_type_tag_mappings')
      .select('content_type_id, content_tag_id')
      .in('content_type_id', effectiveContentTypeIds);

    if (mappingError) {
      throw new InternalServerErrorException(
        'Failed to load content type to tag mappings for feed.',
      );
    }

    const parsedMappingRows = z
      .array(contentTypeTagMappingRowSchema)
      .safeParse(mappingRows ?? []);

    if (!parsedMappingRows.success) {
      throw new InternalServerErrorException(
        'Content type to tag mapping payload was invalid.',
      );
    }

    const mappedContentTagIds = Array.from(
      new Set(parsedMappingRows.data.map((row) => row.content_tag_id)),
    );

    if (mappedContentTagIds.length === 0) {
      return {
        userId,
        effectiveContentTypeIds,
        videos: [],
      };
    }

    const { data: activeContentTagRows, error: activeContentTagError } =
      await client
        .from('content_tags')
        .select('id')
        .eq('is_active', true)
        .in('id', mappedContentTagIds);

    if (activeContentTagError) {
      throw new InternalServerErrorException(
        'Failed to load active content tags for feed.',
      );
    }

    const parsedActiveContentTagRows = z
      .array(contentTagIdRowSchema)
      .safeParse(activeContentTagRows ?? []);

    if (!parsedActiveContentTagRows.success) {
      throw new InternalServerErrorException(
        'Active content tags payload was invalid.',
      );
    }

    const activeMappedContentTagIds = parsedActiveContentTagRows.data.map(
      (row) => row.id,
    );

    if (activeMappedContentTagIds.length === 0) {
      return {
        userId,
        effectiveContentTypeIds,
        videos: [],
      };
    }

    const { data: videoContentTagRows, error: videoContentTagError } =
      await client
        .from('video_content_tags')
        .select('video_id, content_tag_id')
        .in('content_tag_id', activeMappedContentTagIds);

    if (videoContentTagError) {
      throw new InternalServerErrorException(
        'Failed to load video content-tag assignments for feed.',
      );
    }

    const parsedVideoContentTagRows = z
      .array(videoContentTagRowSchema)
      .safeParse(videoContentTagRows ?? []);

    if (!parsedVideoContentTagRows.success) {
      throw new InternalServerErrorException(
        'Video content-tag assignments payload was invalid.',
      );
    }

    const videoIds = Array.from(
      new Set(parsedVideoContentTagRows.data.map((row) => row.video_id)),
    );

    if (videoIds.length === 0) {
      return {
        userId,
        effectiveContentTypeIds,
        videos: [],
      };
    }

    const { data: videoRows, error: videoRowsError } = await client
      .from('videos')
      .select(
        'id, title, description, status, duration_seconds, thumbnail_url, published_at, created_at, updated_at',
      )
      .eq('status', 'ready')
      .in('id', videoIds)
      .order('created_at', { ascending: false })
      .limit(100);

    if (videoRowsError) {
      throw new InternalServerErrorException('Failed to load feed videos.');
    }

    const parsedVideoRows = z
      .array(feedVideoRowSchema)
      .safeParse(videoRows ?? []);

    if (!parsedVideoRows.success) {
      throw new InternalServerErrorException('Feed video payload was invalid.');
    }

    const { data: videoAssetRows, error: videoAssetError } = await client
      .from('video_assets')
      .select('video_id, mux_playback_id, playback_policy, encoding_status')
      .eq('encoding_status', 'ready')
      .eq('playback_policy', 'public')
      .in('video_id', videoIds);

    if (videoAssetError) {
      throw new InternalServerErrorException(
        'Failed to load feed video assets.',
      );
    }

    const parsedVideoAssetRows = z
      .array(feedVideoAssetRowSchema)
      .safeParse(videoAssetRows ?? []);

    if (!parsedVideoAssetRows.success) {
      throw new InternalServerErrorException(
        'Feed video asset payload was invalid.',
      );
    }

    const playableAssetByVideoId = new Map(
      parsedVideoAssetRows.data
        .filter((row) => row.mux_playback_id)
        .map((row) => [row.video_id, row]),
    );

    const contentTagIdsByVideoId = new Map<string, string[]>();

    for (const row of parsedVideoContentTagRows.data) {
      const assignedContentTagIds =
        contentTagIdsByVideoId.get(row.video_id) ?? [];
      assignedContentTagIds.push(row.content_tag_id);
      contentTagIdsByVideoId.set(row.video_id, assignedContentTagIds);
    }

    const videos: FeedCatalogVideoSummary[] = [];

    for (const videoRow of parsedVideoRows.data) {
      const playableAsset = playableAssetByVideoId.get(videoRow.id);

      if (!playableAsset || !playableAsset.mux_playback_id) {
        continue;
      }

      const contentTagIds = Array.from(
        new Set(contentTagIdsByVideoId.get(videoRow.id) ?? []),
      );

      if (contentTagIds.length === 0) {
        continue;
      }

      videos.push({
        id: videoRow.id,
        title: videoRow.title,
        description: videoRow.description,
        status: 'ready',
        durationSeconds: videoRow.duration_seconds,
        thumbnailUrl: videoRow.thumbnail_url,
        publishedAt: videoRow.published_at,
        playbackId: playableAsset.mux_playback_id,
        playbackPolicy: playableAsset.playback_policy,
        playbackUrl: this.buildMuxPlaybackUrl(playableAsset.mux_playback_id),
        contentTagIds,
      });
    }

    return {
      userId,
      effectiveContentTypeIds,
      videos,
    };
  }

  async replaceMyContentPreferences(
    userId: string,
    input: UpdateMyContentPreferencesInput,
  ): Promise<UserContentPreferencesResult> {
    return this.replaceContentPreferencesForUser(userId, input);
  }

  async replaceContentPreferencesForUser(
    userId: string,
    input: UpdateMyContentPreferencesInput,
  ): Promise<UserContentPreferencesResult> {
    const client = this.getClientOrThrow();

    await this.assertActiveContentTypes(input.contentTypeIds);

    const { error: deleteError } = await client
      .from('user_content_preferences')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      throw new InternalServerErrorException(
        'Failed to clear previous content preferences.',
      );
    }

    if (input.contentTypeIds.length > 0) {
      const { error: insertError } = await client
        .from('user_content_preferences')
        .insert(
          input.contentTypeIds.map((contentTypeId) => ({
            user_id: userId,
            content_type_id: contentTypeId,
          })),
        );

      if (insertError) {
        throw new InternalServerErrorException(
          'Failed to save content preferences.',
        );
      }
    }

    return this.getContentPreferencesForUser(userId);
  }

  private async listBlockedContentTypeIds(userId: string): Promise<string[]> {
    const client = this.getClientOrThrow();
    const { data: activeParentLinks, error: activeParentLinksError } =
      await client
        .from('parent_child_links')
        .select('parent_user_id')
        .eq('child_user_id', userId)
        .eq('relationship_status', 'active');

    if (activeParentLinksError) {
      throw new InternalServerErrorException(
        'Failed to verify active parent links.',
      );
    }

    const parsedActiveParentLinks = z
      .array(activeParentLinkRowSchema)
      .safeParse(activeParentLinks ?? []);

    if (!parsedActiveParentLinks.success) {
      throw new InternalServerErrorException(
        'Active parent link payload was invalid.',
      );
    }

    const activeParentIds = parsedActiveParentLinks.data.map(
      (row) => row.parent_user_id,
    );

    if (activeParentIds.length === 0) {
      return [];
    }

    const { data: restrictionRows, error: restrictionError } = await client
      .from('parent_content_restrictions')
      .select('content_type_id')
      .eq('child_user_id', userId)
      .in('parent_user_id', activeParentIds);

    if (restrictionError) {
      throw new InternalServerErrorException(
        'Failed to load parent content restrictions.',
      );
    }

    const parsedRestrictionRows = z
      .array(parentContentRestrictionRowSchema)
      .safeParse(restrictionRows ?? []);

    if (!parsedRestrictionRows.success) {
      throw new InternalServerErrorException(
        'Parent content restriction payload was invalid.',
      );
    }

    return Array.from(
      new Set(parsedRestrictionRows.data.map((row) => row.content_type_id)),
    );
  }

  private async assertActiveContentTypes(
    contentTypeIds: string[],
  ): Promise<void> {
    if (contentTypeIds.length === 0) {
      return;
    }

    const client = this.getClientOrThrow();

    const { data, error } = await client
      .from('content_types')
      .select('id')
      .eq('is_active', true)
      .in('id', contentTypeIds);

    if (error) {
      throw new InternalServerErrorException(
        'Failed to verify selected content types.',
      );
    }

    const parsedIds = z.array(contentTypeIdRowSchema).safeParse(data ?? []);

    if (!parsedIds.success) {
      throw new InternalServerErrorException(
        'Verified content type payload was invalid.',
      );
    }

    if (parsedIds.data.length !== contentTypeIds.length) {
      throw new BadRequestException(
        'One or more selected content types are invalid or inactive.',
      );
    }
  }

  private buildMuxPlaybackUrl(playbackId: string): string {
    return `https://stream.mux.com/${encodeURIComponent(playbackId)}/medium.mp4`;
  }

  private getClientOrThrow() {
    try {
      return this.supabaseService.getServiceClient();
    } catch {
      throw new ServiceUnavailableException(
        'Content service is not configured yet. Set backend Supabase credentials.',
      );
    }
  }
}
