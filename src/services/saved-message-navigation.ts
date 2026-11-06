import type { Dispatch } from 'react';
import { SavedMessage } from '@/types/saved-message';
import { ACTIONS, Action } from '@/store/types';

type Navigation = { navigate: (...args: any[]) => void };

/** Uses only saved-response fields; a reply opens its parent thread, not an exact older reply. */
export function openSavedMessage(
  item: SavedMessage,
  navigation: Navigation,
  dispatch: Dispatch<Action>,
) {
  if (!item.channel_id || !item.thread_id) return false;
  const type = item.channel_type.toLowerCase();
  const channel = type === 'public' || type === 'private';
  if (!channel && type !== 'dm' && type !== 'groupdm') return false;
  if (item.type === 'message') {
    // Clear stale parent/reply context. The thread's existing loader fetches replies.
    dispatch({
      type: ACTIONS.SELECTED_MSG,
      payload: {
        thread_id: item.thread_id,
        channels_id: item.channel_id,
        channel_type: channel ? type : type === 'dm' ? 'DM' : 'GroupDm',
        message: '',
        username: '',
        preview_reply: [],
      },
    });
    dispatch({ type: ACTIONS.REPLY_CHAT, payload: { data: [], page: 1 } });
    const params = { channel_id: item.channel_id, thread_id: item.thread_id };
    if (channel)
      navigation.navigate('ChannelStack', { screen: 'ChannelThread', params });
    else
      navigation.navigate('ChatStack', {
        screen: type === 'dm' ? 'ChatThreadScreen' : 'GroupChatThreadScreen',
        params: { ...params, ...(type === 'dm' ? { chatType: 'dm' } : {}) },
      });
    return true;
  }
  if (channel) {
    navigation.navigate('ChannelStack', {
      screen: 'ChannelChat',
      params: {
        channel_id: item.channel_id,
        fromNotification: true,
        highlight_thread_id: item.thread_id,
      },
    });
  } else {
    navigation.navigate('ChatStack', {
      screen: type === 'dm' ? 'ChatDetails' : 'GroupChatDetails',
      params: {
        channel_id: item.channel_id,
        fromNotification: true,
        highlight_thread_id: item.thread_id,
      },
    });
  }
  return true;
}
