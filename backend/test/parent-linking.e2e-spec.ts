import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';

type AccountType = 'learner' | 'parent' | 'admin';
type RelationshipStatus = 'pending' | 'active' | 'revoked';

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

type SupabaseResponse<T> = Promise<{ data: T; error: null }>;

type InMemoryState = {
  profiles: ProfileRow[];
  parentChildLinks: ParentChildLinkRow[];
  timestamps: number;
  linkCounter: number;
};

type InMemoryUser = {
  id: string;
  email: string;
};

const parentLinkSummarySchema = z.object({
  id: z.string().uuid(),
  parentUserId: z.string().uuid(),
  parentUsername: z.string(),
  childUserId: z.string().uuid(),
  childUsername: z.string(),
  relationshipStatus: z.enum(['pending', 'active', 'revoked']),
  linkedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const parentLinkEnvelopeSchema = z.object({
  data: parentLinkSummarySchema,
});

const myParentLinksEnvelopeSchema = z.object({
  data: z.object({
    userId: z.string().uuid(),
    accountType: z.enum(['learner', 'parent', 'admin']),
    asParent: z.array(parentLinkSummarySchema),
    asChild: z.array(parentLinkSummarySchema),
  }),
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInMemorySupabaseService() {
  const parentUserId = '11111111-1111-4111-8111-111111111111';
  const childUserId = '22222222-2222-4222-8222-222222222222';

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
    ],
    parentChildLinks: [],
    timestamps: 0,
    linkCounter: 0,
  };

  const nextTimestamp = () => {
    const timestamp = new Date(
      Date.UTC(2026, 1, 28, 0, 0, state.timestamps),
    ).toISOString();
    state.timestamps += 1;

    return timestamp;
  };

  const nextLinkId = () => {
    state.linkCounter += 1;

    if (state.linkCounter === 1) {
      return '33333333-3333-4333-8333-333333333333';
    }

    const suffix = String(state.linkCounter).padStart(12, '0');
    return `33333333-3333-4333-8333-${suffix}`;
  };

  const getTableRows = (table: string) => {
    if (table === 'profiles') {
      return state.profiles;
    }

    if (table === 'parent_child_links') {
      return state.parentChildLinks;
    }

    throw new Error(`Unsupported in-memory table in E2E test: ${table}`);
  };

  class QueryBuilder<Row extends Record<string, unknown>> {
    private readonly filters: Array<(row: Row) => boolean> = [];
    private orClauses: Array<(row: Row) => boolean> = [];
    private pendingInsertRows: Row[] | null = null;
    private pendingUpdatePatch: Partial<Row> | null = null;

    constructor(private readonly table: string) {}

    select(columns: string) {
      void columns;
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

    in(field: string, values: unknown[]): SupabaseResponse<Row[]> {
      const rows = this.applyReadFilters().filter((row) =>
        values.includes(row[field]),
      );

      return Promise.resolve({ data: clone(rows), error: null });
    }

    or(expression: string) {
      this.orClauses = expression.split(',').map((clause) => {
        const [fieldName, rawValue] = clause.split('.eq.');

        return (row: Row) => row[fieldName] === rawValue;
      });

      return this;
    }

    order(
      field: string,
      options: { ascending: boolean },
    ): SupabaseResponse<Row[]> {
      const rows = [...this.applyReadFilters()].sort((firstRow, secondRow) => {
        const firstValue = String(firstRow[field]);
        const secondValue = String(secondRow[field]);

        return firstValue.localeCompare(secondValue);
      });

      if (!options.ascending) {
        rows.reverse();
      }

      return Promise.resolve({ data: clone(rows), error: null });
    }

    insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
      const rows = Array.isArray(payload) ? payload : [payload];

      if (this.table !== 'parent_child_links') {
        throw new Error(
          `Insert is unsupported for table ${this.table} in this E2E test.`,
        );
      }

      const insertedRows = rows.map((row) => {
        const timestamp = nextTimestamp();

        const insertedRow: ParentChildLinkRow = {
          id: nextLinkId(),
          parent_user_id: String(row.parent_user_id),
          child_user_id: String(row.child_user_id),
          relationship_status:
            (row.relationship_status as RelationshipStatus) ?? 'pending',
          linked_at: (row.linked_at as string | null | undefined) ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        };

        state.parentChildLinks.push(insertedRow);
        return insertedRow as unknown as Row;
      });

      this.pendingInsertRows = insertedRows;
      return this;
    }

    update(patch: Partial<Row>) {
      this.pendingUpdatePatch = patch;
      return this;
    }

    maybeSingle(): SupabaseResponse<Row | null> {
      const row = this.applyReadFilters()[0] ?? null;
      return Promise.resolve({ data: clone(row), error: null });
    }

    single(): SupabaseResponse<Row> {
      if (this.pendingInsertRows) {
        const insertedRow = this.pendingInsertRows[0];

        return Promise.resolve({ data: clone(insertedRow), error: null });
      }

      if (this.pendingUpdatePatch) {
        const matchingRows = this.applyReadFilters();

        if (!matchingRows[0]) {
          throw new Error(
            'No matching row found for in-memory update operation.',
          );
        }

        for (const row of matchingRows) {
          Object.assign(row, this.pendingUpdatePatch);

          if (this.table === 'parent_child_links') {
            (row as unknown as ParentChildLinkRow).updated_at = nextTimestamp();
          }
        }

        return Promise.resolve({ data: clone(matchingRows[0]), error: null });
      }

      const row = this.applyReadFilters()[0];

      if (!row) {
        throw new Error(
          'No matching row found for in-memory single operation.',
        );
      }

      return Promise.resolve({ data: clone(row), error: null });
    }

    private applyReadFilters(): Row[] {
      const tableRows = getTableRows(this.table) as unknown as Row[];

      return tableRows.filter((row) => {
        const matchesAndFilters = this.filters.every((filter) => filter(row));
        const matchesOrFilters =
          this.orClauses.length === 0 ||
          this.orClauses.some((clause) => clause(row));

        return matchesAndFilters && matchesOrFilters;
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
    from: (table: string) => new QueryBuilder(table),
  };

  return {
    getServiceClient: () => serviceClient,
  };
}

describe('Parent linking flow (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(createInMemorySupabaseService())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows a parent to request a learner link, learner to accept, and both to see active link', async () => {
    const requestResponse = await request(app.getHttpServer())
      .post('/v1/parent/links/request')
      .set('Authorization', 'Bearer token-parent')
      .send({ childUsername: 'learner_account' })
      .expect(201);

    const parsedRequest = parentLinkEnvelopeSchema.parse(
      requestResponse.body as unknown,
    );

    const linkId = parsedRequest.data.id;

    expect(parsedRequest.data).toMatchObject({
      parentUserId: '11111111-1111-4111-8111-111111111111',
      parentUsername: 'parent_guardian',
      childUserId: '22222222-2222-4222-8222-222222222222',
      childUsername: 'learner_account',
      relationshipStatus: 'pending',
      linkedAt: null,
    });

    const acceptResponse = await request(app.getHttpServer())
      .post(`/v1/parent/links/${linkId}/accept`)
      .set('Authorization', 'Bearer token-child')
      .send({})
      .expect(201);

    const parsedAccept = parentLinkEnvelopeSchema.parse(
      acceptResponse.body as unknown,
    );

    expect(parsedAccept.data.relationshipStatus).toBe('active');
    expect(parsedAccept.data.linkedAt).toEqual(expect.any(String));

    const parentLinksResponse = await request(app.getHttpServer())
      .get('/v1/parent/links')
      .set('Authorization', 'Bearer token-parent')
      .expect(200);

    const parsedParentLinks = myParentLinksEnvelopeSchema.parse(
      parentLinksResponse.body as unknown,
    );

    expect(parsedParentLinks.data.accountType).toBe('parent');
    expect(parsedParentLinks.data.asParent).toHaveLength(1);
    expect(parsedParentLinks.data.asParent[0]).toMatchObject({
      id: linkId,
      relationshipStatus: 'active',
      childUsername: 'learner_account',
      parentUsername: 'parent_guardian',
    });

    const childLinksResponse = await request(app.getHttpServer())
      .get('/v1/parent/links')
      .set('Authorization', 'Bearer token-child')
      .expect(200);

    const parsedChildLinks = myParentLinksEnvelopeSchema.parse(
      childLinksResponse.body as unknown,
    );

    expect(parsedChildLinks.data.accountType).toBe('learner');
    expect(parsedChildLinks.data.asChild).toHaveLength(1);
    expect(parsedChildLinks.data.asChild[0]).toMatchObject({
      id: linkId,
      relationshipStatus: 'active',
      childUsername: 'learner_account',
      parentUsername: 'parent_guardian',
    });
  });
});
