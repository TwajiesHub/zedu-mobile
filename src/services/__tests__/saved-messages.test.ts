import { GetRequest, PostRequest, DeleteRequest } from '@/utils/requests';
import {
  fetchSavedMessages,
  fetchSavedLookup,
  saveMessage,
  deleteSavedMessage,
} from '../saved-messages';
import { savedFixture } from '@/test-fixtures/saved-message';

jest.mock('@/utils/requests', () => ({
  GetRequest: jest.fn(),
  PostRequest: jest.fn(),
  DeleteRequest: jest.fn(),
}));
const get = jest.mocked(GetRequest);
const post = jest.mocked(PostRequest);
const remove = jest.mocked(DeleteRequest);
beforeEach(() => jest.resetAllMocks());

test('loads the requested saved page and pagination', async () => {
  get.mockResolvedValue({
    data: {
      data: [savedFixture()],
      pagination: [{ current_page: 2, total_pages: 3, page_size: 50 }],
    },
    error: null,
  });
  const result = await fetchSavedMessages('org-1', 2);
  expect(get).toHaveBeenCalledWith(
    '/organisations/org-1/saved/message?page=2&limit=50',
  );
  expect(result).toMatchObject({
    page: 2,
    hasMore: true,
    items: [savedFixture()],
  });
});
test('only 404 Messages not found is empty', async () => {
  get.mockResolvedValueOnce({
    data: null,
    error: 'Messages not found',
    status: 404,
  });
  await expect(fetchSavedMessages('org-1')).resolves.toEqual({
    items: [],
    page: 1,
    hasMore: false,
  });
  get.mockResolvedValueOnce({
    data: null,
    error: 'Messages not found',
    status: 403,
  });
  await expect(fetchSavedMessages('org-1')).rejects.toThrow(
    'Messages not found',
  );
  get.mockResolvedValueOnce({
    data: null,
    error: 'Organisation not found',
    status: 404,
  });
  await expect(fetchSavedMessages('org-1')).rejects.toThrow(
    'Organisation not found',
  );
});
test('rejects malformed payloads instead of showing an empty list', async () => {
  get.mockResolvedValue({ data: { data: {} }, error: null });
  await expect(fetchSavedMessages('org-1')).rejects.toThrow(
    'Invalid saved messages response',
  );
});
test('hydrates the complete lookup, not only the first saved page', async () => {
  get.mockResolvedValueOnce({
    data: { data: [savedFixture()], pagination: { total_pages_count: 2 } },
    error: null,
  });
  get.mockResolvedValueOnce({
    data: {
      data: [
        savedFixture({ id: 'saved-2', type: 'message', message_id: 'reply-2' }),
      ],
      pagination: { total_pages_count: 2 },
    },
    error: null,
  });
  expect(await fetchSavedLookup('org-1')).toHaveLength(2);
  expect(get).toHaveBeenLastCalledWith(
    '/organisations/org-1/saved/message?page=2&limit=50',
  );
});
test('rejects a repeating page rather than retrying indefinitely', async () => {
  get.mockResolvedValue({
    data: { data: [savedFixture()], pagination: { total_pages_count: 10 } },
    error: null,
  });
  await expect(fetchSavedLookup('org-1')).rejects.toThrow('did not advance');
  expect(get).toHaveBeenCalledTimes(2);
});
test('root save uses thread/save without the reply or legacy type fields', async () => {
  post.mockResolvedValue({ data: { data: { id: 'saved-1' } }, error: null });
  expect(await saveMessage('org-1', savedFixture())).toBe('saved-1');
  expect(post).toHaveBeenCalledWith('/organisations/org-1/thread/save', {
    channels_id: 'channel-1',
    thread_id: 'thread-1',
  });
});
test('reply save keeps its own message id and the parent thread id', async () => {
  post.mockResolvedValue({ data: {}, error: null });
  await saveMessage(
    'org-1',
    savedFixture({ type: 'message', message_id: 'reply-2' }),
  );
  expect(post).toHaveBeenCalledWith('/organisations/org-1/message/save', {
    channels_id: 'channel-1',
    thread_id: 'thread-1',
    message_id: 'reply-2',
  });
});
test('removes by saved record id, never by message or thread id', async () => {
  remove.mockResolvedValue({ data: null, error: null });
  await deleteSavedMessage('org-1', 'saved-1');
  expect(remove).toHaveBeenCalledWith(
    '/organisations/org-1/saved/message/saved-1',
  );
});
test('a failed toggle sends only one POST', async () => {
  post.mockResolvedValue({ data: null, error: 'Timeout' });
  await expect(saveMessage('org-1', savedFixture())).rejects.toThrow('Timeout');
  expect(post).toHaveBeenCalledTimes(1);
});
