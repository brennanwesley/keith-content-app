import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';

type AccountType = 'learner' | 'parent' | 'admin';
type VideoStatus = 'draft' | 'processing' | 'ready' | 'blocked' | 'archived';
type VideoEncodingStatus = 'pending' | 'preparing' | 'ready' | 'errored';
type PlaybackPolicy = 'public' | 'signed';

type SupportedTable = 'profiles' | 'videos' | 'video_assets';

type ProfileRow = {
  id: string;
  account_type: AccountType;
};

type VideoRow = {
  id: string;
  status: VideoStatus;
  title: string;
  published_at: string | null;
};

type VideoAssetRow = {
  video_id: string;
  provider: 'mux';
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  playback_policy: PlaybackPolicy;
  encoding_status: VideoEncodingStatus;
  error_reason: string | null;
};

type InMemoryUser = {
  id: string;
  email: string;
};

type InMemoryState = {
  profiles: ProfileRow[];
  videos: VideoRow[];
  videoAssets: VideoAssetRow[];
};

type QueryExecutionResult = {
  data: unknown;
  error: null;
};

const muxDirectUploadEnvelopeSchema = z.object({
  data: z.object({
    videoId: z.string().uuid(),
    uploadId: z.string().min(1),
    uploadUrl: z.string().url(),
    playbackPolicy: z.enum(['public', 'signed']),
  }),
});

