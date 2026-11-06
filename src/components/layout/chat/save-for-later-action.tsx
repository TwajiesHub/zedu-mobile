import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppText } from '@/components/ui/text';
import { ShowNotify } from '@/components/ui/toast';
import { useTheme } from '@/theme/ThemeProvider';
import { useSavedMessages } from '@/hooks/useSavedMessages';
import { SavedTarget, savedMessageKey } from '@/types/saved-message';
import { useDataContext } from '@/store/useDataContext';
import { ThreadChatType } from '@/utils/thread-message';

type Props = {
  item: Record<string, any>;
  kind?: 'thread' | 'message';
  chatType?: ThreadChatType;
};

export function SaveForLaterAction({
  item,
  kind = 'thread',
  chatType = 'channel',
}: Props) {
  const { colors } = useTheme();
  const { state } = useDataContext();
  const { saved, controller, orgId } = useSavedMessages();
  const sourceType = String(
    item.channel_type || state.selectedMsg?.channel_type || '',
  ).toLowerCase();
  const target: SavedTarget = {
    type: kind,
    thread_id: item.thread_id || '',
    message_id: kind === 'message' ? item.id || item.message_id : undefined,
    channel_id:
      item.channels_id ||
      item.channel_id ||
      state.selectedMsg?.channels_id ||
      state.channel?.channels_id ||
      '',
    channel_type:
      sourceType === 'groupdm' || chatType === 'group_dm'
        ? 'groupDM'
        : sourceType === 'dm' || chatType === 'dm'
        ? 'dm'
        : sourceType === 'private' || state.channel?.is_private
        ? 'private'
        : 'public',
    channel_name: item.channel_name || state.channel?.name || '',
    avatar_url: item.avatar_url || item.default_avatar_url || '',
    username: item.username || '',
    content: item.message || item.content || '',
    user_id: item.user_id || '',
    created_at: item.created_at || '',
  };
  const key = savedMessageKey(target);
  const isSaved = Boolean(saved.lookup[key]);
  const pending = Boolean(saved.pending[key]) || saved.lookupLoading;
  const canSave = Boolean(
    orgId &&
      target.channel_id &&
      target.thread_id &&
      (kind === 'thread' || target.message_id),
  );
  const retry = !saved.lookupLoaded && Boolean(saved.lookupError);

  const onPress = async () => {
    if (!controller) return;
    if (retry) {
      try {
        await controller.loadLookup(true);
      } catch {
        ShowNotify('Error', 'Could not load saved messages. Please try again.');
      }
      return;
    }
    const success = await controller.setSaved(target, !isSaved);
    if (!success)
      ShowNotify('Error', 'Could not update Later. Please try again.');
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: pending || !canSave, busy: pending }}
      disabled={pending || !canSave}
      onPress={onPress}
      style={styles.action}
    >
      <View style={styles.icon}>
        {pending ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            color={colors.textPrimary}
            size={18}
          />
        )}
      </View>
      <AppText>
        {retry
          ? 'Retry saved state'
          : isSaved
          ? 'Remove from Later'
          : 'Save for later'}
      </AppText>
      {isSaved && (
        <AppText
          accessibilityLabel="Saved for later"
          style={[styles.saved, { color: colors.primary }]}
        >
          Saved
        </AppText>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  icon: { width: 30 },
  saved: { marginLeft: 8 },
});
