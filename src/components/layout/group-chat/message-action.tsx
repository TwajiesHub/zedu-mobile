import { SaveForLaterAction } from '@/components/layout/chat/save-for-later-action';
import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import EmojiPicker from 'rn-emoji-keyboard';
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
import { useNavigation } from '@react-navigation/native';
import { normalize } from '@/utils/normalize';
import { DeleteRequest, PostRequest } from '@/utils/requests';
import { useDataContext } from '@/store/useDataContext';
import { ACTIONS } from '@/store/types';
import { pinMessage, unpinMessage } from '@/utils/pin-message';
import { ShowNotify } from '@/components/ui/toast';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const DEFAULT_EMOJIS = ['👍', '😂', '🙏', '✅', '😭', '❤️', '👏'];

export const MessageAction = forwardRef<
  AppBottomSheetRef,
  { item: any; onClose: () => void }
>(({ item, onClose }, ref) => {
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
  const navigation = useNavigation();
  const [mode, setMode] = useState<'actions' | 'delete' | 'unpin'>('actions');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const { state, dispatch } = useDataContext();
  const { user } = state;
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
    const payload = {
      thread_id: item?.thread_id,
      type: 'thread',
      reaction: emoji,
    };
    await PostRequest(
      `/reactions/${item.channels_id || item.channel_id}`,
      payload,
    );
    if (ref && 'current' in ref) {
      ref.current?.close();
    }
    onClose();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      // Updated to match your web implementation endpoint structure
      const { error } = await DeleteRequest(
        `/threads/${item?.thread_id}/channels/${
          item?.channels_id || item?.channel_id
        }`,
      );

      dispatch({
        type: ACTIONS.CHANNEL_CALLBACK,
        payload: !state?.channelCallback,
      });
      dispatch({
        type: ACTIONS.CALLBACK,
        payload: !state?.callback,
      });

      if (!error) {
        if (ref && 'current' in ref) {
          ref.current?.close();
        }
        onClose();
      }
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  // navigate to thread
  const handleThread = () => {
    dispatch({ type: ACTIONS.SELECTED_MSG, payload: item });
    dispatch({
      type: ACTIONS.REPLY_CHAT,
      payload: { data: item.preview_reply, page: 1 },
    });
    navigation.navigate('ChatStack', {
      screen: 'GroupChatThreadScreen',
      params: { thread_id: item?.thread_id, channel_id: item?.channels_id },
    });

    setTimeout(() => {
      if (ref && 'current' in ref) {
        ref.current?.close();
      }
    }, 500);
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
    if (!channelId || !threadId) {
      ShowNotify('Error', 'Unable to pin this message');
      return;
    }

    setPinLoading(true);
    try {
      const { error } = await pinMessage({
        kind: 'thread',
        channelId,
        threadId,
      });
      if (error) {
        ShowNotify('Error', error);
        return;
      }

      dispatch({
        type: ACTIONS.UPDATE_DM_PIN,
        payload: {
          threadId,
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
    if (!channelId || !threadId) {
      ShowNotify('Error', 'Unable to unpin this message');
      return;
    }

    setPinLoading(true);
    try {
      const { error } = await unpinMessage({
        kind: 'thread',
        channelId,
        threadId,
      });
      if (error) {
        ShowNotify('Error', error);
        return;
      }

      dispatch({
        type: ACTIONS.UPDATE_DM_PIN,
        payload: {
          threadId,
          is_pin: false,
          details: null,
        },
      });
      closeSheet();
    } finally {
      setPinLoading(false);
    }
  };

  //

  return (
    <>
      <AppBottomSheet
        ref={ref}
        snapPoints={mode === 'actions' ? ['65%'] : ['40%']}
        paddingBottom={normalize(110)}
        onClose={() => {
          setMode('actions');
          onClose();
        }}
      >
        {mode === 'actions' ? (
          <>
            <View style={styles.pinnedHeader}>
              {item?.avatar_url ? (
                <Image
                  source={{ uri: item?.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <Image
                  source={{ uri: item?.default_avatar_url }}
                  style={styles.avatar}
                />
              )}
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
                kind="thread"
                chatType="group_dm"
              />
              <ActionItem
                label="Reply"
                icon={require('@/assets/icons/reply.png')}
                handleClick={handleThread}
              />
              <ActionItem
                label="Forward"
                icon={require('@/assets/icons/forward.png')}
              />
              <ActionItem
                label="Copy Message"
                icon={require('@/assets/icons/copy.png')}
              />
              <ActionItem
                label="Copy link to Message"
                icon={require('@/assets/icons/link.png')}
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
              {item?.user_id === user?.user_id && (
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
                icon={require('@/assets/icons/close.png')}
                handleClick={() => setMode('actions')}
              />
            </View>
          </View>
        )}
      </AppBottomSheet>

      <EmojiPicker
        onEmojiSelected={() => {}}
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
