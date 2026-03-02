import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';

type SupportedTable =
  | 'content_types'
  | 'user_content_preferences'
  | 'parent_child_links'
  | 'parent_content_restrictions'
  | 'content_type_tag_mappings'
  | 'content_tags'
  | 'video_content_tags'
  | 'videos'
  | 'video_assets';

type ContentTypeRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: string | null;
  sort_order: number;
  is_active: boolean;
};

type UserContentPreferenceRow = {
  user_id: string;
  content_type_id: string;
  created_at: string;
};

type ParentChildLinkRow = {
  parent_user_id: string;
  child_user_id: string;
  relationship_status: 'pending' | 'active' | 'revoked';
};

type ParentContentRestrictionRow = {
  parent_user_id: string;
  child_user_id: string;
  content_type_id: string;
};

type ContentTypeTagMappingRow = {
  content_type_id: string;
  content_tag_id: string;
};

type ContentTagRow = {
  id: string;
  is_active: boolean;
};

type VideoContentTagRow = {
  video_id: string;
  content_tag_id: string;
};

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'processing' | 'ready' | 'blocked' | 'archived';
  duration_seconds: number | null;
  thumbnail_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type VideoAssetRow = {
  video_id: string;
  mux_playback_id: string | null;
  playback_policy: 'public' | 'signed';
  encoding_status: 'pending' | 'preparing' | 'ready' | 'errored';
};

type InMemoryState = {
  contentTypes: ContentTypeRow[];
  userContentPreferences: UserContentPreferenceRow[];
  parentChildLinks: ParentChildLinkRow[];
  parentContentRestrictions: ParentContentRestrictionRow[];
  contentTypeTagMappings: ContentTypeTagMappingRow[];
  contentTags: ContentTagRow[];
  videoContentTags: VideoContentTagRow[];
  videos: VideoRow[];
  videoAssets: VideoAssetRow[];
};

type QueryExecutionResult = {
  data: unknown;
  error: null;
};

