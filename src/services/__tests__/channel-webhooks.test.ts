import {
  GetRequest,
  PostRequest,
  PutRequest,
  DeleteRequest,
} from '@/utils/requests';
import * as api from '../channel-webhooks';
import { webhookFixture, historyFixture } from '@/test-fixtures/webhook';
import { canManageChannelWebhooks } from '@/lib/channel-webhook-permissions';

jest.mock('@/utils/requests', () => ({
  GetRequest: jest.fn(),
  PostRequest: jest.fn(),
  PutRequest: jest.fn(),
  DeleteRequest: jest.fn(),
}));
const get = jest.mocked(GetRequest);
const post = jest.mocked(PostRequest);
const put = jest.mocked(PutRequest);
const remove = jest.mocked(DeleteRequest);
beforeEach(() => jest.resetAllMocks());
test('GET reads the webhook data without exposing its URL in errors', async () => {
  get.mockResolvedValue({ data: { data: webhookFixture() }, error: null });
  expect(await api.getChannelWebhook('channel-1')).toEqual(webhookFixture());
  expect(get).toHaveBeenCalledWith('/webhooks/channel-1');
});
test('no webhook is distinct from authentication and server errors', async () => {
  get.mockResolvedValueOnce({
    data: null,
    error: 'Webhook not found',
    status: 404,
  });
  await expect(api.getChannelWebhook('channel-1')).resolves.toBeNull();
  get.mockResolvedValueOnce({ data: null, error: 'Forbidden', status: 403 });
  await expect(api.getChannelWebhook('channel-1')).rejects.toThrow('Forbidden');
  get.mockResolvedValueOnce({
    data: null,
    error: 'Service unavailable',
    status: 503,
  });
  await expect(api.getChannelWebhook('channel-1')).rejects.toThrow(
    'Service unavailable',
  );
});
test('create sends exactly an empty body', async () => {
  post.mockResolvedValue({ data: { data: webhookFixture() }, error: null });
  expect(await api.createChannelWebhook('channel-1')).toEqual(webhookFixture());
  expect(post).toHaveBeenCalledWith('/webhooks/channel-1', {});
});
test('status uses the exact change-status path and webhook_status field', async () => {
  put.mockResolvedValue({
    data: { data: webhookFixture({ status: 'inactive' }) },
    error: null,
  });
  await api.changeChannelWebhookStatus('channel-1', 'hook-1', 'inactive');
  expect(put).toHaveBeenCalledWith('/webhooks/channel-1/hook-1/change-status', {
    webhook_status: 'inactive',
  });
});
test('rename sends required webhook_name and event_name', async () => {
  put.mockResolvedValue({
    data: { data: webhookFixture({ webhook_name: 'New' }) },
    error: null,
  });
  await api.renameChannelWebhook('channel-1', 'hook-1', '  New  ', '');
  expect(put).toHaveBeenCalledWith('/webhooks/channel-1/hook-1', {
    webhook_name: 'New',
    event_name: '',
  });
  await expect(
    api.renameChannelWebhook('channel-1', 'hook-1', '   ', 'event'),
  ).rejects.toThrow('Webhook name is required');
  expect(put).toHaveBeenCalledTimes(1);
});
test('DELETE uses both channel and webhook ids', async () => {
  remove.mockResolvedValue({ data: null, error: null });
  await api.deleteChannelWebhook('channel-1', 'hook-1');
  expect(remove).toHaveBeenCalledWith('/webhooks/channel-1/hook-1');
});
test('successful mutation without a data object confirms state using GET', async () => {
  put.mockResolvedValue({ data: {}, error: null });
  get.mockResolvedValue({
    data: { data: webhookFixture({ status: 'inactive' }) },
    error: null,
  });
  expect(
    (await api.changeChannelWebhookStatus('channel-1', 'hook-1', 'inactive'))
      .status,
  ).toBe('inactive');
  expect(get).toHaveBeenCalledWith('/webhooks/channel-1');
  expect(put).toHaveBeenCalledTimes(1);
});
test('history parses the web envelope and paginated metadata', async () => {
  get.mockResolvedValue({
    data: {
      data: { webhooks_history: [historyFixture()] },
      pagination: { total_pages: 3 },
    },
    error: null,
  });
  expect(await api.getChannelWebhookHistory('channel-1', 'hook-1', 2)).toEqual({
    items: [historyFixture()],
    page: 2,
    hasMore: true,
  });
  expect(get).toHaveBeenCalledWith(
    '/webhooks/channel-1/history/hook-1?page=2&limit=20',
  );
});
test('empty history stops pagination', async () => {
  get.mockResolvedValue({
    data: {
      data: { webhooks_history: [] },
      pagination: [{ total_pages_count: 1 }],
    },
    error: null,
  });
  expect(
    (await api.getChannelWebhookHistory('channel-1', 'hook-1')).hasMore,
  ).toBe(false);
});
test('malformed payloads and mutation errors are not presented as successful or empty', async () => {
  get.mockResolvedValue({ data: { data: {} }, error: null });
  await expect(api.getChannelWebhook('channel-1')).rejects.toThrow(
    'Invalid webhook response',
  );
  await expect(
    api.getChannelWebhookHistory('channel-1', 'hook-1'),
  ).rejects.toThrow('Invalid delivery history response');
  post.mockResolvedValue({ data: null, error: 'No access' });
  await expect(api.createChannelWebhook('channel-1')).rejects.toThrow(
    'No access',
  );
  expect(post).toHaveBeenCalledTimes(1);
});
test('known permissions use create:webhooks; absent role data defers to the backend', () => {
  expect(
    canManageChannelWebhooks({
      user_role: { permission_list: { 'create:webhooks': true } },
    }),
  ).toBe(true);
  expect(
    canManageChannelWebhooks({
      user_role: { permission_list: { 'read:channels': true } },
    }),
  ).toBe(false);
  expect(canManageChannelWebhooks({ user_role: {} })).toBe(false);
  expect(canManageChannelWebhooks(null)).toBe(true);
});

test('partial mutation data cannot discard the URL or name; it is confirmed by GET', async () => {
  put.mockResolvedValue({
    data: { data: { id: 'hook-1', status: 'inactive' } },
    error: null,
  });
  get.mockResolvedValue({
    data: { data: webhookFixture({ status: 'inactive' }) },
    error: null,
  });
  expect(
    await api.changeChannelWebhookStatus('channel-1', 'hook-1', 'inactive'),
  ).toEqual(webhookFixture({ status: 'inactive' }));
  expect(get).toHaveBeenCalledTimes(1);
});
test('a null history collection from an empty backend slice is empty', async () => {
  get.mockResolvedValue({
    data: { data: { webhooks_history: null } },
    error: null,
  });
  await expect(
    api.getChannelWebhookHistory('channel-1', 'hook-1'),
  ).resolves.toEqual({ items: [], page: 1, hasMore: false });
});
