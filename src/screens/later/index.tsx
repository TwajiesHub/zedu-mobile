import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Container from '@/components/layout/container';
import { AppText } from '@/components/ui/text';
import { ShowNotify } from '@/components/ui/toast';
import { useTheme } from '@/theme/ThemeProvider';
import { useDataContext } from '@/store/useDataContext';
import { useSavedMessages } from '@/hooks/useSavedMessages';
import { SavedMessage, savedMessageKey } from '@/types/saved-message';
import { formatPreviewMessage } from '@/utils/message-text';
import { openSavedMessage } from '@/services/saved-message-navigation';

export default function LaterScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { dispatch } = useDataContext();
  const { saved, controller, orgId } = useSavedMessages();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 18,
          gap: 14,
        },
        row: {
          padding: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        avatar: { width: 32, height: 32, borderRadius: 16 },
        secondary: { color: colors.textSecondary, marginTop: 6 },
        center: { padding: 32, alignItems: 'center', gap: 12 },
        button: { paddingVertical: 12, alignSelf: 'flex-start' },
        actionText: { color: colors.primary },
      }),
    [colors],
  );

  useFocusEffect(
    useCallback(() => {
      if (orgId) controller?.loadPage(true);
    }, [orgId, controller]),
  );

  const refresh = () => {
    if (orgId) controller?.loadPage(true);
  };
  const remove = async (item: SavedMessage) => {
    if (!(await controller?.remove(item)))
      ShowNotify(
        'Error',
        'Could not remove this saved message. Please try again.',
      );
  };
  const renderItem = ({ item }: { item: SavedMessage }) => {
    const pending = Boolean(saved.pending[savedMessageKey(item)]);
    const date = new Date(item.saved_at);
    const preview = formatPreviewMessage(item.content);
    return (
      <View style={styles.row}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Open saved message from ${
            item.username || 'Unknown author'
          }`}
          onPress={() => {
            if (!openSavedMessage(item, navigation, dispatch))
              ShowNotify('Error', 'Message unavailable');
          }}
        >
          <View style={styles.author}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={32}
                color={colors.textSecondary}
              />
            )}
            <AppText variant="bold">
              {item.username || 'Unknown author'}
            </AppText>
          </View>
          <AppText style={styles.secondary}>
            {item.channel_name || 'Conversation'} ·{' '}
            {conversationLabel(item.channel_type)}
          </AppText>
          <AppText numberOfLines={3}>
            {preview || 'Message unavailable'}
          </AppText>
          {Number.isFinite(date.getTime()) && (
            <AppText style={styles.secondary}>
              Saved {date.toLocaleString()}
            </AppText>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Remove from Later"
          accessibilityState={{ disabled: pending, busy: pending }}
          disabled={pending}
          onPress={() => {
            remove(item);
          }}
          style={styles.button}
        >
          {pending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <AppText style={styles.actionText}>Remove from Later</AppText>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const footer = saved.error ? (
    <View style={styles.center}>
      <AppText>{saved.error}</AppText>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => {
          controller?.loadPage(saved.page === 0);
        }}
      >
        <AppText style={styles.actionText}>Retry</AppText>
      </TouchableOpacity>
    </View>
  ) : saved.loading ? (
    <View style={styles.center}>
      <ActivityIndicator
        accessibilityLabel="Loading saved messages"
        color={colors.primary}
      />
    </View>
  ) : saved.hasMore && saved.items.length > 0 ? (
    <TouchableOpacity
      accessibilityRole="button"
      style={styles.center}
      onPress={() => {
        controller?.loadPage();
      }}
    >
      <AppText style={styles.actionText}>Load more</AppText>
    </TouchableOpacity>
  ) : null;

  return (
    <Container safeBottom>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" color={colors.textPrimary} size={24} />
          </TouchableOpacity>
          <AppText variant="bold" size={24}>
            Later
          </AppText>
        </View>
        <FlatList
          data={saved.items}
          keyExtractor={savedMessageKey}
          renderItem={renderItem}
          refreshing={saved.refreshing}
          onRefresh={refresh}
          onEndReached={() => {
            if (!saved.loading && !saved.error) controller?.loadPage();
          }}
          onEndReachedThreshold={0.25}
          ListFooterComponent={footer}
          ListEmptyComponent={
            !saved.loading && !saved.error ? (
              <View style={styles.center}>
                <AppText>
                  {orgId
                    ? 'Nothing saved yet'
                    : 'Select a workspace to view Later'}
                </AppText>
              </View>
            ) : null
          }
        />
      </View>
    </Container>
  );
}

export function conversationLabel(value: string) {
  switch (value.toLowerCase()) {
    case 'dm':
      return 'Direct message';
    case 'groupdm':
      return 'Group DM';
    case 'public':
      return 'Public channel';
    case 'private':
      return 'Private channel';
    default:
      return 'Conversation';
  }
}
