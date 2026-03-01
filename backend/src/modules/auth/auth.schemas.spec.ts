import { BadRequestException } from '@nestjs/common';
import {
  parseChangeEmailInput,
  parseLoginInput,
  parseSignupInput,
} from './auth.schemas';

describe('auth payload schemas', () => {
  it('accepts a valid signup payload', () => {
    const parsed = parseSignupInput({
      email: 'USER@Example.com',
      username: 'learner_123',
      password: 'SecurePass10',
    });

    expect(parsed).toEqual({
      email: 'user@example.com',
      username: 'learner_123',
      password: 'SecurePass10',
      accountType: 'learner',
    });
  });

  it('accepts a parent signup payload', () => {
    const parsed = parseSignupInput({
      email: 'parent@example.com',
      username: 'parent_user',
      password: 'SecurePass10',
      accountType: 'parent',
    });

    expect(parsed.accountType).toBe('parent');
  });

  it('rejects signup payload when password does not meet complexity', () => {
    expect(() =>
      parseSignupInput({
        email: 'user@example.com',
        username: 'learner_123',
        password: 'weakpass',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects signup payload when username is missing', () => {
    expect(() =>
      parseSignupInput({
        email: 'user@example.com',
        password: 'SecurePass10',
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts a valid login payload', () => {
    const parsed = parseLoginInput({
      email: 'LOGIN@Example.com',
      password: 'SomePassword',
    });

    expect(parsed).toEqual({
      email: 'login@example.com',
      password: 'SomePassword',
    });
  });

  it('rejects login payload when password is empty', () => {
    expect(() =>
      parseLoginInput({
        email: 'login@example.com',
        password: '',
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts a valid change-email payload', () => {
    const parsed = parseChangeEmailInput({
      newEmail: 'NEW@Example.com',
      password: 'SecurePass10',
    });

    expect(parsed).toEqual({
      newEmail: 'new@example.com',
      password: 'SecurePass10',
    });
  });

  it('rejects change-email payload when new email is missing', () => {
    expect(() =>
      parseChangeEmailInput({
        password: 'SecurePass10',
      }),
    ).toThrow(BadRequestException);
  });
});
