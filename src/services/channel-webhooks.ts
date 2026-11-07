import {
  DeleteRequest,
  GetRequest,
  PostRequest,
  PutRequest,
} from '@/utils/requests';
import {
  ChannelWebhook,
  WebhookHistoryItem,
  WebhookHistoryPage,
  WebhookStatus,
} from '@/types/webhook';

export const WEBHOOK_HISTORY_PAGE_SIZE = 20;
const channelPath = (channelId: string) =>
  `/webhooks/${encodeURIComponent(channelId)}`;
const webhookPath = (channelId: string, webhookId: string) =>
  `${channelPath(channelId)}/${encodeURIComponent(webhookId)}`;

function parseWebhook(value: unknown): ChannelWebhook {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid webhook response');
  const data = value as Partial<ChannelWebhook>;
  if (!data.id || !['active', 'inactive'].includes(data.status || ''))
    throw new Error('Invalid webhook response');
  return {
    id: data.id,
    event_name: data.event_name || '',
    webhook_name: data.webhook_name || '',
    status: data.status as WebhookStatus,
    owner_id: data.owner_id || '',
    webhook_url: data.webhook_url || '',
    webhook_slug: data.webhook_slug || '',
    channel_id: data.channel_id || '',
    created_at: data.created_at || '',
    updated_at: data.updated_at || '',
  };
}

export async function getChannelWebhook(
  channelId: string,
): Promise<ChannelWebhook | null> {
  const { data, error, status } = await GetRequest(channelPath(channelId));
  if (
    status === 404 ||
    (status === 400 &&
      /webhook.*(?:not found|does not exist)/i.test(error || ''))
  )
    return null;
  if (error) throw new Error(error);
  return data?.data == null ? null : parseWebhook(data.data);
}

async function updatedWebhook(
  channelId: string,
  data: unknown,
): Promise<ChannelWebhook> {
  if (
    data &&
    typeof data === 'object' &&
    typeof (data as ChannelWebhook).webhook_url === 'string' &&
    typeof (data as ChannelWebhook).webhook_name === 'string' &&
    typeof (data as ChannelWebhook).channel_id === 'string'
  )
    return parseWebhook(data);
  // Some successful mutations return only a message. Confirm with a safe GET.
  const webhook = await getChannelWebhook(channelId);
  if (!webhook) throw new Error('Webhook unavailable. Refresh and try again.');
  return webhook;
}

export async function createChannelWebhook(
  channelId: string,
): Promise<ChannelWebhook> {
  const { data, error } = await PostRequest(channelPath(channelId), {});
  if (error) throw new Error(error);
  return updatedWebhook(channelId, data?.data);
}

export async function changeChannelWebhookStatus(
  channelId: string,
  webhookId: string,
  webhookStatus: WebhookStatus,
): Promise<ChannelWebhook> {
  const { data, error } = await PutRequest(
    `${webhookPath(channelId, webhookId)}/change-status`,
    { webhook_status: webhookStatus },
  );
  if (error) throw new Error(error);
  return updatedWebhook(channelId, data?.data);
}

export async function renameChannelWebhook(
  channelId: string,
  webhookId: string,
  webhookName: string,
  eventName: string,
): Promise<ChannelWebhook> {
  const name = webhookName.trim();
  if (!name) throw new Error('Webhook name is required');
  const { data, error } = await PutRequest(webhookPath(channelId, webhookId), {
    webhook_name: name,
    event_name: eventName,
  });
  if (error) throw new Error(error);
  return updatedWebhook(channelId, data?.data);
}

export async function deleteChannelWebhook(
  channelId: string,
  webhookId: string,
): Promise<void> {
  const { error } = await DeleteRequest(webhookPath(channelId, webhookId));
  if (error) throw new Error(error);
}

export async function getChannelWebhookHistory(
  channelId: string,
  webhookId: string,
  page = 1,
): Promise<WebhookHistoryPage> {
  const { data, error } = await GetRequest(
    `${channelPath(channelId)}/history/${encodeURIComponent(
      webhookId,
    )}?page=${page}&limit=${WEBHOOK_HISTORY_PAGE_SIZE}`,
  );
  if (error) throw new Error(error);
  const payload = data?.data;
  const rows =
    payload == null
      ? []
      : Array.isArray(payload)
      ? payload
      : typeof payload === 'object' && 'webhooks_history' in payload
      ? payload.webhooks_history ?? []
      : undefined;
  if (!Array.isArray(rows))
    throw new Error('Invalid delivery history response');
  const items: WebhookHistoryItem[] = rows.map((value: unknown) => {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof (value as WebhookHistoryItem).id !== 'string'
    )
      throw new Error('Invalid delivery history item');
    const item = value as WebhookHistoryItem;
    return {
      id: item.id,
      webhook_id: item.webhook_id || '',
      callback_id: item.callback_id || '',
      status_code: item.status_code ?? '',
      action_type: item.action_type || '',
      retries: item.retries ?? 0,
      attempted: item.attempted || '',
    };
  });
  const rawPagination = data.pagination ?? data.data?.pagination;
  const pagination = Array.isArray(rawPagination)
    ? rawPagination[0]
    : rawPagination;
  const totalPages = Number(
    pagination?.total_pages ?? pagination?.total_pages_count,
  );
  return {
    items,
    page,
    hasMore:
      items.length > 0 &&
      (Number.isFinite(totalPages) && totalPages > 0
        ? page < totalPages
        : items.length >= WEBHOOK_HISTORY_PAGE_SIZE),
  };
}
