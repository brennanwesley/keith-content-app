import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';

type AccountType = 'learner' | 'parent' | 'admin';
type SupportedTable = 'profiles' | 'content_tags';

type ProfileRow = {
  id: string;
  account_type: AccountType;
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
  contentTags: ContentTagRow[];
  timestamps: number;
  contentTagCounter: number;
};

type QueryExecutionResult = {
  data: unknown;
  error: null;
};

const databaseUuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const contentTagSummarySchema = z.object({
  id: z.string().regex(databaseUuidRegex),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const contentTagEnvelopeSchema = z.object({
  data: contentTagSummarySchema,
});

const contentTagListEnvelopeSchema = z.object({
  data: z.array(contentTagSummarySchema),
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInMemorySupabaseService() {
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const learnerUserId = '33333333-3333-4333-8333-333333333333';

  const usersByToken = new Map<string, InMemoryUser>([
    [
      'token-admin',
      {
        id: adminUserId,
        email: 'adminapp@email.com',
      },
    ],
    [
      'token-learner',
      {
        id: learnerUserId,
        email: 'learner@example.com',
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
        id: learnerUserId,
        account_type: 'learner',
      },
    ],
    contentTags: [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        slug: 'youth-hockey',
        name: 'Youth Hockey',
        description: 'Skating and positional drills.',
        is_active: true,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        slug: 'archived-tag',
        name: 'Archived Tag',
        description: 'Seeded archived tag.',
        is_active: false,
        created_at: '2026-03-01T00:00:01.000Z',
        updated_at: '2026-03-01T00:00:01.000Z',
      },
    ],
    timestamps: 20,
    contentTagCounter: 0,
  };

  const nextTimestamp = () => {
    const timestamp = new Date(
      Date.UTC(2026, 2, 1, 0, 0, state.timestamps),
    ).toISOString();
    state.timestamps += 1;

    return timestamp;
  };

  const nextContentTagId = () => {
    state.contentTagCounter += 1;

    if (state.contentTagCounter === 1) {
      return 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    }

    const suffix = state.contentTagCounter.toString(16).padStart(12, '0');
    return `dddddddd-dddd-dddd-dddd-${suffix}`;
  };

  const getTableRows = (table: SupportedTable): Record<string, unknown>[] => {
    if (table === 'profiles') {
      return state.profiles;
    }

    return state.contentTags;
  };

  class InMemoryQueryBuilder implements PromiseLike<QueryExecutionResult> {
    private readonly filters: Array<(row: Record<string, unknown>) => boolean> =
      [];
    private readonly orderClauses: Array<{
      field: string;
      ascending: boolean;
    }> = [];
    private pendingOperation: 'select' | 'insert' | 'update' = 'select';
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

    eq(field: string, value: unknown) {
      this.filters.push((row) => row[field] === value);
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
      if (this.table !== 'content_tags') {
        throw new Error(
          `Insert is unsupported for table ${this.table} in this test.`,
        );
      }

      const tableRows = getTableRows(this.table) as unknown as ContentTagRow[];

      return this.pendingInsertRows.map((pendingRow) => {
        const timestamp = nextTimestamp();
        const descriptionValue =
          typeof pendingRow.description === 'string'
            ? pendingRow.description
            : '';
        const insertedRow: ContentTagRow = {
          id: nextContentTagId(),
          slug: String(pendingRow.slug),
          name: String(pendingRow.name),
          description: descriptionValue,
          is_active: Boolean(pendingRow.is_active ?? true),
          created_at: timestamp,
          updated_at: timestamp,
        };

        tableRows.push(insertedRow);
        return insertedRow as Record<string, unknown>;
      });
    }

    private executeUpdate(): Record<string, unknown>[] {
      if (this.table !== 'content_tags') {
        throw new Error(
          `Update is unsupported for table ${this.table} in this test.`,
        );
      }

      const tableRows = getTableRows(this.table) as unknown as ContentTagRow[];
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
    state,
    getServiceClient: () => serviceClient,
  };
}

describe('Admin content tag management flow (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const inMemorySupabaseService = createInMemorySupabaseService();

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

  it('allows admin to list, create, update, archive, and unarchive content tags', async () => {
    const seededListResponse = await request(app.getHttpServer())
      .get('/v1/admin/content-tags')
      .set('Authorization', 'Bearer token-admin')
      .expect(200);

    const parsedSeededList = contentTagListEnvelopeSchema.parse(
      seededListResponse.body as unknown,
    );

    expect(parsedSeededList.data).toHaveLength(2);

    const createResponse = await request(app.getHttpServer())
      .post('/v1/admin/content-tags')
      .set('Authorization', 'Bearer token-admin')
      .send({
        name: 'Sick Move',
        description: 'Handle and deke highlights.',
      })
      .expect(201);

    const parsedCreate = contentTagEnvelopeSchema.parse(
      createResponse.body as unknown,
    );
    const createdTagId = parsedCreate.data.id;

    expect(parsedCreate.data.slug).toBe('sick-move');
    expect(parsedCreate.data.isActive).toBe(true);

    const duplicateCreateResponse = await request(app.getHttpServer())
      .post('/v1/admin/content-tags')
      .set('Authorization', 'Bearer token-admin')
      .send({
        name: 'Sick Move',
        description: 'Duplicate-name slug collision coverage.',
      })
      .expect(201);

    const parsedDuplicateCreate = contentTagEnvelopeSchema.parse(
      duplicateCreateResponse.body as unknown,
    );

    expect(parsedDuplicateCreate.data.slug).toBe('sick-move-2');

    const updateResponse = await request(app.getHttpServer())
      .put(`/v1/admin/content-tags/${createdTagId}`)
      .set('Authorization', 'Bearer token-admin')
      .send({
        name: 'Sick Move Elite',
        description: 'Updated tag description.',
      })
      .expect(200);

    const parsedUpdate = contentTagEnvelopeSchema.parse(
      updateResponse.body as unknown,
    );

    expect(parsedUpdate.data.name).toBe('Sick Move Elite');
    expect(parsedUpdate.data.description).toBe('Updated tag description.');
    expect(parsedUpdate.data.slug).toBe('sick-move');

    const archiveResponse = await request(app.getHttpServer())
      .put(`/v1/admin/content-tags/${createdTagId}/archive`)
      .set('Authorization', 'Bearer token-admin')
      .expect(200);

    const parsedArchive = contentTagEnvelopeSchema.parse(
      archiveResponse.body as unknown,
    );

    expect(parsedArchive.data.isActive).toBe(false);

    const unarchiveResponse = await request(app.getHttpServer())
      .put(`/v1/admin/content-tags/${createdTagId}/unarchive`)
      .set('Authorization', 'Bearer token-admin')
      .expect(200);

    const parsedUnarchive = contentTagEnvelopeSchema.parse(
      unarchiveResponse.body as unknown,
    );

    expect(parsedUnarchive.data.isActive).toBe(true);
  });

  it('forbids non-admin users from content-tag management endpoints', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/content-tags')
      .set('Authorization', 'Bearer token-learner')
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/admin/content-tags')
      .set('Authorization', 'Bearer token-learner')
      .send({
        name: 'Unauthorized',
      })
      .expect(403);

    await request(app.getHttpServer())
      .put(
        '/v1/admin/content-tags/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/archive',
      )
      .set('Authorization', 'Bearer token-learner')
      .expect(403);
  });

  it('validates admin content-tag create and update payloads', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/content-tags')
      .set('Authorization', 'Bearer token-admin')
      .send({
        name: 'A',
      })
      .expect(400);

    await request(app.getHttpServer())
      .put('/v1/admin/content-tags/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .set('Authorization', 'Bearer token-admin')
      .send({})
      .expect(400);
  });
});
