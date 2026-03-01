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

  async replaceMyContentPreferences(
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

    return this.getMyContentPreferences(userId);
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