const muxWebhookEnvelopeSchema = z.object({
  data: z.object({
    received: z.literal(true),
    eventType: z.string().min(1),
    handled: z.boolean(),
  }),
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function signMuxPayload(payload: string, signingSecret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', signingSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

function createInMemorySupabaseService() {
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const parentUserId = '22222222-2222-4222-8222-222222222222';
  const managedVideoId = '55555555-5555-4555-8555-555555555555';

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
    videos: [
      {
        id: managedVideoId,
        status: 'draft',
        title: 'Fundamentals Warmup',
        published_at: null,
      },
    ],
    videoAssets: [],
  };

  const getTableRows = (table: SupportedTable): Record<string, unknown>[] => {
    if (table === 'profiles') {
      return state.profiles;
    }

    if (table === 'videos') {
      return state.videos;
    }

    return state.videoAssets;
  };

  class InMemoryQueryBuilder implements PromiseLike<QueryExecutionResult> {
    private readonly filters: Array<(row: Record<string, unknown>) => boolean> =
      [];
    private pendingOperation: 'select' | 'update' | 'upsert' = 'select';
    private pendingUpdatePatch: Record<string, unknown> = {};
    private pendingUpsertRows: Record<string, unknown>[] = [];
    private pendingUpsertOnConflict: string | null = null;
    private resultMode: 'many' | 'single' | 'maybeSingle' = 'many';

    constructor(private readonly table: SupportedTable) {}

    select(columns: string) {
      void columns;
      return this;
    }

    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
      return this;
    }

    update(patch: Record<string, unknown>) {
      this.pendingOperation = 'update';
      this.pendingUpdatePatch = patch;
      return this;
    }

    upsert(
      payload: Record<string, unknown> | Record<string, unknown>[],
      options?: { onConflict?: string },
    ) {
      this.pendingOperation = 'upsert';
      this.pendingUpsertRows = Array.isArray(payload) ? payload : [payload];
      this.pendingUpsertOnConflict = options?.onConflict ?? null;
      return this;
    }

    order(field: string, options: { ascending: boolean }) {
      void field;
      void options;
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
      if (this.pendingOperation === 'update') {
        const updatedRows = this.executeUpdate();
        return this.resolveResult(updatedRows);
      }

      if (this.pendingOperation === 'upsert') {
        const upsertedRows = this.executeUpsert();
        return this.resolveResult(upsertedRows);
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

    private executeUpdate(): Record<string, unknown>[] {
      const tableRows = getTableRows(this.table);
      const matchingRows = tableRows.filter((row) =>
        this.filters.every((filter) => filter(row)),
      );

      for (const row of matchingRows) {
        Object.assign(row, this.pendingUpdatePatch);
      }

      return matchingRows;
    }

    private executeUpsert(): Record<string, unknown>[] {
      if (this.table !== 'video_assets') {
        throw new Error(
          `Upsert is unsupported for table ${this.table} in this test.`,
        );
      }

      const tableRows = getTableRows(this.table) as unknown as VideoAssetRow[];

      return this.pendingUpsertRows.map((pendingRow) => {
        if (this.pendingUpsertOnConflict !== 'video_id') {
          throw new Error(
            'Expected video_assets upsert on conflict by video_id.',
          );
        }

        const pendingVideoId = String(pendingRow.video_id);
        const existingRow = tableRows.find(
          (row) => row.video_id === pendingVideoId,
        );

        if (existingRow) {
          Object.assign(existingRow, pendingRow);
          return existingRow as unknown as Record<string, unknown>;
        }

        const insertedRow: VideoAssetRow = {
          video_id: pendingVideoId,
          provider: 'mux',
          mux_asset_id:
            (pendingRow.mux_asset_id as string | null | undefined) ?? null,
          mux_playback_id:
            (pendingRow.mux_playback_id as string | null | undefined) ?? null,
          playback_policy:
            (pendingRow.playback_policy as PlaybackPolicy | undefined) ??
            'public',
          encoding_status:
            (pendingRow.encoding_status as VideoEncodingStatus | undefined) ??
            'pending',
          error_reason:
            (pendingRow.error_reason as string | null | undefined) ?? null,
        };

        tableRows.push(insertedRow);
        return insertedRow as unknown as Record<string, unknown>;
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
    adminUserId,
    parentUserId,
    managedVideoId,
    state,
    getServiceClient: () => serviceClient,
  };
}

describe('Mux direct upload and webhook flow (e2e)', () => {
  let app: INestApplication<App>;
  let managedVideoId: string;
  let state: InMemoryState;
  let originalFetch: typeof global.fetch;

  const originalMuxTokenId = process.env.MUX_TOKEN_ID;
  const originalMuxTokenSecret = process.env.MUX_TOKEN_SECRET;
  const originalMuxWebhookSigningSecret =
    process.env.MUX_WEBHOOK_SIGNING_SECRET;

  beforeEach(async () => {
    process.env.MUX_TOKEN_ID = 'mux-token-id';
    process.env.MUX_TOKEN_SECRET = 'mux-token-secret';
    process.env.MUX_WEBHOOK_SIGNING_SECRET = 'mux-webhook-secret';

    const inMemorySupabaseService = createInMemorySupabaseService();
    managedVideoId = inMemorySupabaseService.managedVideoId;
    state = inMemorySupabaseService.state;

    originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              id: 'upload_123',
              url: 'https://storage.mux.com/upload_123',
            },
          }),
      } as Response),
    ) as unknown as typeof fetch;

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

    global.fetch = originalFetch;

    process.env.MUX_TOKEN_ID = originalMuxTokenId;
    process.env.MUX_TOKEN_SECRET = originalMuxTokenSecret;
    process.env.MUX_WEBHOOK_SIGNING_SECRET = originalMuxWebhookSigningSecret;
  });

  it('creates direct uploads and processes asset-ready webhook lifecycle updates', async () => {
    const createUploadResponse = await request(app.getHttpServer())
      .post('/v1/mux/uploads')
      .set('Authorization', 'Bearer token-admin')
      .send({
        videoId: managedVideoId,
        playbackPolicy: 'public',
      })
      .expect(201);

    const parsedCreateUpload = muxDirectUploadEnvelopeSchema.parse(
      createUploadResponse.body as unknown,
    );

    expect(parsedCreateUpload.data.videoId).toBe(managedVideoId);
    expect(parsedCreateUpload.data.uploadId).toBe('upload_123');
    expect(parsedCreateUpload.data.uploadUrl).toBe(
      'https://storage.mux.com/upload_123',
    );

    expect(state.videos[0]?.status).toBe('processing');

    const uploadCreatedPayload = JSON.stringify({
      type: 'video.upload.asset_created',
      object: {
        asset_id: 'asset_123',
        new_asset_settings: {
          passthrough: managedVideoId,
          playback_policy: ['public'],
        },
      },
    });

    const uploadCreatedWebhookResponse = await request(app.getHttpServer())
      .post('/v1/mux/webhooks')
      .set(
        'Mux-Signature',
        signMuxPayload(uploadCreatedPayload, 'mux-webhook-secret'),
      )
      .set('Content-Type', 'application/json')
      .send(uploadCreatedPayload)
      .expect(200);

    const parsedUploadCreatedWebhook = muxWebhookEnvelopeSchema.parse(
      uploadCreatedWebhookResponse.body as unknown,
    );

    expect(parsedUploadCreatedWebhook.data.eventType).toBe(
      'video.upload.asset_created',
    );
    expect(parsedUploadCreatedWebhook.data.handled).toBe(true);

    const readyPayload = JSON.stringify({
      type: 'video.asset.ready',
      object: {
        id: 'asset_123',
        passthrough: managedVideoId,
        playback_ids: [
          {
            id: 'playback_123',
            policy: 'public',
          },
        ],
      },
    });

    const readyWebhookResponse = await request(app.getHttpServer())
      .post('/v1/mux/webhooks')
      .set('Mux-Signature', signMuxPayload(readyPayload, 'mux-webhook-secret'))
      .set('Content-Type', 'application/json')
      .send(readyPayload)
      .expect(200);

    const parsedReadyWebhook = muxWebhookEnvelopeSchema.parse(
      readyWebhookResponse.body as unknown,
    );

    expect(parsedReadyWebhook.data.eventType).toBe('video.asset.ready');
    expect(parsedReadyWebhook.data.handled).toBe(true);

    expect(state.videos[0]?.status).toBe('ready');
    expect(state.videos[0]?.published_at).not.toBeNull();

    expect(state.videoAssets).toHaveLength(1);
    expect(state.videoAssets[0]?.mux_asset_id).toBe('asset_123');
    expect(state.videoAssets[0]?.mux_playback_id).toBe('playback_123');
    expect(state.videoAssets[0]?.encoding_status).toBe('ready');
  });

  it('forbids non-admin users from creating direct uploads and rejects invalid webhook signatures', async () => {
    await request(app.getHttpServer())
      .post('/v1/mux/uploads')
      .set('Authorization', 'Bearer token-parent')
      .send({
        videoId: managedVideoId,
        playbackPolicy: 'public',
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/mux/webhooks')
      .set('Mux-Signature', 't=1700000000,v1=invalidsignature')
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          type: 'video.asset.ready',
          object: {
            id: 'asset_123',
          },
        }),
      )
      .expect(401);
  });
});
