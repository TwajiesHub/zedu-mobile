export type WebhookStatus = 'active' | 'inactive';

export type ChannelWebhook = {
  id: string;
  event_name: string;
  webhook_name: string;
  status: WebhookStatus;
  owner_id: string;
  webhook_url: string;
  webhook_slug: string;
  channel_id: string;
  created_at: string;
  updated_at: string;
};

export type WebhookHistoryItem = {
  id: string;
  webhook_id: string;
  callback_id: string;
  status_code: string | number;
  action_type: string;
  retries: string | number;
  attempted: string;
};

export type WebhookHistoryPage = {
  items: WebhookHistoryItem[];
  page: number;
  hasMore: boolean;
};
