import React from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { ChannelStackParamList } from '@/navigation/stacks/channels';
import Container from '@/components/layout/container';
import { AppText } from '@/components/ui/text';
import { AppButton } from '@/components/ui/button';
import { useDataContext } from '@/store/useDataContext';
import { useTheme } from '@/theme/ThemeProvider';
import { canManageChannelWebhooks } from '@/lib/channel-webhook-permissions';
import { useWebhookHistory } from '@/hooks/useWebhookHistory';
import { WebhookHistoryItem } from '@/types/webhook';
import {
  WebhookHeader,
  useWebhookStyles,
} from '@/screens/channels/webhooks/shared';

export default function WebhookHistoryScreen({
  route,
  navigation,
}: StackScreenProps<ChannelStackParamList, 'WebhookHistory'>) {
  const { channel_id: channelId, webhook_id: webhookId } = route.params;
  const { state } = useDataContext();
  const allowed = canManageChannelWebhooks(state.orgData);
  const { colors } = useTheme();
  const styles = useWebhookStyles();
  const history = useWebhookHistory(
    channelId,
    webhookId,
    state.orgId || '',
    allowed,
  );
  const renderItem = ({ item }: { item: WebhookHistoryItem }) => {
    const success =
      Number(item.status_code) >= 200 && Number(item.status_code) < 300;
    const attempted = new Date(item.attempted);
    return (
      <View style={styles.card}>
        <AppText
          variant="bold"
          style={{ color: success ? colors.online : colors.error }}
        >
          Status {item.status_code || 'Unknown'}
        </AppText>
        <AppText>Action: {item.action_type || 'Unknown'}</AppText>
        <AppText>Retries: {item.retries || 0}</AppText>
        <AppText style={styles.label}>
          {Number.isFinite(attempted.getTime())
            ? attempted.toLocaleString()
            : 'Time unavailable'}
        </AppText>
      </View>
    );
  };
  return (
    <Container safeBottom>
      <View style={styles.screen}>
        <WebhookHeader
          title="Delivery history"
          onBack={() => navigation.goBack()}
        />
        {!allowed ? (
          <View style={styles.center}>
            <AppText>You do not have permission to manage webhooks.</AppText>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.content}
            data={history.items}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            refreshing={history.refreshing}
            onRefresh={() => {
              history.load(true);
            }}
            onEndReached={() => {
              if (!history.loading && !history.error) history.load();
            }}
            onEndReachedThreshold={0.25}
            ListEmptyComponent={
              !history.loading && !history.error ? (
                <View style={styles.center}>
                  <AppText>No delivery history yet</AppText>
                  <AppText style={styles.label}>
                    Delivery attempts will appear here once external services
                    post to this webhook.
                  </AppText>
                </View>
              ) : null
            }
            ListFooterComponent={
              history.loading ? (
                <ActivityIndicator
                  accessibilityLabel="Loading delivery history"
                  color={colors.primary}
                />
              ) : history.error ? (
                <View style={styles.card}>
                  <AppText accessibilityRole="alert" style={styles.error}>
                    {history.error}
                  </AppText>
                  <AppButton
                    title="Retry history"
                    variant="secondary"
                    onPress={() => {
                      history.load(history.page === 0);
                    }}
                  />
                </View>
              ) : history.hasMore && history.items.length > 0 ? (
                <AppButton
                  title="Load more"
                  variant="secondary"
                  onPress={() => {
                    history.load();
                  }}
                />
              ) : null
            }
          />
        )}
      </View>
    </Container>
  );
}
