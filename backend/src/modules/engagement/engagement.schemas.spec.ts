import { BadRequestException } from '@nestjs/common';
import { parseTrackWatchEventInput } from './engagement.schemas';

describe('engagement schemas', () => {
  it('accepts valid watch-event payload', () => {
    const parsed = parseTrackWatchEventInput({
      videoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      eventType: 'play',
      positionSeconds: 5,
    });

    expect(parsed).toEqual({
      videoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      eventType: 'play',
      positionSeconds: 5,
    });
  });

  it('rejects watch-event payload with invalid video ID', () => {
    expect(() =>
      parseTrackWatchEventInput({
        videoId: 'invalid',
        eventType: 'play',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects watch-event payload with negative position', () => {
    expect(() =>
      parseTrackWatchEventInput({
        videoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        eventType: 'pause',
        positionSeconds: -1,
      }),
    ).toThrow(BadRequestException);
  });
});
