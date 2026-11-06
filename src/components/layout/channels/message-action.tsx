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
import { useNavigation, useRoute } from '@react-navigation/native';
import { normalize } from '@/utils/normalize';
import { DeleteRequest, PostRequest } from '@/utils/requests';
import { useDataContext } from '@/store/useDataContext';
import { ACTIONS } from '@/store/types';
import { isOnReplyThreadScreen } from '@/utils/thread-message';

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
  const route = useRoute();
  const isOnThreadScreen = isOnReplyThreadScreen(route.name);
  const [mode, setMode] = useState<'actions' | 'delete'>('actions');
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  // Emoji reaction event
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

  // Delete a message
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const { error } = await DeleteRequest(
        `/threads/${item?.thread_id}/channels/${
          item?.channels_id || item?.channel_id
        }`,
      );

      dispatch({
        type: ACTIONS.CHANNEL_CALLBACK,
        payload: !state?.channelCallback,
      });

      if (!error) {
        console.log('Message deleted successfully');
        if (ref && 'current' in ref) {
          ref.current?.close();
        }
        onClose();
      } else {
        console.log('Error deleting message:', error);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // action items
  const ActionItem = ({
    label,
    icon,
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

  // navigate to thread
  const handleThread = () => {
    dispatch({ type: ACTIONS.SELECTED_MSG, payload: item });
    navigation.navigate('ChannelStack', {
      screen: 'ChannelThread',
      params: { thread_id: item?.thread_id, channel_id: item?.channels_id },
    });

    setTimeout(() => {
      if (ref && 'current' in ref) {
        ref.current?.close();
      }
    }, 500);
  };

  //

  return (
    <>
      <AppBottomSheet
        ref={ref}
        snapPoints={mode === 'delete' ? ['40%'] : ['65%']}
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
                  source={require('@/assets/images/user.png')}
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
                kind={
                  isOnThreadScreen || route.name === 'MentionThread'
                    ? 'message'
                    : 'thread'
                }
                chatType="channel"
              />
              {!isOnThreadScreen && (
                <ActionItem
                  label="Reply in thread"
                  icon={require('@/assets/icons/reply.png')}
                  handleClick={handleThread}
                />
              )}
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
