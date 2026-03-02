import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { contentTypeIdSchema } from '../content/content-id.schema';
import type { ContentTypeSummary } from '../content/content.service';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CreateAdminContentTagInput,
  CreateAdminVideoInput,
  ListAdminVideosQuery,
  UpdateAdminContentTagInput,
  UpdateAdminVideoInput,
  VideoStatus,
} from './admin.schemas';
import { videoStatusSchema } from './admin.schemas';

const profileAccountTypeRowSchema = z.object({
  account_type: z.enum(['learner', 'parent', 'admin']),
});

const persistedVideoStatusSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((status) => {
    if (status === 'published') {
      return 'ready';
    }

    if (status === 'unpublished') {
      return 'draft';
    }

    return status;
  })
  .pipe(videoStatusSchema);

const integerLikeSchema = z.union([
  z.number().int(),
  z
    .string()
    .trim()
    .regex(/^-?\d+$/)
    .transform((value) => Number(value)),
]);

const dateTimeLikeSchema = z.coerce
  .date()
  .transform((value) => value.toISOString());

const videoRowSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string(),
  description: z.string().nullable(),
  status: persistedVideoStatusSchema,
  owner_id: z.string().trim().min(1).nullable(),
  duration_seconds: z.union([integerLikeSchema, z.null()]),
  thumbnail_url: z.string().nullable(),
  published_at: z.union([dateTimeLikeSchema, z.null()]),
  created_at: dateTimeLikeSchema,
  updated_at: dateTimeLikeSchema,
});

const videoContentTypeRowSchema = z.object({
  video_id: z.string().trim().min(1),
  content_type_id: contentTypeIdSchema,
  created_at: dateTimeLikeSchema,
});

