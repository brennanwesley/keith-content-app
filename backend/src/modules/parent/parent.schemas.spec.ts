import { BadRequestException } from '@nestjs/common';
import {
  parseChildUserId,
  parseParentLinkId,
  parseRequestParentLinkInput,
  parseUpdateChildContentRestrictionsInput,
} from './parent.schemas';

describe('parent schemas', () => {
  it('accepts parent-link request payload', () => {
    const parsed = parseRequestParentLinkInput({
      childUsername: 'learner_123',
    });

    expect(parsed).toEqual({ childUsername: 'learner_123' });
  });

  it('rejects parent-link request payload with invalid username', () => {
    expect(() =>
      parseRequestParentLinkInput({
        childUsername: 'bad username',
      }),
    ).toThrow(BadRequestException);
  });

  it('deduplicates blocked content type IDs', () => {
    const parsed = parseUpdateChildContentRestrictionsInput({
      blockedContentTypeIds: [
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      ],
    });

    expect(parsed.blockedContentTypeIds).toEqual([
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ]);
  });

  it('rejects invalid parent-link ID', () => {
    expect(() => parseParentLinkId('invalid-id')).toThrow(BadRequestException);
  });

  it('accepts valid child user ID', () => {
    expect(parseChildUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });
});
