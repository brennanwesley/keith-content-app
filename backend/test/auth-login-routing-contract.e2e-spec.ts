import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';

type AccountType = 'learner' | 'parent' | 'admin';

type TestUser = {
  id: string;
  email: string;
  password: string;
  accountType: AccountType;
  hasAgeGate: boolean;
};

const loginEnvelopeSchema = z.object({
  data: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number().int(),
    tokenType: z.string(),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      accountType: z.enum(['learner', 'parent', 'admin']),
      emailVerified: z.boolean(),
      hasCompletedAgeGate: z.boolean(),
    }),
  }),
});

function createInMemorySupabaseService() {
  const users: TestUser[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'parent@example.com',
      password: 'ParentPass123',
      accountType: 'parent',
      hasAgeGate: false,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'learner-no-age@example.com',
      password: 'LearnerPass123',
      accountType: 'learner',
      hasAgeGate: false,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'learner-with-age@example.com',
      password: 'LearnerPass123',
      accountType: 'learner',
      hasAgeGate: true,
    },
  ];

  const profileRows = users.map((user) => ({
    id: user.id,
    account_type: user.accountType,
  }));

  const ageGateRows = users
    .filter((user) => user.hasAgeGate)
    .map((user) => ({ user_id: user.id }));

  const serviceClient = {
    auth: {
      signInWithPassword: (credentials: {
        email: string;
        password: string;
      }) => {
        const email = credentials.email.trim().toLowerCase();
        const matchingUser = users.find(
          (user) =>
            user.email === email && user.password === credentials.password,
        );

        if (!matchingUser) {
          return Promise.resolve({
            data: {
              session: null,
              user: null,
            },
            error: {
              message: 'Invalid login credentials',
            },
          });
        }

        return Promise.resolve({
          data: {
            session: {
              access_token: `access-${matchingUser.id}`,
              refresh_token: `refresh-${matchingUser.id}`,
              expires_in: 3600,
              token_type: 'bearer',
            },
            user: {
              id: matchingUser.id,
              email: matchingUser.email,
              email_confirmed_at: '2026-02-28T00:00:00.000Z',
            },
          },
          error: null,
        });
      },
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: (columns: string) => {
            void columns;
            return {
              eq: (field: string, value: string) => {
                return {
                  maybeSingle: () => {
                    if (field !== 'id') {
                      throw new Error(
                        `Unsupported profiles lookup field: ${field}`,
                      );
                    }

                    const profile =
                      profileRows.find((row) => row.id === value) ?? null;

                    return Promise.resolve({
                      data: profile,
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'age_gates') {
        return {
          select: (columns: string) => {
            void columns;
            return {
              eq: (field: string, value: string) => {
                return {
                  maybeSingle: () => {
                    if (field !== 'user_id') {
                      throw new Error(
                        `Unsupported age_gates lookup field: ${field}`,
                      );
                    }

                    const ageGateRecord =
                      ageGateRows.find((row) => row.user_id === value) ?? null;

                    return Promise.resolve({
                      data: ageGateRecord,
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(
        `Unsupported in-memory table for auth login E2E: ${table}`,
      );
    },
  };

  return {
    getServiceClient: () => serviceClient,
  };
}

describe('Auth login routing contract (e2e)', () => {
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

  it('returns accountType and age-gate completion states used for role-aware frontend routing', async () => {
    const parentLoginResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: 'parent@example.com',
        password: 'ParentPass123',
      })
      .expect(201);

    const parsedParentLogin = loginEnvelopeSchema.parse(
      parentLoginResponse.body as unknown,
    );

    expect(parsedParentLogin.data.user.accountType).toBe('parent');
    expect(parsedParentLogin.data.user.hasCompletedAgeGate).toBe(true);

    const learnerWithoutAgeGateResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: 'learner-no-age@example.com',
        password: 'LearnerPass123',
      })
      .expect(201);

    const parsedLearnerWithoutAgeGate = loginEnvelopeSchema.parse(
      learnerWithoutAgeGateResponse.body as unknown,
    );

    expect(parsedLearnerWithoutAgeGate.data.user.accountType).toBe('learner');
    expect(parsedLearnerWithoutAgeGate.data.user.hasCompletedAgeGate).toBe(
      false,
    );

    const learnerWithAgeGateResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: 'learner-with-age@example.com',
        password: 'LearnerPass123',
      })
      .expect(201);

    const parsedLearnerWithAgeGate = loginEnvelopeSchema.parse(
      learnerWithAgeGateResponse.body as unknown,
    );

    expect(parsedLearnerWithAgeGate.data.user.accountType).toBe('learner');
    expect(parsedLearnerWithAgeGate.data.user.hasCompletedAgeGate).toBe(true);
  });
});