const contentTypeRowSchema = z.object({
  id: contentTypeIdSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  icon_key: z.string().nullable().optional(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

const contentTypeIdOnlyRowSchema = z.object({
  id: contentTypeIdSchema,
});

const contentTagRowSchema = z.object({
  id: contentTypeIdSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  is_active: z.boolean(),
  created_at: dateTimeLikeSchema,
  updated_at: dateTimeLikeSchema,
});

const contentTagSlugRowSchema = z.object({
  slug: z.string(),
});

export type AdminVideoSummary = {
  id: string;
  title: string;
  description: string | null;
  status: VideoStatus;
  ownerId: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contentTypeIds: string[];
  contentTypes: ContentTypeSummary[];
};

export type AdminContentTagSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class AdminService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listVideos(
    adminUserId: string,
    query: ListAdminVideosQuery,
  ): Promise<AdminVideoSummary[]> {
    await this.assertAdminAccount(adminUserId);
    const client = this.getClientOrThrow();

    const baseQuery = client
      .from('videos')
      .select(
        'id, title, description, status, owner_id, duration_seconds, thumbnail_url, published_at, created_at, updated_at',
      )
      .order('created_at', { ascending: false });

    const { data: videoRows, error: videosError } =
      query.status === undefined
        ? await baseQuery
        : await baseQuery.eq('status', query.status);

    if (videosError) {
      throw new InternalServerErrorException('Failed to load admin videos.');
    }

    const parsedVideoRows = z.array(videoRowSchema).safeParse(videoRows ?? []);

    if (!parsedVideoRows.success) {
      throw new InternalServerErrorException(
        'Admin videos payload was invalid.',
      );
    }

    return this.hydrateVideoSummaries(parsedVideoRows.data);
  }

  async getVideoById(
    adminUserId: string,
    videoId: string,
  ): Promise<AdminVideoSummary> {
    await this.assertAdminAccount(adminUserId);

    const videoRow = await this.getVideoRowById(videoId);
    const summaries = await this.hydrateVideoSummaries([videoRow]);

    if (!summaries[0]) {
      throw new InternalServerErrorException(
        'Video detail could not be resolved.',
      );
    }

    return summaries[0];
  }

  async createVideo(
    adminUserId: string,
    input: CreateAdminVideoInput,
  ): Promise<AdminVideoSummary> {
    await this.assertAdminAccount(adminUserId);
    await this.assertContentTypesExist(input.contentTypeIds);

    const client = this.getClientOrThrow();

    const nextPublishedAt =
      input.publishedAt ??
      (input.status === 'ready' ? new Date().toISOString() : null);

    const { data: createdVideo, error: createError } = await client
      .from('videos')
      .insert({
        title: input.title,
        description:
          input.description && input.description.length > 0
            ? input.description
            : null,
        status: input.status,
        owner_id: adminUserId,
        duration_seconds: input.durationSeconds ?? null,
        thumbnail_url: input.thumbnailUrl ?? null,
        published_at: nextPublishedAt,
      })
      .select(
        'id, title, description, status, owner_id, duration_seconds, thumbnail_url, published_at, created_at, updated_at',
      )
      .single();

    if (createError || !createdVideo) {
      throw new InternalServerErrorException('Failed to create admin video.');
    }

    const parsedCreatedVideo = videoRowSchema.safeParse(createdVideo);

    if (!parsedCreatedVideo.success) {
      throw new InternalServerErrorException(
        'Created admin video payload was invalid.',
      );
    }

    if (input.contentTypeIds.length > 0) {
      try {
        await this.replaceVideoContentTypeAssignments(
          parsedCreatedVideo.data.id,
          input.contentTypeIds,
        );
      } catch (error) {
        await client
          .from('videos')
          .delete()
          .eq('id', parsedCreatedVideo.data.id);

        if (error instanceof Error) {
          throw error;
        }

        throw new InternalServerErrorException(
          'Failed to attach content types to created video.',
        );
      }
    }

    const summaries = await this.hydrateVideoSummaries([
      parsedCreatedVideo.data,
    ]);

    if (!summaries[0]) {
      throw new InternalServerErrorException(
        'Created admin video summary could not be resolved.',
      );
    }

    return summaries[0];
  }

  async updateVideo(
    adminUserId: string,
    videoId: string,
    input: UpdateAdminVideoInput,
  ): Promise<AdminVideoSummary> {
    await this.assertAdminAccount(adminUserId);

    const client = this.getClientOrThrow();
    let resolvedVideo = await this.getVideoRowById(videoId);

    const videoPatch: Record<string, unknown> = {};

    if (input.title !== undefined) {
      videoPatch.title = input.title;
    }

    if (input.description !== undefined) {
      videoPatch.description =
        input.description && input.description.length > 0
          ? input.description
          : null;
    }

    if (input.status !== undefined) {
      videoPatch.status = input.status;
    }

    if (input.durationSeconds !== undefined) {
      videoPatch.duration_seconds = input.durationSeconds;
    }

    if (input.thumbnailUrl !== undefined) {
      videoPatch.thumbnail_url = input.thumbnailUrl;
    }

    if (input.publishedAt !== undefined) {
      videoPatch.published_at = input.publishedAt;
    }

    if (
      input.status === 'ready' &&
      input.publishedAt === undefined &&
      resolvedVideo.published_at === null
    ) {
      videoPatch.published_at = new Date().toISOString();
    }

    if (Object.keys(videoPatch).length > 0) {
      const { data: updatedVideo, error: updateError } = await client
        .from('videos')
        .update(videoPatch)
        .eq('id', videoId)
        .select(
          'id, title, description, status, owner_id, duration_seconds, thumbnail_url, published_at, created_at, updated_at',
        )
        .single();

      if (updateError || !updatedVideo) {
        throw new InternalServerErrorException('Failed to update admin video.');
      }

      const parsedUpdatedVideo = videoRowSchema.safeParse(updatedVideo);

      if (!parsedUpdatedVideo.success) {
        throw new InternalServerErrorException(
          'Updated admin video payload was invalid.',
        );
      }

      resolvedVideo = parsedUpdatedVideo.data;
    }

    if (input.contentTypeIds !== undefined) {
      await this.assertContentTypesExist(input.contentTypeIds);
      await this.replaceVideoContentTypeAssignments(
        videoId,
        input.contentTypeIds,
      );
    }

    const summaries = await this.hydrateVideoSummaries([resolvedVideo]);

    if (!summaries[0]) {
      throw new InternalServerErrorException(
        'Updated admin video summary could not be resolved.',
      );
    }

    return summaries[0];
  }

  async listContentTags(
    adminUserId: string,
  ): Promise<AdminContentTagSummary[]> {
    await this.assertAdminAccount(adminUserId);
    const client = this.getClientOrThrow();

    const { data: contentTagRows, error: contentTagsError } = await client
      .from('content_tags')
      .select('id, slug, name, description, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    if (contentTagsError) {
      throw new InternalServerErrorException('Failed to load content tags.');
    }

    const parsedContentTagRows = z
      .array(contentTagRowSchema)
      .safeParse(contentTagRows ?? []);

    if (!parsedContentTagRows.success) {
      throw new InternalServerErrorException(
        'Content tags payload was invalid.',
      );
    }

    return parsedContentTagRows.data.map((row) => this.mapContentTagRow(row));
  }

  async createContentTag(
    adminUserId: string,
    input: CreateAdminContentTagInput,
  ): Promise<AdminContentTagSummary> {
    await this.assertAdminAccount(adminUserId);
    const client = this.getClientOrThrow();
    const nextSlug = await this.generateUniqueContentTagSlug(input.name);

    const { data: createdContentTag, error: createError } = await client
      .from('content_tags')
      .insert({
        slug: nextSlug,
        name: input.name,
        description: input.description,
        is_active: true,
      })
      .select('id, slug, name, description, is_active, created_at, updated_at')
      .single();

    if (createError || !createdContentTag) {
      throw new InternalServerErrorException('Failed to create content tag.');
    }

    const parsedCreatedContentTag =
      contentTagRowSchema.safeParse(createdContentTag);

    if (!parsedCreatedContentTag.success) {
      throw new InternalServerErrorException(
        'Created content tag payload was invalid.',
      );
    }

    return this.mapContentTagRow(parsedCreatedContentTag.data);
  }

  async updateContentTag(
    adminUserId: string,
    contentTagId: string,
    input: UpdateAdminContentTagInput,
  ): Promise<AdminContentTagSummary> {
    await this.assertAdminAccount(adminUserId);
    const client = this.getClientOrThrow();

    const contentTagPatch: Record<string, unknown> = {};

    if (input.name !== undefined) {
      contentTagPatch.name = input.name;
    }

    if (input.description !== undefined) {
      contentTagPatch.description = input.description ?? '';
    }

    const { data: updatedContentTag, error: updateError } = await client
      .from('content_tags')
      .update(contentTagPatch)
      .eq('id', contentTagId)
      .select('id, slug, name, description, is_active, created_at, updated_at')
      .maybeSingle();

    if (updateError) {
      throw new InternalServerErrorException('Failed to update content tag.');
    }

    if (!updatedContentTag) {
      throw new NotFoundException('Content tag was not found.');
    }

    const parsedUpdatedContentTag =
      contentTagRowSchema.safeParse(updatedContentTag);

    if (!parsedUpdatedContentTag.success) {
      throw new InternalServerErrorException(
        'Updated content tag payload was invalid.',
      );
    }

    return this.mapContentTagRow(parsedUpdatedContentTag.data);
  }

  async archiveContentTag(
    adminUserId: string,
    contentTagId: string,
  ): Promise<AdminContentTagSummary> {
    return this.setContentTagActiveState(adminUserId, contentTagId, false);
  }

  async unarchiveContentTag(
    adminUserId: string,
    contentTagId: string,
  ): Promise<AdminContentTagSummary> {
    return this.setContentTagActiveState(adminUserId, contentTagId, true);
  }

  private async hydrateVideoSummaries(
    videoRows: z.infer<typeof videoRowSchema>[],
  ): Promise<AdminVideoSummary[]> {
    if (videoRows.length === 0) {
      return [];
    }

    const client = this.getClientOrThrow();
    const videoIds = videoRows.map((videoRow) => videoRow.id);

    const { data: videoContentTypeRows, error: videoContentTypeError } =
      await client
        .from('video_content_types')
        .select('video_id, content_type_id, created_at')
        .in('video_id', videoIds)
        .order('created_at', { ascending: true });

    if (videoContentTypeError) {
      throw new InternalServerErrorException(
        'Failed to load video content type assignments.',
      );
    }

    const parsedVideoContentTypeRows = z
      .array(videoContentTypeRowSchema)
      .safeParse(videoContentTypeRows ?? []);

    if (!parsedVideoContentTypeRows.success) {
      throw new InternalServerErrorException(
        'Video content type assignment payload was invalid.',
      );
    }

    const videoContentTypeIdsByVideoId = new Map<string, string[]>();

    for (const videoId of videoIds) {
      videoContentTypeIdsByVideoId.set(videoId, []);
    }

    for (const row of parsedVideoContentTypeRows.data) {
      const assignedContentTypeIds =
        videoContentTypeIdsByVideoId.get(row.video_id) ?? [];
      assignedContentTypeIds.push(row.content_type_id);
      videoContentTypeIdsByVideoId.set(row.video_id, assignedContentTypeIds);
    }

    const uniqueContentTypeIds = Array.from(
      new Set(
        parsedVideoContentTypeRows.data.map((row) => row.content_type_id),
      ),
    );

    const contentTypeById = new Map<string, ContentTypeSummary>();

    if (uniqueContentTypeIds.length > 0) {
      const { data: contentTypeRows, error: contentTypeError } = await client
        .from('content_types')
        .select('id, slug, name, description, icon_key, sort_order, is_active')
        .in('id', uniqueContentTypeIds)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (contentTypeError) {
        throw new InternalServerErrorException(
          'Failed to load content type labels for videos.',
        );
      }

      const parsedContentTypeRows = z
        .array(contentTypeRowSchema)
        .safeParse(contentTypeRows ?? []);

      if (!parsedContentTypeRows.success) {
        throw new InternalServerErrorException(
          'Video content type labels payload was invalid.',
        );
      }

      for (const row of parsedContentTypeRows.data) {
        contentTypeById.set(row.id, {
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          iconKey: row.icon_key ?? null,
          sortOrder: row.sort_order,
          isActive: row.is_active,
        });
      }
    }

    return videoRows.map((videoRow) => {
      const contentTypeIds =
        videoContentTypeIdsByVideoId.get(videoRow.id) ?? [];
      const contentTypes = contentTypeIds
        .map((contentTypeId) => contentTypeById.get(contentTypeId))
        .filter((contentType): contentType is ContentTypeSummary =>
          Boolean(contentType),
        );

      return {
        id: videoRow.id,
        title: videoRow.title,
        description: videoRow.description,
        status: videoRow.status,
        ownerId: videoRow.owner_id,
        durationSeconds: videoRow.duration_seconds,
        thumbnailUrl: videoRow.thumbnail_url,
        publishedAt: videoRow.published_at,
        createdAt: videoRow.created_at,
        updatedAt: videoRow.updated_at,
        contentTypeIds,
        contentTypes,
      };
    });
  }

  private async getVideoRowById(videoId: string) {
    const client = this.getClientOrThrow();

    const { data: videoRow, error: videoError } = await client
      .from('videos')
      .select(
        'id, title, description, status, owner_id, duration_seconds, thumbnail_url, published_at, created_at, updated_at',
      )
      .eq('id', videoId)
      .maybeSingle();

    if (videoError) {
      throw new InternalServerErrorException('Failed to load video details.');
    }

    if (!videoRow) {
      throw new NotFoundException('Video was not found.');
    }

    const parsedVideoRow = videoRowSchema.safeParse(videoRow);

    if (!parsedVideoRow.success) {
      throw new InternalServerErrorException(
        'Video detail payload was invalid.',
      );
    }

    return parsedVideoRow.data;
  }

  private async assertContentTypesExist(
    contentTypeIds: string[],
  ): Promise<void> {
    const uniqueContentTypeIds = Array.from(new Set(contentTypeIds));

    if (uniqueContentTypeIds.length === 0) {
      return;
    }

    const client = this.getClientOrThrow();

    const { data: contentTypeRows, error: contentTypeError } = await client
      .from('content_types')
      .select('id')
      .in('id', uniqueContentTypeIds);

    if (contentTypeError) {
      throw new InternalServerErrorException('Failed to verify content types.');
    }

    const parsedContentTypeRows = z
      .array(contentTypeIdOnlyRowSchema)
      .safeParse(contentTypeRows ?? []);

    if (!parsedContentTypeRows.success) {
      throw new InternalServerErrorException(
        'Content type verification payload was invalid.',
      );
    }

    if (parsedContentTypeRows.data.length !== uniqueContentTypeIds.length) {
      throw new BadRequestException(
        'One or more selected content types are invalid.',
      );
    }
  }

  private async replaceVideoContentTypeAssignments(
    videoId: string,
    contentTypeIds: string[],
  ): Promise<void> {
    const client = this.getClientOrThrow();

    const { error: deleteError } = await client
      .from('video_content_types')
      .delete()
      .eq('video_id', videoId);

    if (deleteError) {
      throw new InternalServerErrorException(
        'Failed to clear existing video content type assignments.',
      );
    }

    if (contentTypeIds.length === 0) {
      return;
    }

    const { error: insertError } = await client
      .from('video_content_types')
      .insert(
        contentTypeIds.map((contentTypeId) => ({
          video_id: videoId,
          content_type_id: contentTypeId,
        })),
      );

    if (insertError) {
      throw new InternalServerErrorException(
        'Failed to save video content type assignments.',
      );
    }
  }

  private mapContentTagRow(
    row: z.infer<typeof contentTagRowSchema>,
  ): AdminContentTagSummary {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async setContentTagActiveState(
    adminUserId: string,
    contentTagId: string,
    isActive: boolean,
  ): Promise<AdminContentTagSummary> {
    await this.assertAdminAccount(adminUserId);
    const client = this.getClientOrThrow();

    const { data: updatedContentTag, error: updateError } = await client
      .from('content_tags')
      .update({
        is_active: isActive,
      })
      .eq('id', contentTagId)
      .select('id, slug, name, description, is_active, created_at, updated_at')
      .maybeSingle();

    if (updateError) {
      throw new InternalServerErrorException(
        'Failed to update content tag active state.',
      );
    }

    if (!updatedContentTag) {
      throw new NotFoundException('Content tag was not found.');
    }

    const parsedUpdatedContentTag =
      contentTagRowSchema.safeParse(updatedContentTag);

    if (!parsedUpdatedContentTag.success) {
      throw new InternalServerErrorException(
        'Updated content tag active state payload was invalid.',
      );
    }

    return this.mapContentTagRow(parsedUpdatedContentTag.data);
  }

  private async generateUniqueContentTagSlug(contentTagName: string) {
    const client = this.getClientOrThrow();
    const baseSlug = this.normalizeContentTagNameToSlug(contentTagName);

    const { data: contentTagSlugRows, error: contentTagSlugsError } =
      await client.from('content_tags').select('slug');

    if (contentTagSlugsError) {
      throw new InternalServerErrorException(
        'Failed to verify content tag slug uniqueness.',
      );
    }

    const parsedContentTagSlugRows = z
      .array(contentTagSlugRowSchema)
      .safeParse(contentTagSlugRows ?? []);

    if (!parsedContentTagSlugRows.success) {
      throw new InternalServerErrorException(
        'Content tag slug payload was invalid.',
      );
    }

    const existingSlugSet = new Set(
      parsedContentTagSlugRows.data.map((row) => row.slug.toLowerCase()),
    );

    let nextSlug = baseSlug;
    let slugSuffix = 2;

    while (existingSlugSet.has(nextSlug.toLowerCase())) {
      nextSlug = `${baseSlug}-${slugSuffix}`;
      slugSuffix += 1;
    }

    return nextSlug;
  }

  private normalizeContentTagNameToSlug(contentTagName: string): string {
    const normalizedSlug = contentTagName
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

    if (normalizedSlug.length === 0) {
      return 'content-tag';
    }

    return normalizedSlug;
  }

  private async assertAdminAccount(userId: string): Promise<void> {
    const client = this.getClientOrThrow();

    const { data: profileRow, error: profileError } = await client
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException('Failed to load account profile.');
    }

    if (!profileRow) {
      throw new NotFoundException('Account profile was not found.');
    }

    const parsedProfileRow = profileAccountTypeRowSchema.safeParse(profileRow);

    if (!parsedProfileRow.success) {
      throw new InternalServerErrorException(
        'Account type payload was invalid.',
      );
    }

    if (parsedProfileRow.data.account_type !== 'admin') {
      throw new ForbiddenException('Only admin accounts can manage videos.');
    }
  }

  private getClientOrThrow() {
    try {
      return this.supabaseService.getServiceClient();
    } catch {
      throw new ServiceUnavailableException(
        'Admin service is not configured yet. Set backend Supabase credentials.',
      );
    }
  }
}
