import { ChannelWebhook, WebhookHistoryItem } from '@/types/webhook';
export const webhookFixture = (
  overrides: Partial<ChannelWebhook> = {},
): ChannelWebhook => ({
  id: 'hook-1',
  event_name: 'message.created',
  webhook_name: 'Updates',
  status: 'active',
  owner_id: 'owner-1',
  webhook_url: 'https://example.invalid/webhooks/demo',
  webhook_slug: 'demo',
  channel_id: 'channel-1',
  created_at: '2026-11-07T10:00:00Z',
  updated_at: '2026-11-07T10:00:00Z',
  ...overrides,
});
export const historyFixture = (
  overrides: Partial<WebhookHistoryItem> = {},
): WebhookHistoryItem => ({
  id: 'delivery-1',
  webhook_id: 'hook-1',
  callback_id: 'callback-1',
  status_code: 200,
  action_type: 'message.created',
  retries: 0,
  attempted: '2026-11-07T10:00:00Z',
  ...overrides,
});
