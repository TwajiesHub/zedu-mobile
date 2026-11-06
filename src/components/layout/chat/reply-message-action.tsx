import { SaveForLaterAction } from '@/components/layout/chat/save-for-later-action';
import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  InteractionManager,
} from 'react-native';
import EmojiPicker, { EmojiType } from 'rn-emoji-keyboard';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import {
  createMessageActionStyles,
  createEmojiPickerTheme,
  createEmojiPickerStyles,
} from '@/theme/createChatOverlayStyles';
import AppBottomSheet, {
  AppBottomSheetRef,
} from '@/components/ui/bottom-sheet';
import { normalize } from '@/utils/normalize';
import { PostRequest, DeleteRequest } from '@/utils/requests';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ACTIONS } from '@/store/types';
import { useDataContext } from '@/store/useDataContext';
import { ShowNotify } from '@/components/ui/toast';
import {
  buildMessageShareLink,
  getPlainMessageText,
} from '@/utils/message-text';
import { ThreadChatType, isOnReplyThreadScreen } from '@/utils/thread-message';
import { ForwardMessageModal } from '@/components/layout/chat/forward-message-modal';
import { buildForwardSourceContext } from '@/utils/forward-message';
import { pinMessage, unpinMessage } from '@/utils/pin-message';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const DEFAULT_EMOJIS = ['👍', '😂', '🙏', '✅', '😭', '❤️', '👏'];

export const ReplyMessageAction = forwardRef<
  AppBottomSheetRef,
  {
    item: any;
    onClose: () => void;
    handleEdit?: () => void;
    threadChatType?: ThreadChatType;
  }
