import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';

type AccountType = 'learner' | 'parent' | 'admin';
type VideoStatus = 'draft' | 'processing' | 'ready' | 'blocked' | 'archived';
type SupportedTable =
  | 'profiles'
  | 'content_types'
  | 'content_tags'
  | 'videos'
  | 'video_content_tags';

type ProfileRow = {
  id: string;
  account_type: AccountType;
};

type ContentTypeRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: string | null;
  sort_order: number;
  is_active: boolean;
};

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  status: VideoStatus | 'published' | 'unpublished';
  owner_id: string | null;
  duration_seconds: number | string | null;
  thumbnail_url: string | null;
  published_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type VideoContentTypeRow = {
  video_id: string;
  content_tag_id: string;
  created_at: string;
};

type ContentTagRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type InMemoryUser = {
  id: string;
  email: string;
};

type InMemoryState = {
  profiles: ProfileRow[];
  contentTypes: ContentTypeRow[];
  contentTags: ContentTagRow[];
  videos: VideoRow[];
  videoContentTags: VideoContentTypeRow[];
  timestamps: number;
  videoCounter: number;
};

type QueryExecutionResult = {
  data: unknown;
  error: null;
};

const contentTypeIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const videoStatusSchema = z.enum([
  'draft',
  'processing',
  'ready',
  'blocked',
  'archived',
]);

const adminVideoSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: videoStatusSchema,
  ownerId: z.string().uuid().nullable(),
  durationSeconds: z.number().int().nullable(),
  thumbnailUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  contentTagIds: z.array(contentTypeIdSchema),
  contentTags: z.array(
    z.object({
      id: contentTypeIdSchema,
      slug: z.string(),
      name: z.string(),
      description: z.string(),
      isActive: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  contentTypeIds: z.array(contentTypeIdSchema),
  contentTypes: z.array(
    z.object({
      id: contentTypeIdSchema,
      slug: z.string(),
      name: z.string(),
      description: z.string(),
      iconKey: z.string().nullable(),
      sortOrder: z.number().int(),
      isActive: z.boolean(),
    }),
  ),
});

const adminVideoEnvelopeSchema = z.object({
  data: adminVideoSummarySchema,
});

const adminVideoListEnvelopeSchema = z.object({
  data: z.array(adminVideoSummarySchema),
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInMemorySupabaseService() {
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const parentUserId = '22222222-2222-4222-8222-222222222222';
  const hockeyContentTypeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const baseballContentTypeId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const soccerContentTypeId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  const usersByToken = new Map<string, InMemoryUser>([
    [
      'token-admin',
      {
        id: adminUserId,
        email: 'adminapp@email.com',
      },
    ],
    [
      'token-parent',
      {
        id: parentUserId,
        email: 'parent@example.com',
      },
    ],
  ]);

  const state: InMemoryState = {
    profiles: [
      {
        id: adminUserId,
        account_type: 'admin',
      },
      {
        id: parentUserId,
        account_type: 'parent',
      },
    ],
    contentTypes: [
      {
        id: hockeyContentTypeId,
        slug: 'youth-hockey',
        name: 'Youth Hockey',
        description: 'Skating and positional drills.',
        icon_key: 'hockey',
        sort_order: 1,
        is_active: true,
      },
      {
        id: baseballContentTypeId,
        slug: 'youth-baseball',
        name: 'Youth Baseball',
        description: 'Batting and infield reps.',
        icon_key: 'baseball',
        sort_order: 2,
        is_active: true,
      },
      {
        id: soccerContentTypeId,
        slug: 'youth-soccer',
        name: 'Youth Soccer',
        description: 'Ball control and transition movement.',
        icon_key: 'soccer',
        sort_order: 3,
        is_active: true,
      },
    ],
    contentTags: [
      {
        id: hockeyContentTypeId,
        slug: 'youth-hockey',
        name: 'Youth Hockey',
        description: 'Skating and positional drills.',
        is_active: true,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: baseballContentTypeId,
        slug: 'youth-baseball',
        name: 'Youth Baseball',
        description: 'Batting and infield reps.',
        is_active: true,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: soccerContentTypeId,
        slug: 'youth-soccer',
        name: 'Youth Soccer',
        description: 'Ball control and transition movement.',
        is_active: true,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
    ],
    videos: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Existing Hockey Warmup',
        description: 'Warmup sequence for edge control.',
        status: 'draft',
        owner_id: adminUserId,
        duration_seconds: 90,
        thumbnail_url: null,
        published_at: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
    ],
    videoContentTags: [
      {
        video_id: '55555555-5555-4555-8555-555555555555',
        content_tag_id: hockeyContentTypeId,
        created_at: '2026-03-01T00:00:01.000Z',
      },
    ],
    timestamps: 10,
    videoCounter: 0,
  };

  const nextTimestamp = () => {
    const timestamp = new Date(
      Date.UTC(2026, 2, 1, 0, 0, state.timestamps),
    ).toISOString();
    state.timestamps += 1;

    return timestamp;
  };

  const nextVideoId = () => {
    state.videoCounter += 1;

    if (state.videoCounter === 1) {
      return '66666666-6666-4666-8666-666666666666';
    }

    const suffix = state.videoCounter.toString(16).padStart(12, '0');
    return `77777777-7777-4777-8777-${suffix}`;
  };

  const getTableRows = (table: SupportedTable): Record<string, unknown>[] => {
    if (table === 'profiles') {
      return state.profiles;
    }

    if (table === 'content_types') {
      return state.contentTypes;
    }

    if (table === 'content_tags') {
      return state.contentTags;
    }

    if (table === 'videos') {
      return state.videos;
    }

    return state.videoContentTags;
  };

  class InMemoryQueryBuilder implements PromiseLike<QueryExecutionResult> {
    private readonly filters: Array<(row: Record<string, unknown>) => boolean> =
      [];
    private readonly orderClauses: Array<{
      field: string;
      ascending: boolean;
    }> = [];
    private pendingOperation: 'select' | 'insert' | 'update' | 'delete' =
      'select';
    private pendingInsertRows: Record<string, unknown>[] = [];
    private pendingUpdatePatch: Record<string, unknown> = {};
    private resultMode: 'many' | 'single' | 'maybeSingle' = 'many';

    constructor(private readonly table: SupportedTable) {}

    select(columns: string) {
      void columns;
      return this;
    }

    insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
      this.pendingOperation = 'insert';
      this.pendingInsertRows = Array.isArray(payload) ? payload : [payload];
      return this;
    }

    update(patch: Record<string, unknown>) {
      this.pendingOperation = 'update';
      this.pendingUpdatePatch = patch;
      return this;
    }

    delete() {
      this.pendingOperation = 'delete';
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

    order(field: string, options: { ascending: boolean }) {
      this.orderClauses.push({ field, ascending: options.ascending });
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
      if (this.pendingOperation === 'insert') {
        const insertedRows = this.executeInsert();
        return this.resolveResult(insertedRows);
      }

      if (this.pendingOperation === 'update') {
        const updatedRows = this.executeUpdate();
        return this.resolveResult(updatedRows);
      }

      if (this.pendingOperation === 'delete') {
        const deletedRows = this.executeDelete();
        return this.resolveResult(deletedRows);
      }

      const rows = this.applyReadFilters();
      return this.resolveResult(rows);
    }

    private resolveResult(rows: Record<string, unknown>[]) {
      if (this.resultMode === 'maybeSingle') {
        return Promise.resolve({
          data: clone(rows[0] ?? null),
          error: null,
        });
      }

      if (this.resultMode === 'single') {
        if (!rows[0]) {
          throw new Error('No matching row found for single query.');
        }

        return Promise.resolve({
          data: clone(rows[0]),
          error: null,
        });
      }

      return Promise.resolve({
        data: clone(rows),
        error: null,
      });
    }

    private executeInsert(): Record<string, unknown>[] {
      if (this.table === 'videos') {
        const tableRows = getTableRows(this.table) as unknown as VideoRow[];

        return this.pendingInsertRows.map((pendingRow) => {
          const timestamp = nextTimestamp();
          const insertedRow: VideoRow = {
            id: nextVideoId(),
            title: String(pendingRow.title),
            description:
              (pendingRow.description as string | null | undefined) ?? null,
            status: (pendingRow.status as VideoStatus) ?? 'draft',
            owner_id:
              (pendingRow.owner_id as string | null | undefined) ?? null,
            duration_seconds:
              (pendingRow.duration_seconds as number | null | undefined) ??
              null,
            thumbnail_url:
              (pendingRow.thumbnail_url as string | null | undefined) ?? null,
            published_at:
              (pendingRow.published_at as string | null | undefined) ?? null,
            created_at: timestamp,
            updated_at: timestamp,
          };

          tableRows.push(insertedRow);
          return insertedRow as Record<string, unknown>;
        });
      }

      if (this.table === 'video_content_tags') {
        const tableRows = getTableRows(
          this.table,
        ) as unknown as VideoContentTypeRow[];

        return this.pendingInsertRows.map((pendingRow) => {
          const insertedRow: VideoContentTypeRow = {
            video_id: String(pendingRow.video_id),
            content_tag_id: String(pendingRow.content_tag_id),
            created_at: nextTimestamp(),
          };

          tableRows.push(insertedRow);
          return insertedRow as Record<string, unknown>;
        });
      }

      throw new Error(
        `Insert is unsupported for table ${this.table} in this test.`,
      );
    }

    private executeUpdate(): Record<string, unknown>[] {
      if (this.table !== 'videos') {
        throw new Error(
          `Update is unsupported for table ${this.table} in this test.`,
        );
      }

      const tableRows = getTableRows(this.table) as unknown as VideoRow[];
      const matchingRows = tableRows.filter((row) =>
        this.filters.every((filter) =>
          filter(row as unknown as Record<string, unknown>),
        ),
      );

      for (const row of matchingRows) {
        Object.assign(row, this.pendingUpdatePatch);
        row.updated_at = nextTimestamp();
      }

      return matchingRows as unknown as Record<string, unknown>[];
    }

    private executeDelete(): Record<string, unknown>[] {
      if (this.table !== 'video_content_tags' && this.table !== 'videos') {
        throw new Error(
          `Delete is unsupported for table ${this.table} in this test.`,
        );
      }

      const tableRows = getTableRows(this.table);
      const nextRows: Record<string, unknown>[] = [];
      const deletedRows: Record<string, unknown>[] = [];

      for (const row of tableRows) {
        const matchesFilters = this.filters.every((filter) => filter(row));

        if (matchesFilters) {
          deletedRows.push(row);
        } else {
          nextRows.push(row);
        }
      }

      if (this.table === 'video_content_tags') {
        state.videoContentTags = nextRows as VideoContentTypeRow[];
      } else {
        state.videos = nextRows as VideoRow[];
      }

      return deletedRows;
    }

    private applyReadFilters(): Record<string, unknown>[] {
      const rows = getTableRows(this.table).filter((row) =>
        this.filters.every((filter) => filter(row)),
      );

      if (this.orderClauses.length === 0) {
        return rows;
      }

      return [...rows].sort((firstRow, secondRow) => {
        for (const orderClause of this.orderClauses) {
          const firstValue = firstRow[orderClause.field];
          const secondValue = secondRow[orderClause.field];

          if (firstValue === secondValue) {
            continue;
          }

          if (
            typeof firstValue === 'number' &&
            typeof secondValue === 'number'
          ) {
            return orderClause.ascending
              ? firstValue - secondValue
              : secondValue - firstValue;
          }

          const comparison = String(firstValue).localeCompare(
            String(secondValue),
          );
          return orderClause.ascending ? comparison : -comparison;
        }

        return 0;
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
    adminUserId,
    parentUserId,
    hockeyContentTypeId,
    baseballContentTypeId,
    soccerContentTypeId,
    state,
    getServiceClient: () => serviceClient,
  };
}

describe('Admin video management flow (e2e)', () => {
  let app: INestApplication<App>;
  let inMemoryState: InMemoryState;
  let adminUserId: string;
  let hockeyContentTypeId: string;
  let baseballContentTypeId: string;
  let soccerContentTypeId: string;

  beforeEach(async () => {
    const inMemorySupabaseService = createInMemorySupabaseService();
    inMemoryState = inMemorySupabaseService.state;
    adminUserId = inMemorySupabaseService.adminUserId;
    hockeyContentTypeId = inMemorySupabaseService.hockeyContentTypeId;
    baseballContentTypeId = inMemorySupabaseService.baseballContentTypeId;
    soccerContentTypeId = inMemorySupabaseService.soccerContentTypeId;

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

  it('allows an admin to create and manage videos with multiple content tags', async () => {
    const createVideoResponse = await request(app.getHttpServer())
      .post('/v1/admin/videos')
      .set('Authorization', 'Bearer token-admin')
      .send({
        title: 'Transition Breakout Concepts',
        description: 'How to create controlled exits under pressure.',
        status: 'draft',
        durationSeconds: 145,
        contentTypeIds: [hockeyContentTypeId, baseballContentTypeId],
      })
      .expect(201);

    const parsedCreateVideo = adminVideoEnvelopeSchema.parse(
      createVideoResponse.body as unknown,
    );

    const createdVideoId = parsedCreateVideo.data.id;

    expect(parsedCreateVideo.data.ownerId).toBe(adminUserId);
    expect(parsedCreateVideo.data.contentTagIds).toEqual([
      hockeyContentTypeId,
      baseballContentTypeId,
    ]);
    expect(parsedCreateVideo.data.contentTypeIds).toEqual([
      hockeyContentTypeId,
      baseballContentTypeId,
    ]);

    const listVideosResponse = await request(app.getHttpServer())
      .get('/v1/admin/videos')
      .set('Authorization', 'Bearer token-admin')
      .expect(200);

    const parsedVideoList = adminVideoListEnvelopeSchema.parse(
      listVideosResponse.body as unknown,
    );

    expect(
      parsedVideoList.data.some((video) => video.id === createdVideoId),
    ).toBe(true);

    const updateVideoResponse = await request(app.getHttpServer())
      .put(`/v1/admin/videos/${createdVideoId}`)
      .set('Authorization', 'Bearer token-admin')
      .send({
        status: 'ready',
        contentTagIds: [baseballContentTypeId, soccerContentTypeId],
      })
      .expect(200);

    const parsedUpdatedVideo = adminVideoEnvelopeSchema.parse(
      updateVideoResponse.body as unknown,
    );

    expect(parsedUpdatedVideo.data.status).toBe('ready');
    expect(parsedUpdatedVideo.data.contentTagIds).toEqual([
      baseballContentTypeId,
      soccerContentTypeId,
    ]);
    expect(parsedUpdatedVideo.data.contentTypeIds).toEqual([
      baseballContentTypeId,
      soccerContentTypeId,
    ]);

    const readyVideosResponse = await request(app.getHttpServer())
      .get('/v1/admin/videos')
      .query({ status: 'ready' })
      .set('Authorization', 'Bearer token-admin')
      .expect(200);

    const parsedReadyVideos = adminVideoListEnvelopeSchema.parse(
      readyVideosResponse.body as unknown,
    );

    expect(parsedReadyVideos.data).toHaveLength(1);
    expect(parsedReadyVideos.data[0]?.id).toBe(createdVideoId);
    expect(parsedReadyVideos.data[0]?.status).toBe('ready');
  });

  it('coerces legacy admin video list payload fields instead of failing with 500', async () => {
    const existingVideo = inMemoryState.videos[0];

    if (!existingVideo) {
      throw new Error('Expected seeded admin video row to exist.');
    }

    existingVideo.status = 'published';
    existingVideo.duration_seconds = '90';
    existingVideo.created_at = new Date('2026-03-01T00:00:00.000Z');
    existingVideo.updated_at = new Date('2026-03-01T00:00:05.000Z');
    existingVideo.published_at = new Date('2026-03-01T00:00:06.000Z');

    const listVideosResponse = await request(app.getHttpServer())
      .get('/v1/admin/videos')
      .set('Authorization', 'Bearer token-admin')
      .expect(200);

    const parsedVideoList = adminVideoListEnvelopeSchema.parse(
      listVideosResponse.body as unknown,
    );

    expect(parsedVideoList.data[0]?.status).toBe('ready');
    expect(parsedVideoList.data[0]?.durationSeconds).toBe(90);
    expect(parsedVideoList.data[0]?.publishedAt).toBe(
      '2026-03-01T00:00:06.000Z',
    );
  });

  it('forbids non-admin users from admin video management endpoints', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/videos')
      .set('Authorization', 'Bearer token-parent')
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/admin/videos')
      .set('Authorization', 'Bearer token-parent')
      .send({
        title: 'Unauthorized Attempt',
        contentTypeIds: [hockeyContentTypeId],
      })
      .expect(403);

    await request(app.getHttpServer())
      .put('/v1/admin/videos/55555555-5555-4555-8555-555555555555')
      .set('Authorization', 'Bearer token-parent')
      .send({ status: 'ready', contentTypeIds: [hockeyContentTypeId] })
      .expect(403);
  });
});
