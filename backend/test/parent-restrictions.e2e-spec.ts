import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';

type AccountType = 'learner' | 'parent' | 'admin';
type RelationshipStatus = 'pending' | 'active' | 'revoked';
type SupportedTable =
  | 'profiles'
  | 'parent_child_links'
  | 'content_types'
  | 'user_content_preferences'
  | 'parent_content_restrictions';

type ProfileRow = {
  id: string;
  username: string;
  account_type: AccountType;
  email: string;
};

type ParentChildLinkRow = {
  id: string;
  parent_user_id: string;
  child_user_id: string;
  relationship_status: RelationshipStatus;
  linked_at: string | null;
  created_at: string;
  updated_at: string;
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

type UserContentPreferenceRow = {
  user_id: string;
  content_type_id: string;
  created_at: string;
};

type ParentContentRestrictionRow = {
  parent_user_id: string;
  child_user_id: string;
  content_type_id: string;
  created_at: string;
  updated_at: string;
};

type InMemoryUser = {
  id: string;
  email: string;
};

type InMemoryState = {
  profiles: ProfileRow[];
  parentChildLinks: ParentChildLinkRow[];
  contentTypes: ContentTypeRow[];
  userContentPreferences: UserContentPreferenceRow[];
  parentContentRestrictions: ParentContentRestrictionRow[];
  timestamps: number;
};

type QueryExecutionResult = {
  data: unknown;
  error: null;
};

const contentTypeIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const contentTypeSummarySchema = z.object({
  id: contentTypeIdSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  iconKey: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

const effectivePreferencesEnvelopeSchema = z.object({
  data: z.object({
    userId: z.string().uuid(),
    selectedContentTypeIds: z.array(contentTypeIdSchema),
    selectedContentTypes: z.array(contentTypeSummarySchema),
    blockedContentTypeIds: z.array(contentTypeIdSchema),
    blockedContentTypes: z.array(contentTypeSummarySchema),
    effectiveContentTypeIds: z.array(contentTypeIdSchema),
    effectiveContentTypes: z.array(contentTypeSummarySchema),
    isParentRestricted: z.boolean(),
  }),
});

const childRestrictionsEnvelopeSchema = z.object({
  data: z.object({
    parentUserId: z.string().uuid(),
    childUserId: z.string().uuid(),
    childUsername: z.string(),
    blockedContentTypeIds: z.array(contentTypeIdSchema),
    blockedContentTypes: z.array(contentTypeSummarySchema),
    effectiveContentPreferences: effectivePreferencesEnvelopeSchema.shape.data,
  }),
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInMemorySupabaseService() {
  const parentUserId = '11111111-1111-4111-8111-111111111111';
  const childUserId = '22222222-2222-4222-8222-222222222222';
  const outsiderParentUserId = '44444444-4444-4444-8444-444444444444';
  const blockedContentTypeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const allowedContentTypeId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  const usersByToken = new Map<string, InMemoryUser>([
    [
      'token-parent',
      {
        id: parentUserId,
        email: 'parent@example.com',
      },
    ],
    [
      'token-child',
      {
        id: childUserId,
        email: 'learner@example.com',
      },
    ],
    [
      'token-outsider-parent',
      {
        id: outsiderParentUserId,
        email: 'outsider-parent@example.com',
      },
    ],
  ]);

  const state: InMemoryState = {
    profiles: [
      {
        id: parentUserId,
        username: 'parent_guardian',
        account_type: 'parent',
        email: 'parent@example.com',
      },
      {
        id: childUserId,
        username: 'learner_account',
        account_type: 'learner',
        email: 'learner@example.com',
      },
      {
        id: outsiderParentUserId,
        username: 'outsider_parent',
        account_type: 'parent',
        email: 'outsider-parent@example.com',
      },
    ],
    parentChildLinks: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        parent_user_id: parentUserId,
        child_user_id: childUserId,
        relationship_status: 'active',
        linked_at: '2026-02-28T00:00:00.000Z',
        created_at: '2026-02-28T00:00:00.000Z',
        updated_at: '2026-02-28T00:00:00.000Z',
      },
    ],
    contentTypes: [
      {
        id: blockedContentTypeId,
        slug: 'youth-hockey',
        name: 'Youth Hockey',
        description: 'Fast skates, team drills, and game clips.',
        icon_key: 'hockey',
        sort_order: 1,
        is_active: true,
      },
      {
        id: allowedContentTypeId,
        slug: 'youth-baseball',
        name: 'Youth Baseball',
        description: 'Swing mechanics and infield training clips.',
        icon_key: 'baseball',
        sort_order: 2,
        is_active: true,
      },
    ],
    userContentPreferences: [
      {
        user_id: childUserId,
        content_type_id: blockedContentTypeId,
        created_at: '2026-02-28T00:00:01.000Z',
      },
      {
        user_id: childUserId,
        content_type_id: allowedContentTypeId,
        created_at: '2026-02-28T00:00:02.000Z',
      },
    ],
    parentContentRestrictions: [],
    timestamps: 10,
  };

  const nextTimestamp = () => {
    const timestamp = new Date(
      Date.UTC(2026, 1, 28, 0, 0, state.timestamps),
    ).toISOString();
    state.timestamps += 1;

    return timestamp;
  };

  const getTableRows = (table: SupportedTable): Record<string, unknown>[] => {
    if (table === 'profiles') {
      return state.profiles;
    }

    if (table === 'parent_child_links') {
      return state.parentChildLinks;
    }

    if (table === 'content_types') {
      return state.contentTypes;
    }

    if (table === 'user_content_preferences') {
      return state.userContentPreferences;
    }

    return state.parentContentRestrictions;
  };

  class InMemoryQueryBuilder implements PromiseLike<QueryExecutionResult> {
    private readonly filters: Array<(row: Record<string, unknown>) => boolean> =
      [];
    private readonly orderClauses: Array<{
      field: string;
      ascending: boolean;
    }> = [];
    private pendingOperation: 'select' | 'insert' | 'delete' = 'select';
    private pendingInsertRows: Record<string, unknown>[] = [];
    private resultMode: 'many' | 'single' | 'maybeSingle' = 'many';

    constructor(private readonly table: SupportedTable) {}

    select(columns: string) {
      void columns;
      this.pendingOperation = 'select';
      return this;
    }

    delete() {
      this.pendingOperation = 'delete';
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

    ilike(field: string, value: string) {
      const normalizedValue = value.toLowerCase();
      this.filters.push(
        (row) => String(row[field]).toLowerCase() === normalizedValue,
      );
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
        return Promise.resolve({
          data: clone(this.executeInsert()),
          error: null,
        });
      }

      if (this.pendingOperation === 'delete') {
        return Promise.resolve({
          data: clone(this.executeDelete()),
          error: null,
        });
      }

      const rows = this.applyReadFilters();

      if (this.resultMode === 'maybeSingle') {
        return Promise.resolve({ data: clone(rows[0] ?? null), error: null });
      }

      if (this.resultMode === 'single') {
        if (!rows[0]) {
          throw new Error('No matching row found for in-memory single query.');
        }

        return Promise.resolve({ data: clone(rows[0]), error: null });
      }

      return Promise.resolve({ data: clone(rows), error: null });
    }

    private executeInsert(): Record<string, unknown>[] {
      if (this.table === 'parent_content_restrictions') {
        const tableRows = getTableRows(
          this.table,
        ) as ParentContentRestrictionRow[];

        const insertedRows = this.pendingInsertRows.map((pendingRow) => {
          const timestamp = nextTimestamp();
          const insertedRow: ParentContentRestrictionRow = {
            parent_user_id: String(pendingRow.parent_user_id),
            child_user_id: String(pendingRow.child_user_id),
            content_type_id: String(pendingRow.content_type_id),
            created_at: timestamp,
            updated_at: timestamp,
          };

          const duplicateIndex = tableRows.findIndex(
            (existingRow) =>
              existingRow.parent_user_id === insertedRow.parent_user_id &&
              existingRow.child_user_id === insertedRow.child_user_id &&
              existingRow.content_type_id === insertedRow.content_type_id,
          );

          if (duplicateIndex >= 0) {
            tableRows.splice(duplicateIndex, 1, insertedRow);
          } else {
            tableRows.push(insertedRow);
          }

          return insertedRow as Record<string, unknown>;
        });

        return insertedRows;
      }

      if (this.table === 'user_content_preferences') {
        const tableRows = getTableRows(
          this.table,
        ) as UserContentPreferenceRow[];

        const insertedRows = this.pendingInsertRows.map((pendingRow) => {
          const insertedRow: UserContentPreferenceRow = {
            user_id: String(pendingRow.user_id),
            content_type_id: String(pendingRow.content_type_id),
            created_at: nextTimestamp(),
          };

          tableRows.push(insertedRow);
          return insertedRow as Record<string, unknown>;
        });

        return insertedRows;
      }

      if (this.table === 'parent_child_links') {
        const tableRows = getTableRows(this.table) as ParentChildLinkRow[];

        const insertedRows = this.pendingInsertRows.map((pendingRow) => {
          const timestamp = nextTimestamp();
          const insertedRow: ParentChildLinkRow = {
            id: String(pendingRow.id),
            parent_user_id: String(pendingRow.parent_user_id),
            child_user_id: String(pendingRow.child_user_id),
            relationship_status:
              (pendingRow.relationship_status as RelationshipStatus) ??
              'pending',
            linked_at:
              (pendingRow.linked_at as string | null | undefined) ?? null,
            created_at: timestamp,
            updated_at: timestamp,
          };

          tableRows.push(insertedRow);
          return insertedRow as Record<string, unknown>;
        });

        return insertedRows;
      }

      throw new Error(
        `Insert is unsupported for table ${this.table} in this E2E test.`,
      );
    }

    private executeDelete(): Record<string, unknown>[] {
      if (
        this.table !== 'parent_content_restrictions' &&
        this.table !== 'user_content_preferences'
      ) {
        throw new Error(
          `Delete is unsupported for table ${this.table} in this E2E test.`,
        );
      }

      const tableRows = getTableRows(this.table);
      const remainingRows: Record<string, unknown>[] = [];
      const deletedRows: Record<string, unknown>[] = [];

      for (const row of tableRows) {
        const matchesFilters = this.filters.every((filter) => filter(row));

        if (matchesFilters) {
          deletedRows.push(row);
        } else {
          remainingRows.push(row);
        }
      }

      if (this.table === 'parent_content_restrictions') {
        state.parentContentRestrictions =
          remainingRows as ParentContentRestrictionRow[];
      } else {
        state.userContentPreferences =
          remainingRows as UserContentPreferenceRow[];
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
    parentUserId,
    childUserId,
    outsiderParentUserId,
    blockedContentTypeId,
    allowedContentTypeId,
    getServiceClient: () => serviceClient,
  };
}

describe('Parent restriction override flow (e2e)', () => {
  let app: INestApplication<App>;
  let parentUserId: string;
  let childUserId: string;
  let outsiderParentUserId: string;
  let blockedContentTypeId: string;
  let allowedContentTypeId: string;

  beforeEach(async () => {
    const inMemorySupabaseService = createInMemorySupabaseService();
    parentUserId = inMemorySupabaseService.parentUserId;
    childUserId = inMemorySupabaseService.childUserId;
    outsiderParentUserId = inMemorySupabaseService.outsiderParentUserId;
    blockedContentTypeId = inMemorySupabaseService.blockedContentTypeId;
    allowedContentTypeId = inMemorySupabaseService.allowedContentTypeId;

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

  it('applies parent blocked content types over learner selected preferences in effective feed preferences', async () => {
    const updateRestrictionsResponse = await request(app.getHttpServer())
      .put(`/v1/parent/children/${childUserId}/content-restrictions`)
      .set('Authorization', 'Bearer token-parent')
      .send({ blockedContentTypeIds: [blockedContentTypeId] })
      .expect(200);

    const parsedUpdateRestrictions = childRestrictionsEnvelopeSchema.parse(
      updateRestrictionsResponse.body as unknown,
    );

    expect(parsedUpdateRestrictions.data.parentUserId).toBe(parentUserId);
    expect(parsedUpdateRestrictions.data.childUserId).toBe(childUserId);
    expect(parsedUpdateRestrictions.data.blockedContentTypeIds).toEqual([
      blockedContentTypeId,
    ]);
    expect(
      parsedUpdateRestrictions.data.effectiveContentPreferences
        .selectedContentTypeIds,
    ).toEqual([blockedContentTypeId, allowedContentTypeId]);
    expect(
      parsedUpdateRestrictions.data.effectiveContentPreferences
        .effectiveContentTypeIds,
    ).toEqual([allowedContentTypeId]);
    expect(
      parsedUpdateRestrictions.data.effectiveContentPreferences
        .isParentRestricted,
    ).toBe(true);

    const effectivePreferencesResponse = await request(app.getHttpServer())
      .get('/v1/me/effective-content-preferences')
      .set('Authorization', 'Bearer token-child')
      .expect(200);

    const parsedEffectivePreferences = effectivePreferencesEnvelopeSchema.parse(
      effectivePreferencesResponse.body as unknown,
    );

    expect(parsedEffectivePreferences.data.userId).toBe(childUserId);
    expect(parsedEffectivePreferences.data.selectedContentTypeIds).toEqual([
      blockedContentTypeId,
      allowedContentTypeId,
    ]);
    expect(parsedEffectivePreferences.data.blockedContentTypeIds).toEqual([
      blockedContentTypeId,
    ]);
    expect(parsedEffectivePreferences.data.effectiveContentTypeIds).toEqual([
      allowedContentTypeId,
    ]);
    expect(parsedEffectivePreferences.data.isParentRestricted).toBe(true);
  });

  it('forbids an unlinked parent from viewing or updating a learner restriction scope', async () => {
    await request(app.getHttpServer())
      .get(`/v1/parent/children/${childUserId}/content-restrictions`)
      .set('Authorization', 'Bearer token-outsider-parent')
      .expect(403);

    await request(app.getHttpServer())
      .put(`/v1/parent/children/${childUserId}/content-restrictions`)
      .set('Authorization', 'Bearer token-outsider-parent')
      .send({ blockedContentTypeIds: [blockedContentTypeId] })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/v1/parent/children/${outsiderParentUserId}/content-restrictions`)
      .set('Authorization', 'Bearer token-parent')
      .expect(403);
  });

  it('forbids learners from using parent-only child restriction endpoints', async () => {
    await request(app.getHttpServer())
      .get(`/v1/parent/children/${childUserId}/content-restrictions`)
      .set('Authorization', 'Bearer token-child')
      .expect(403);

    await request(app.getHttpServer())
      .put(`/v1/parent/children/${childUserId}/content-restrictions`)
      .set('Authorization', 'Bearer token-child')
      .send({ blockedContentTypeIds: [blockedContentTypeId] })
      .expect(403);
  });
});
