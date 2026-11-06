export type SavedMessage = {
  id: string;
  thread_id: string;
  message_id?: string;
  channel_id: string;
  channel_type: string;
  channel_name: string;
  avatar_url: string;
  username: string;
  content: string;
  user_id: string;
  type: 'thread' | 'message';
  saved_at: string;
  created_at: string;
};

export type SavedTarget = Omit<SavedMessage, 'id' | 'saved_at'>;

export const savedMessageKey = (item: SavedMessage | SavedTarget): string =>
  item.type === 'message' && item.message_id
    ? `reply:${item.message_id}`
    : item.type === 'thread' && item.thread_id
    ? `thread:${item.thread_id}`
    : `unavailable:${'id' in item ? item.id : ''}`;

export type SavedMessagesPage = {
  items: SavedMessage[];
  page: number;
  hasMore: boolean;
};