>(({ item, onClose, handleEdit, threadChatType = 'dm' }, ref) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createMessageActionStyles(colors), [colors]);
  const emojiPickerTheme = useMemo(
    () => createEmojiPickerTheme(colors),
    [colors],
  );
  const emojiPickerStyles = useMemo(
    () => createEmojiPickerStyles(colors),
    [colors],
  );
  const [isEmojiTrayOpen, setIsEmojiTrayOpen] = useState(false);
  const [mode, setMode] = useState<'actions' | 'delete' | 'unpin'>('actions');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [forwardItem, setForwardItem] = useState<any>(null);
  const navigation = useNavigation();
  const route = useRoute();
  const isOnThreadScreen = isOnReplyThreadScreen(route.name);
  const { state, dispatch } = useDataContext();
  const itemKey = item?.id ?? item?.message_id ?? item?.thread_id;

  useEffect(() => {
    if (!itemKey) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (ref && typeof ref !== 'function') {
        ref.current?.expand();
      }
    });
    return () => task.cancel();
  }, [itemKey, ref]);

  const handleEmoji = async (emoji: string) => {
    const messageId = item?.id ?? item?.message_id;
    const payload = {
      thread_id: item?.thread_id,
      message_id: messageId,
      type: 'reply',
      reaction: emoji,
    };

    await PostRequest(
      `/reactions/${item.channels_id || item.channel_id}`,
      payload,
    );

    dispatch({
      type: ACTIONS.CHANNEL_CALLBACK,
      payload: !state?.channelCallback,
    });

    if (ref && 'current' in ref) {
      ref.current?.close();
    }
    onClose();
  };

  const handleDelete = async () => {
    const messageId = item?.id;
    if (!messageId) {
      ShowNotify('Error', 'Unable to delete this message');
      return;
    }

    setDeleteLoading(true);
    try {
      const { error } = await DeleteRequest(
        `/channels/${
          item?.channels_id || item?.channel_id
        }/messages/${messageId}`,
      );

      if (!error) {
        dispatch({
          type: ACTIONS.REPLY_CHAT,
          payload: { removedMessageId: messageId },
        });
        dispatch({
          type: ACTIONS.CHANNEL_CALLBACK,
          payload: !state?.channelCallback,
        });
        dispatch({
          type: ACTIONS.CALLBACK,
          payload: !state?.callback,
        });

        if (ref && 'current' in ref) {
          ref.current?.close();
        }
        onClose();
      } else {
        ShowNotify(
          'Error',
          typeof error === 'string' ? error : 'Failed to delete message',
        );
      }
    } catch (error) {
      console.error('Delete failed:', error);
      ShowNotify('Error', 'Failed to delete message');
    } finally {
      setDeleteLoading(false);
    }
  };

  const ActionItem = ({
    label,
    icon,
    ionicon,
    isDestructive,
    handleClick,
    isLoading,
  }: any) => (
    <TouchableOpacity
      style={styles.actionItem}
      activeOpacity={0.7}
      onPress={handleClick}
      disabled={isLoading}
    >
      <View
        style={[
          styles.iconWrapper,
          isDestructive && styles.destructiveIconWrapper,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : ionicon ? (
          <MaterialCommunityIcons
            name={ionicon}
            size={18}
            color={isDestructive ? colors.error : colors.iconDefault}
          />
        ) : (
          <Image
            source={icon}
            style={[styles.icon, isDestructive && styles.destructiveIcon]}
          />
        )}
      </View>
      <AppText
        size={15}
        style={[styles.label, isDestructive && styles.destructiveLabel]}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );

  const closeSheet = () => {
    if (ref && 'current' in ref) {
      ref.current?.close();
    }
    onClose();
  };

  const getChannelId = () =>
    item?.channels_id ||
    item?.channel_id ||
    state?.channelDetails?.channels_id ||
    state?.channelDetails?.channel_id;

  const handlePin = async () => {
    const channelId = getChannelId();
    const threadId = item?.thread_id;
    const messageId = item?.id ?? item?.message_id;
    if (!channelId || !threadId || !messageId) {
      ShowNotify('Error', 'Unable to pin this message');
      return;
    }

    setPinLoading(true);
    try {
      const { error } = await pinMessage({
        kind: 'message',
        channelId,
        threadId,
        messageId: String(messageId),
      });
      if (error) {
        ShowNotify('Error', error);
        return;
      }

      dispatch({
        type: ACTIONS.UPDATE_REPLY_PIN,
        payload: {
          threadId: String(messageId),
          is_pin: true,
          details: {
            email: state?.user?.email,
            username: state?.user?.username,
          },
        },
      });
      closeSheet();
    } finally {
      setPinLoading(false);
    }
  };

  const handleUnpin = async () => {
    const channelId = getChannelId();
    const threadId = item?.thread_id;
    const messageId = item?.id ?? item?.message_id;
    if (!channelId || !messageId) {
      ShowNotify('Error', 'Unable to unpin this message');
      return;
    }

    setPinLoading(true);
    try {
      const { error } = await unpinMessage({
        kind: 'message',
        channelId,
        threadId: threadId || '',
        messageId: String(messageId),
      });
      if (error) {
        ShowNotify('Error', error);
        return;
      }

      dispatch({
        type: ACTIONS.UPDATE_REPLY_PIN,
        payload: {
          threadId: String(messageId),
          is_pin: false,
          details: null,
        },
      });
      closeSheet();
    } finally {
      setPinLoading(false);
    }
  };

  const handleCopyMessage = async () => {
    const text = getPlainMessageText(item?.message || '');

    if (!text) {
      ShowNotify('Error', 'Nothing to copy');
      return;
    }

    try {
      Clipboard.setString(text);
      ShowNotify('Success', 'Message copied to clipboard');
      closeSheet();
    } catch {
      ShowNotify('Error', 'Failed to copy message');
    }
  };

  const handleCopyMessageLink = async () => {
    const channelId = item?.channels_id || item?.channel_id;
    const threadId = item?.thread_id;

    if (!channelId || !threadId) {
      ShowNotify('Error', 'Unable to copy link for this message');
      return;
    }

    const link =
      item?.message_url ||
      item?.message_link ||
      buildMessageShareLink({
        threadId,
        channelId,
        orgSlug: state?.orgData?.name,
        context: 'dm',
      });

    try {
      Clipboard.setString(link);
      ShowNotify('Success', 'Message link copied to clipboard');
      closeSheet();
    } catch {
      ShowNotify('Error', 'Failed to copy message link');
    }
  };

  // handle reply
  const handleThread = () => {
    dispatch({ type: ACTIONS.SELECTED_MSG, payload: item });
    dispatch({
      type: ACTIONS.REPLY_CHAT,
      payload: { data: item.preview_reply, page: 1 },
    });

    if (threadChatType === 'channel') {
      navigation.navigate('ChannelStack', {
        screen: 'ChannelThread',
        params: {
          thread_id: item?.thread_id,
          channel_id: item?.channels_id || item?.channel_id,
        },
      });
    } else if (threadChatType === 'group_dm') {
      navigation.navigate('ChatStack', {
        screen: 'GroupChatThreadScreen',
        params: {
          thread_id: item?.thread_id,
          channel_id: item?.channels_id || item?.channel_id,
        },
      });
    } else {
      navigation.navigate('ChatStack', {
        screen: 'ChatThreadScreen',
        params: {
          thread_id: item?.thread_id,
          channel_id: item?.channels_id || item?.channel_id,
          chatType: threadChatType,
        },
      });
    }

    setTimeout(() => {
      if (ref && 'current' in ref) {
        ref.current?.close();
      }
    }, 500);
  };

  const handleForwardClose = () => {
    setIsForwardOpen(false);
    setForwardItem(null);
    onClose();
  };

  return (
    <>
      <ForwardMessageModal
        visible={isForwardOpen}
        item={forwardItem}
        sourceContext={
          forwardItem
            ? buildForwardSourceContext(forwardItem, threadChatType, state)
            : undefined
        }
        threadChatType={threadChatType}
        onClose={handleForwardClose}
      />

      <AppBottomSheet
        ref={ref}
        snapPoints={mode === 'actions' ? ['65%'] : ['40%']}
        paddingBottom={normalize(110)}
        onClose={() => {
          setMode('actions');
          if (!isForwardOpen) {
            onClose();
          }
        }}
      >
        {mode === 'actions' ? (
          <>
            <View style={styles.pinnedHeader}>
              <Image
                source={{
                  uri: item?.avatar_url
                    ? item?.avatar_url
                    : item?.default_avatar_url,
                }}
                style={styles.avatar}
              />

              <View style={styles.textContainer}>
                <AppText variant="medium" size={14}>
                  {item?.username}
                </AppText>
                <AppText size={13} style={styles.messageMeta}>
                  {item?.message?.replace(/<[^>]*>?/gm, '') || 'Media'}
                </AppText>
              </View>
            </View>

            <View style={styles.reactionContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reactionScroll}
              >
                {DEFAULT_EMOJIS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleEmoji(emoji)}
                  >
                    <AppText size={20}>{emoji}</AppText>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={() => setIsEmojiTrayOpen(true)}
                >
                  <Image
                    source={require('@/assets/icons/emoji.png')}
                    style={styles.inputIcon}
                  />
                </TouchableOpacity>
              </ScrollView>
            </View>

            <ScrollView bounces={false}>
              <SaveForLaterAction
                item={item}
                kind="message"
                chatType={threadChatType}
              />
              {!isOnThreadScreen && (
                <ActionItem
                  label="Reply"
                  icon={require('@/assets/icons/reply.png')}
                  handleClick={handleThread}
                />
              )}
              {item?.user_id === state?.user?.user_id && (
                <ActionItem
                  label="Edit Message"
                  icon={require('@/assets/icons/edit-message.png')}
                  handleClick={handleEdit}
                />
              )}
              {/* <ActionItem label="Forward" icon={require('@/assets/icons/forward.png')} handleClick={handleForward} /> */}
              <ActionItem
                label="Copy Message"
                icon={require('@/assets/icons/copy.png')}
                handleClick={handleCopyMessage}
              />
              <ActionItem
                label="Copy link to Message"
                icon={require('@/assets/icons/link.png')}
                handleClick={handleCopyMessageLink}
              />
              {item?.is_pinned ? (
                <ActionItem
                  label="Un-pin from channel"
                  ionicon="pin"
                  handleClick={() => setMode('unpin')}
                />
              ) : (
                <ActionItem
                  label="Pin to channel"
                  ionicon="pin-outline"
                  handleClick={handlePin}
                  isLoading={pinLoading}
                />
              )}
              {item?.user_id === state?.user?.user_id && (
                <ActionItem
                  label="Delete"
                  icon={require('@/assets/icons/delete.png')}
                  isDestructive
                  handleClick={() => setMode('delete')}
                />
              )}
            </ScrollView>
          </>
        ) : mode === 'unpin' ? (
          <View style={styles.deleteConfirmContainer}>
            <AppText variant="medium" size={16} style={styles.deleteTitle}>
              Remove pinned item?
            </AppText>
            <View style={{ marginTop: 15 }}>
              <ActionItem
                label="Remove pinned item"
                ionicon="pin"
                isDestructive
                handleClick={handleUnpin}
                isLoading={pinLoading}
              />
              <ActionItem
                label="Cancel"
                icon={require('@/assets/icons/emoji.png')}
                handleClick={() => setMode('actions')}
              />
            </View>
          </View>
        ) : (
          <View style={styles.deleteConfirmContainer}>
            <AppText variant="medium" size={16} style={styles.deleteTitle}>
              Delete Message?
            </AppText>
            <View style={{ marginTop: 15 }}>
              <ActionItem
                label="Delete for everyone"
                icon={require('@/assets/icons/delete.png')}
                isDestructive
                handleClick={handleDelete}
                isLoading={deleteLoading}
              />
              <ActionItem
                label="Cancel"
                icon={require('@/assets/icons/emoji.png')}
                handleClick={() => setMode('actions')}
              />
            </View>
          </View>
        )}
      </AppBottomSheet>

      <EmojiPicker
        onEmojiSelected={(emoji: EmojiType) => handleEmoji(emoji.emoji)}
        open={isEmojiTrayOpen}
        onClose={() => setIsEmojiTrayOpen(false)}
        enableRecentlyUsed
        categoryPosition="bottom"
        enableSearchBar
        disableSafeArea={true}
        allowMultipleSelections
        emojiSize={25}
        defaultHeight={600}
        theme={emojiPickerTheme}
        styles={emojiPickerStyles}
      />
    </>
  );
});
