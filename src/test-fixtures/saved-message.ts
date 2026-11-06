import { SavedMessage } from '@/types/saved-message';
export const savedFixture = (
  overrides: Partial<SavedMessage> = {},
): SavedMessage => ({
  id: 'saved-1',
  thread_id: 'thread-1',
  channel_id: 'channel-1',
  channel_type: 'public',
  channel_name: 'general',
  avatar_url: '',
  username: 'Ada',
  content: '<p>Hello &amp; welcome</p>',
  user_id: 'user-1',
  type: 'thread',
  saved_at: '2026-11-06T12:00:00Z',
  created_at: '2026-11-06T11:00:00Z',
  ...overrides,
});
