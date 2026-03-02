import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';

type SupportedTable =
  | 'videos'
  | 'video_content_tags'
  | 'content_tags'
  | 'watch_events';

type VideoRow = {
  id: string;
  status: 'draft' | 'processing' | 'ready' | 'blocked' | 'archived';
};

type VideoContentTagRow = {
  video_id: string;
  content_tag_id: string;
};

type ContentTagRow = {
  id: string;
  is_active: boolean;
};

type WatchEventRow = {
  id: string;
  user_id: string;
  video_id: string;
  event_type:
    | 'play'
    | 'pause'
    | 'progress_25'
    | 'progress_50'
    | 'progress_75'
    | 'complete'
    | 'replay';
  position_seconds: number | null;
  occurred_at: string;
  session_id: string | null;
};

type InMemoryState = {
  videos: VideoRow[];
  videoContentTags: VideoContentTagRow[];
  contentTags: ContentTagRow[];
  watchEvents: WatchEventRow[];
  watchEventCounter: number;
};

type QueryExecutionResult = {
  data: unknown;
  error: null;
};

const watchEventEnvelopeSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    videoId: z.string().uuid(),
    eventType: z.enum([
      'play',
      'pause',
      'progress_25',
      'progress_50',
      'progress_75',
      'complete',
      'replay',
    ]),
    positionSeconds: z.number().int().nullable(),
    occurredAt: z.string(),
    sessionId: z.string().uuid().nullable(),
  }),
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInMemorySupabaseService() {
  const learnerUserId = '33333333-3333-4333-8333-333333333333';
  const readyTaggedVideoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const readyUntaggedVideoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const readyArchivedTaggedVideoId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const activeTagId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const archivedTagId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

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
    videos: [
      {
        id: readyTaggedVideoId,
        status: 'ready',
      },
      {
        id: readyUntaggedVideoId,
        status: 'ready',
      },
      {
        id: readyArchivedTaggedVideoId,
        status: 'ready',
      },
    ],
    videoContentTags: [
      {
        video_id: readyTaggedVideoId,
        content_tag_id: activeTagId,
      },
      {
        video_id: readyArchivedTaggedVideoId,
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
    watchEvents: [],
    watchEventCounter: 0,
  };

  const nextWatchEventId = () => {
    state.watchEventCounter += 1;

    if (state.watchEventCounter === 1) {
      return 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    }

    const suffix = state.watchEventCounter.toString(16).padStart(12, '0');
    return `99999999-9999-4999-8999-${suffix}`;
  };

  const getTableRows = (table: SupportedTable): Record<string, unknown>[] => {
    if (table === 'videos') {
      return state.videos;
    }

    if (table === 'video_content_tags') {
      return state.videoContentTags;
    }

    if (table === 'content_tags') {
      return state.contentTags;
    }

    return state.watchEvents;
  };

  class InMemoryQueryBuilder implements PromiseLike<QueryExecutionResult> {
    private readonly filters: Array<(row: Record<string, unknown>) => boolean> =
      [];
    private pendingOperation: 'select' | 'insert' = 'select';
    private pendingInsertRows: Record<string, unknown>[] = [];
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

    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }

    in(field: string, values: unknown[]) {
      this.filters.push((row) => values.includes(row[field]));
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

      const rows = this.applyReadFilters();
      return this.resolveResult(rows);
    }

    private executeInsert(): Record<string, unknown>[] {
      if (this.table !== 'watch_events') {
        throw new Error(
          `Insert is unsupported for table ${this.table} in this test.`,
        );
      }

      const tableRows = getTableRows(this.table) as unknown as WatchEventRow[];

      return this.pendingInsertRows.map((pendingRow) => {
        const insertedRow: WatchEventRow = {
          id: nextWatchEventId(),
          user_id: String(pendingRow.user_id),
          video_id: String(pendingRow.video_id),
          event_type: pendingRow.event_type as WatchEventRow['event_type'],
          position_seconds:
            (pendingRow.position_seconds as number | null | undefined) ?? null,
          occurred_at: String(pendingRow.occurred_at),
          session_id:
            (pendingRow.session_id as string | null | undefined) ?? null,
        };

        tableRows.push(insertedRow);
        return insertedRow as Record<string, unknown>;
      });
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

    private applyReadFilters(): Record<string, unknown>[] {
      return getTableRows(this.table).filter((row) =>
        this.filters.every((filter) => filter(row)),
      );
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
    readyTaggedVideoId,
    readyUntaggedVideoId,
    readyArchivedTaggedVideoId,
    getServiceClient: () => serviceClient,
  };
}

describe('Engagement watch-event tracking (e2e)', () => {
  let app: INestApplication<App>;
  let readyTaggedVideoId: string;
  let readyUntaggedVideoId: string;
  let readyArchivedTaggedVideoId: string;

  beforeEach(async () => {
    const inMemorySupabaseService = createInMemorySupabaseService();
    readyTaggedVideoId = inMemorySupabaseService.readyTaggedVideoId;
    readyUntaggedVideoId = inMemorySupabaseService.readyUntaggedVideoId;
    readyArchivedTaggedVideoId =
      inMemorySupabaseService.readyArchivedTaggedVideoId;

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

  it('allows watch-event tracking for ready videos with at least one active content tag', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/engagement/watch-events')
      .set('Authorization', 'Bearer token-learner')
      .send({
        videoId: readyTaggedVideoId,
        eventType: 'play',
      })
      .expect(201);

    const parsedResponse = watchEventEnvelopeSchema.parse(
      response.body as unknown,
    );

    expect(parsedResponse.data.videoId).toBe(readyTaggedVideoId);
    expect(parsedResponse.data.eventType).toBe('play');
  });

  it('rejects watch-event tracking for ready videos without any content-tag assignment', async () => {
    await request(app.getHttpServer())
      .post('/v1/engagement/watch-events')
      .set('Authorization', 'Bearer token-learner')
      .send({
        videoId: readyUntaggedVideoId,
        eventType: 'play',
      })
      .expect(404);
  });

  it('rejects watch-event tracking for ready videos mapped only to archived tags', async () => {
    await request(app.getHttpServer())
      .post('/v1/engagement/watch-events')
      .set('Authorization', 'Bearer token-learner')
      .send({
        videoId: readyArchivedTaggedVideoId,
        eventType: 'play',
      })
      .expect(404);
  });
});
