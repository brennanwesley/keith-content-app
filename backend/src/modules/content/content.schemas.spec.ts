import { BadRequestException } from '@nestjs/common';
import { parseUpdateMyContentPreferencesInput } from './content.schemas';

describe('content.schemas', () => {
  it('deduplicates valid content type IDs', () => {
    const firstId = '11111111-1111-4111-8111-111111111111';
    const secondId = '22222222-2222-4222-8222-222222222222';

    const parsed = parseUpdateMyContentPreferencesInput({
      contentTypeIds: [firstId, secondId, firstId],
    });

    expect(parsed.contentTypeIds).toEqual([firstId, secondId]);
  });

  it('accepts canonical Postgres UUID values outside strict RFC variant checks', () => {
    const postgresStyleUuid = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    const parsed = parseUpdateMyContentPreferencesInput({
      contentTypeIds: [postgresStyleUuid],
    });

    expect(parsed.contentTypeIds).toEqual([postgresStyleUuid]);
  });

  it('defaults to empty contentTypeIds when payload omits it', () => {
    const parsed = parseUpdateMyContentPreferencesInput({});

    expect(parsed).toEqual({ contentTypeIds: [] });
  });

  it('throws bad request for invalid content type IDs', () => {
    expect(() =>
      parseUpdateMyContentPreferencesInput({
        contentTypeIds: ['not-a-uuid'],
      }),
    ).toThrow(BadRequestException);
  });
});