const feedCatalogEnvelopeSchema = z.object({
  data: z.object({
    userId: z.string().uuid(),
    effectiveContentTypeIds: z.array(z.string()),
    videos: z.array(
      z.object({
        id: z.string().uuid(),
        status: z.literal('ready'),
        playbackId: z.string().min(1),
        playbackPolicy: z.enum(['public', 'signed']),
        playbackUrl: z.string().url(),
        contentTagIds: z.array(z.string().uuid()),
      }),
    ),
  }),
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInMemorySupabaseService() {
  const learnerUserId = '11111111-1111-4111-8111-111111111111';
  const hockeyContentTypeId = '22222222-2222-4222-8222-222222222222';
  const baseballContentTypeId = '33333333-3333-4333-8333-333333333333';
  const activeTagId = '44444444-4444-4444-8444-444444444444';
  const archivedTagId = '55555555-5555-4555-8555-555555555555';
  const readyIncludedVideoId = '66666666-6666-4666-8666-666666666666';
  const readyArchivedTagVideoId = '77777777-7777-4777-8777-777777777777';
  const processingVideoId = '88888888-8888-4888-8888-888888888888';
  const readyMissingPlaybackVideoId = '99999999-9999-4999-8999-999999999999';

  const usersByToken = new Map<string, { id: string; email: string }>([
    [
      'token-learner',
      {
        id: learnerUserId,
        email: 'learner@example.com',
      },
    ],
  ]);

  const state: InMemoryState = {
    contentTypes: [
      {
        id: hockeyContentTypeId,
        slug: 'hockey',
        name: 'Hockey',
        description: 'Hockey topics',
        icon_key: null,
        sort_order: 1,
        is_active: true,
      },
      {
        id: baseballContentTypeId,
        slug: 'baseball',
        name: 'Baseball',
        description: 'Baseball topics',
        icon_key: null,
        sort_order: 2,
        is_active: true,
      },
    ],
    userContentPreferences: [],
    parentChildLinks: [],
    parentContentRestrictions: [],
    contentTypeTagMappings: [
      {
        content_type_id: hockeyContentTypeId,
        content_tag_id: activeTagId,
      },
      {
        content_type_id: baseballContentTypeId,
        content_tag_id: archivedTagId,
      },
    ],
    contentTags: [
      {
        id: activeTagId,
        is_active: true,
      },
      {
        id: archivedTagId,
        is_active: false,
      },
    ],
    videoContentTags: [
      {
        video_id: readyIncludedVideoId,
        content_tag_id: activeTagId,
      },
      {
        video_id: readyArchivedTagVideoId,
        content_tag_id: archivedTagId,
      },
      {
        video_id: processingVideoId,
        content_tag_id: activeTagId,
      },
      {
        video_id: readyMissingPlaybackVideoId,
        content_tag_id: activeTagId,
      },
    ],
    videos: [
      {
        id: readyIncludedVideoId,
        title: 'Ready included clip',
        description: 'Should appear in learner feed catalog.',
        status: 'ready',
        duration_seconds: 90,
        thumbnail_url: null,
        published_at: '2026-03-01T20:00:00.000Z',
        created_at: '2026-03-01T20:00:00.000Z',
        updated_at: '2026-03-01T20:00:00.000Z',
      },
      {
        id: readyArchivedTagVideoId,
        title: 'Ready archived tag clip',
        description: null,
        status: 'ready',
        duration_seconds: 75,
        thumbnail_url: null,
        published_at: '2026-03-01T20:01:00.000Z',
        created_at: '2026-03-01T20:01:00.000Z',
        updated_at: '2026-03-01T20:01:00.000Z',
      },
      {
        id: processingVideoId,
        title: 'Processing clip',
        description: null,
        status: 'processing',
        duration_seconds: 120,
        thumbnail_url: null,
        published_at: null,
        created_at: '2026-03-01T20:02:00.000Z',
        updated_at: '2026-03-01T20:02:00.000Z',
      },
      {
        id: readyMissingPlaybackVideoId,
        title: 'Ready but no playback clip',
        description: null,
        status: 'ready',
        duration_seconds: 44,
        thumbnail_url: null,
        published_at: '2026-03-01T20:03:00.000Z',
        created_at: '2026-03-01T20:03:00.000Z',
        updated_at: '2026-03-01T20:03:00.000Z',
      },
    ],
    videoAssets: [
      {
        video_id: readyIncludedVideoId,
        mux_playback_id: 'includedplaybackid',
        playback_policy: 'public',
        encoding_status: 'ready',
      },
      {
        video_id: readyArchivedTagVideoId,
        mux_playback_id: 'archivedtagplaybackid',
        playback_policy: 'public',
        encoding_status: 'ready',
      },
      {
        video_id: processingVideoId,
        mux_playback_id: 'processingplaybackid',
        playback_policy: 'public',
        encoding_status: 'ready',
      },
      {
        video_id: readyMissingPlaybackVideoId,
        mux_playback_id: null,
        playback_policy: 'public',
        encoding_status: 'ready',
      },
    ],
  };

  const getTableRows = (table: SupportedTable): Record<string, unknown>[] => {
    if (table === 'content_types') {
      return state.contentTypes;
    }

    if (table === 'user_content_preferences') {
      return state.userContentPreferences;
    }

    if (table === 'parent_child_links') {
      return state.parentChildLinks;
    }

    if (table === 'parent_content_restrictions') {
      return state.parentContentRestrictions;
    }

    if (table === 'content_type_tag_mappings') {
      return state.contentTypeTagMappings;
    }

    if (table === 'content_tags') {
      return state.contentTags;
    }

    if (table === 'video_content_tags') {
      return state.videoContentTags;
    }

    if (table === 'videos') {
      return state.videos;
    }

    return state.videoAssets;
  };

  class InMemoryQueryBuilder implements PromiseLike<QueryExecutionResult> {
    private readonly filters: Array<(row: Record<string, unknown>) => boolean> =
      [];
    private readonly orderBys: Array<{ field: string; ascending: boolean }> =
      [];
    private resultMode: 'many' | 'single' | 'maybeSingle' = 'many';
    private maxRows: number | null = null;

    constructor(private readonly table: SupportedTable) {}

    select(columns: string) {
      void columns;
      return this;
    }

    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }

    in(field: string, values: unknown[]) {
      this.filters.push((row) => values.includes(row[field]));
      return this;
    }

    order(field: string, options?: { ascending?: boolean }) {
      this.orderBys.push({
        field,
        ascending: options?.ascending ?? true,
      });
      return this;
    }

    limit(value: number) {
      this.maxRows = value;
      return this;
    }

    maybeSingle() {
      this.resultMode = 'maybeSingle';
      return this.execute();
    }

    single() {
      this.resultMode = 'single';
      return this.execute();
    }

    then<TResult1 = QueryExecutionResult, TResult2 = never>(
      onfulfilled?:
        | ((value: QueryExecutionResult) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ): Promise<TResult1 | TResult2> {
      return this.execute().then(onfulfilled, onrejected);
    }

    private execute(): Promise<QueryExecutionResult> {
      const rows = this.applyReadFilters();
      return this.resolveResult(rows);
    }

    private applyReadFilters(): Record<string, unknown>[] {
      const rows = getTableRows(this.table)
        .filter((row) => this.filters.every((filter) => filter(row)))
        .map((row) => clone(row));

      if (this.orderBys.length > 0) {
        rows.sort((firstRow, secondRow) => {
          for (const orderBy of this.orderBys) {
            const firstValue = firstRow[orderBy.field];
            const secondValue = secondRow[orderBy.field];

            if (firstValue === secondValue) {
              continue;
            }

            const comparison =
              firstValue && secondValue && firstValue > secondValue ? 1 : -1;

            return orderBy.ascending ? comparison : comparison * -1;
          }

          return 0;
        });
      }

      if (this.maxRows !== null) {
        return rows.slice(0, this.maxRows);
      }

      return rows;
    }

    private resolveResult(rows: Record<string, unknown>[]) {
      if (this.resultMode === 'maybeSingle') {
        return Promise.resolve({
          data: rows[0] ?? null,
          error: null,
        });
      }

      if (this.resultMode === 'single') {
        if (!rows[0]) {
          throw new Error('No matching row found for single query.');
        }

        return Promise.resolve({
          data: rows[0],
          error: null,
        });
      }

      return Promise.resolve({
        data: rows,
        error: null,
      });
    }
  }

  const serviceClient = {
    auth: {
      getUser: (accessToken: string) => {
        const user = usersByToken.get(accessToken);

        if (!user) {
          return Promise.resolve({
            data: { user: null },
            error: { message: 'Invalid token' },
          });
        }

        return Promise.resolve({
          data: {
            user: {
              id: user.id,
              email: user.email,
            },
          },
          error: null,
        });
      },
    },
    from: (table: SupportedTable) => new InMemoryQueryBuilder(table),
  };

  return {
    learnerUserId,
    readyIncludedVideoId,
    getServiceClient: () => serviceClient,
  };
}

describe('Feed catalog contract (e2e)', () => {
  let app: INestApplication<App>;
  let learnerUserId: string;
  let readyIncludedVideoId: string;

  beforeEach(async () => {
    const inMemorySupabaseService = createInMemorySupabaseService();
    learnerUserId = inMemorySupabaseService.learnerUserId;
    readyIncludedVideoId = inMemorySupabaseService.readyIncludedVideoId;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({ getServiceClient: inMemorySupabaseService.getServiceClient })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns only ready playable videos mapped through active content tags', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/feed/catalog')
      .set('Authorization', 'Bearer token-learner')
      .expect(200);

    const parsedResponse = feedCatalogEnvelopeSchema.parse(
      response.body as unknown,
    );

    expect(parsedResponse.data.userId).toBe(learnerUserId);
    expect(parsedResponse.data.videos).toHaveLength(1);
    expect(parsedResponse.data.videos[0]?.id).toBe(readyIncludedVideoId);
    expect(parsedResponse.data.videos[0]?.status).toBe('ready');
    expect(parsedResponse.data.videos[0]?.playbackUrl).toContain('/medium.mp4');
  });

  it('requires an authenticated bearer token', async () => {
    await request(app.getHttpServer()).get('/v1/feed/catalog').expect(401);
  });
});
