import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const signInWithPasswordMock = jest.fn();
  const createUserMock = jest.fn();
  const deleteUserMock = jest.fn();
  const updateUserByIdMock = jest.fn();
  const maybeSingleMock = jest.fn();
  const eqMock = jest.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = jest.fn(() => ({ eq: eqMock }));
  const fromMock = jest.fn();

  const serviceClientMock = {
    auth: {
      signInWithPassword: signInWithPasswordMock,
      admin: {
        createUser: createUserMock,
        deleteUser: deleteUserMock,
        updateUserById: updateUserByIdMock,
      },
    },
    from: fromMock,
  };

  const supabaseServiceMock = {
    getServiceClient: jest.fn(() => serviceClientMock),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    fromMock.mockReturnValue({
      select: selectMock,
    });
    service = new AuthService(supabaseServiceMock as never);
  });

  it('returns a session payload when login credentials are valid', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
        },
        user: {
          id: 'user-123',
          email: 'bodie.tharaldson@gmail.com',
          email_confirmed_at: '2026-02-28T00:00:00.000Z',
        },
      },
      error: null,
    });
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-123',
      },
      error: null,
    });

    const result = await service.login({
      email: 'bodie.tharaldson@gmail.com',
      password: 'testingTest1234',
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'bodie.tharaldson@gmail.com',
      password: 'testingTest1234',
    });
    expect(fromMock).toHaveBeenCalledWith('age_gates');
    expect(selectMock).toHaveBeenCalledWith('user_id');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-123');
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'bearer',
      user: {
        id: 'user-123',
        email: 'bodie.tharaldson@gmail.com',
        emailVerified: true,
        hasCompletedAgeGate: true,
      },
    });
  });

  it('throws unauthorized when login credentials are invalid', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: {
        message: 'Invalid login credentials',
      },
    });

    await expect(
      service.login({
        email: 'bodie.tharaldson@gmail.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
