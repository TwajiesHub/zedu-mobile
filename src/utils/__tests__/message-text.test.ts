jest.mock('react-native-fs');

import { getChatListPreview } from '@/utils/message-text';

describe('getChatListPreview (chats list preview, issue #128)', () => {
  const voiceNote = (created_at = '2026-10-06T12:00:00Z') => ({
    message: '',
    created_at,
    media: [
      {
        id: 'm1',
        file_name: 'voice_1696592400000.m4a',
        file_type: 'm4a',
        mime_type: 'video/mp4', // mobile voice notes carry a video mime
        file_link: 'https://example.com/voice.m4a',
      },
    ],
  });

  const videoMessage = (created_at = '2026-10-06T12:00:00Z') => ({
    message: '',
    created_at,
    media: [
      {
        id: 'v1',
        file_name: 'video_1696592400000.mp4',
        file_type: 'mp4',
        mime_type: 'video/mp4',
        file_link: 'https://example.com/video.mp4',
      },
    ],
  });

  const imageMessage = (created_at = '2026-10-06T12:00:00Z') => ({
    message: '',
    created_at,
    media: [
      {
        id: 'i1',
        file_name: 'photo.png',
        file_type: 'png',
        mime_type: 'image/png',
        file_link: 'https://example.com/photo.png',
      },
    ],
  });

  it('labels a media-only voice note as a voice message', () => {
    expect(
      getChatListPreview({
        preview_message: '<p>🎥 Video</p>',
        preview_thread: [voiceNote()],
      }),
    ).toBe('🎤 Voice message');
  });

  it('keeps the video label for a real video message', () => {
    expect(
      getChatListPreview({
        preview_message: '<p>🎥 Video</p>',
        preview_thread: [videoMessage()],
      }),
    ).toBe('🎥 Video');
  });

  it('keeps the image label for an image message', () => {
    expect(
      getChatListPreview({
        preview_message: '<p>📷 Photo</p>',
        preview_thread: [imageMessage()],
      }),
    ).toBe('📷 Photo');
  });

  it('keeps the server text when the newest message is not the voice note', () => {
    expect(
      getChatListPreview({
        preview_message: '<p>📷 Photo</p>',
        preview_thread: [
          voiceNote('2026-10-05T12:00:00Z'),
          imageMessage('2026-10-06T12:00:00Z'),
        ],
      }),
    ).toBe('📷 Photo');
  });

  it('keeps the server text when the newest message has visible text', () => {
    expect(
      getChatListPreview({
        preview_message: '<p>Hello there</p>',
        preview_thread: [
          voiceNote('2026-10-06T11:59:00Z'),
          { message: '<p>Hello there</p>', created_at: '2026-10-06T12:00:00Z' },
        ],
      }),
    ).toBe('Hello there');
  });

  it('falls back to the server text without a preview thread', () => {
    expect(getChatListPreview({ preview_message: '<p>🎥 Video</p>' })).toBe(
      '🎥 Video',
    );
  });

  it('falls back to empty when there is no preview at all', () => {
    expect(getChatListPreview({})).toBe('');
  });
});
