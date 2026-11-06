import { GetRequest, PostRequest, DeleteRequest } from '@/utils/requests';
import {
  SavedMessage,
  SavedMessagesPage,
  SavedTarget,
  savedMessageKey,
} from '@/types/saved-message';

export const SAVED_PAGE_SIZE = 50;

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export function parseSavedMessage(value: unknown): SavedMessage {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid saved message response');
  }
  const item = value as Record<string, unknown>;
  if (!text(item.id) || !['thread', 'message'].includes(text(item.type))) {
    throw new Error('Invalid saved message response');
  }
  return {
    id: text(item.id),
    thread_id: text(item.thread_id),
    message_id: text(item.message_id) || undefined,
    channel_id: text(item.channel_id),
    channel_type: text(item.channel_type),
    channel_name: text(item.channel_name),
    avatar_url: text(item.avatar_url),
    username: text(item.username),
    content: text(item.content),
    user_id: text(item.user_id),
    type: item.type as SavedMessage['type'],
    saved_at: text(item.saved_at),
    created_at: text(item.created_at),
  };
}

export async function fetchSavedMessages(
  orgId: string,
  page = 1,
): Promise<SavedMessagesPage> {
  if (!orgId || page < 1) throw new Error('Select a workspace first');
  const { data, error, status } = await GetRequest(
    `/organisations/${encodeURIComponent(
      orgId,
    )}/saved/message?page=${page}&limit=${SAVED_PAGE_SIZE}`,
  );
  if (status === 404 && error?.trim().toLowerCase() === 'messages not found') {
    return { items: [], page, hasMore: false };
  }
  if (error) throw new Error(error);
  if (!Array.isArray(data?.data)) {
    throw new Error('Invalid saved messages response');
  }
  const items = data.data.map(parseSavedMessage);
  const pagination = Array.isArray(data.pagination)
    ? data.pagination[0]
    : data.pagination;
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
        : items.length >= SAVED_PAGE_SIZE),
  };
}

/** Read every page before deciding whether a toggle would save or unsave. */
export async function fetchSavedLookup(orgId: string): Promise<SavedMessage[]> {
  const records = new Map<string, SavedMessage>();
  for (let page = 1; ; page += 1) {
    const result = await fetchSavedMessages(orgId, page);
    const size = records.size;
    result.items.forEach(item => records.set(savedMessageKey(item), item));
    if (!result.hasMore) return [...records.values()];
    if (size === records.size) {
      throw new Error('Saved messages did not advance. Please refresh.');
    }
  }
}

/** Call once; this POST is a server toggle, not an idempotent save. */
export async function saveMessage(orgId: string, target: SavedTarget) {
  const root = `/organisations/${encodeURIComponent(orgId)}`;
  const payload = {
    channels_id: target.channel_id,
    thread_id: target.thread_id,
  };
  const { data, error } = await PostRequest(
    `${root}/${target.type === 'thread' ? 'thread' : 'message'}/save`,
    target.type === 'thread'
      ? payload
      : { ...payload, message_id: target.message_id },
  );
  if (error) throw new Error(error);
  return typeof data?.data?.id === 'string' ? data.data.id : null;
}

export async function deleteSavedMessage(orgId: string, savedId: string) {
  const { error } = await DeleteRequest(
    `/organisations/${encodeURIComponent(
      orgId,
    )}/saved/message/${encodeURIComponent(savedId)}`,
  );
  if (error) throw new Error(error);
}
