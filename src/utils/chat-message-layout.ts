export type LayoutMessage = {
  thread_id?: string;
  user_id?: string;
  created_at?: string;
};

export type SenderAvatarSlot = 'avatar' | 'spacer';

// Local calendar day, compared without formatting so it is cheap per row.
const dayKey = (value?: string) => {
  const date = new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '' : date.toDateString();
};

const isSameDay = (a?: string, b?: string) => dayKey(a) === dayKey(b);

/**
 * Messages are ordered newest first (inverted list). A sender run ends at the
 * newest message of consecutive same-sender messages on the same day; only that
 * message shows the avatar, the rest keep an empty spacer for alignment.
 */
export const getSenderAvatarSlot = (
  messages: LayoutMessage[],
  index: number,
): SenderAvatarSlot => {
  const current = messages[index];
  const newer = messages[index - 1];

  if (!current || !newer) {
    return 'avatar';
  }

  const sameRun =
    String(newer.user_id) === String(current.user_id) &&
    isSameDay(newer.created_at, current.created_at);

  return sameRun ? 'spacer' : 'avatar';
};

/**
 * Returns the thread_id of the oldest unread incoming message, given the
 * unread count captured before the chat was marked as read. Messages are
 * ordered newest first; the current user's own messages never count. When
 * the unread count exceeds the loaded incoming messages, the oldest loaded
 * incoming message is used.
 */
export const getFirstUnreadMessageId = (
  messages: LayoutMessage[],
  unreadCount: number,
  currentUserId?: string,
): string | null => {
  if (!unreadCount || unreadCount <= 0 || !Array.isArray(messages)) {
    return null;
  }

  let seen = 0;
  let oldestIncoming: string | null = null;

  for (const message of messages) {
    if (!message?.thread_id) continue;
    if (currentUserId && String(message.user_id) === String(currentUserId)) {
      continue;
    }

    seen += 1;
    oldestIncoming = message.thread_id;

    if (seen === unreadCount) {
      return message.thread_id;
    }
  }

  return oldestIncoming;
};
