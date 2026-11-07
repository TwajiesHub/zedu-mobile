import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  RefreshControl,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { ChannelStackParamList } from '@/navigation/stacks/channels';
import Container from '@/components/layout/container';
import AppBottomSheet from '@/components/ui/bottom-sheet';
import { AppButton } from '@/components/ui/button';
import { AppInput } from '@/components/ui/input';
import { AppText } from '@/components/ui/text';
import { ShowNotify } from '@/components/ui/toast';
import { useDataContext } from '@/store/useDataContext';
import { useTheme } from '@/theme/ThemeProvider';
import { canManageChannelWebhooks } from '@/lib/channel-webhook-permissions';
import { useChannelWebhook } from '@/hooks/useChannelWebhook';
import {
  WebhookHeader,
  useWebhookStyles,
} from '@/screens/channels/webhooks/shared';

export default function ChannelWebhookScreen({
  route,
  navigation,
}: StackScreenProps<ChannelStackParamList, 'ChannelWebhook'>) {
  const { channel_id: channelId } = route.params;
  const { state } = useDataContext();
  const allowed = canManageChannelWebhooks(state.orgData);
  const { colors } = useTheme();
  const styles = useWebhookStyles();
  const api = useChannelWebhook(channelId, state.orgId || '', allowed);
  const { webhook, loading, busy, error } = api;
  const disabled = loading || busy;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [event, setEvent] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
    setNameError(null);
  }, [channelId, state.orgId, allowed, webhook?.id]);

  const rename = async () => {
    if (!name.trim()) {
      setNameError('Webhook name is required');
      return;
    }
    setNameError(null);
    if (await api.rename(name, event)) {
      setEditing(false);
      ShowNotify('Success', 'Webhook updated');
    }
  };
  const remove = async () => {
    if (await api.remove()) {
      setConfirmDelete(false);
      ShowNotify('Success', 'Webhook deleted');
    }
  };
  const copy = () => {
    try {
      Clipboard.setString(webhook?.webhook_url || '');
      ShowNotify('Success', 'Webhook URL copied');
    } catch {
      ShowNotify('Error', 'Could not copy webhook URL');
    }
  };

  return (
    <Container safeBottom>
      <View style={styles.screen}>
        <WebhookHeader
          title="Channel webhook"
          onBack={() => navigation.goBack()}
        />
        {!allowed ? (
          <View style={styles.center}>
            <AppText>You do not have permission to manage webhooks.</AppText>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={loading && Boolean(webhook)}
                onRefresh={() => {
                  api.refresh();
                }}
                tintColor={colors.primary}
              />
            }
          >
            {error && (
              <View style={styles.card}>
                <AppText accessibilityRole="alert" style={styles.error}>
                  {error}
                </AppText>
                <AppButton
                  title="Retry"
                  variant="secondary"
                  disabled={disabled}
                  onPress={() => {
                    api.refresh();
                  }}
                />
              </View>
            )}
            {loading && !webhook ? (
              <View style={styles.center}>
                <ActivityIndicator
                  accessibilityLabel="Loading webhook"
                  color={colors.primary}
                />
              </View>
            ) : webhook ? (
              <View style={styles.card}>
                <AppText variant="bold" size={20}>
                  {webhook.webhook_name || 'Channel webhook'}
                </AppText>
                <View style={styles.badge}>
                  <AppText
                    style={{
                      color:
                        webhook.status === 'active'
                          ? colors.online
                          : colors.textSecondary,
                    }}
                  >
                    {webhook.status === 'active' ? 'Active' : 'Inactive'}
                  </AppText>
                </View>
                <AppText style={styles.label}>Webhook URL</AppText>
                <AppText selectable>
                  {webhook.webhook_url || 'URL unavailable'}
                </AppText>
                <AppButton
                  title="Copy URL"
                  variant="secondary"
                  disabled={disabled || !webhook.webhook_url}
                  onPress={copy}
                />
                <View style={styles.row}>
                  <AppText>Active</AppText>
                  <Switch
                    accessibilityLabel="Webhook active"
                    disabled={disabled}
                    value={webhook.status === 'active'}
                    onValueChange={value => {
                      api.changeStatus(value ? 'active' : 'inactive');
                    }}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
                {editing ? (
                  <>
                    <AppInput
                      label="Webhook name"
                      placeholder="Webhook name"
                      accessibilityLabel="Webhook name"
                      value={name}
                      onChangeText={setName}
                      disabled={disabled}
                      autoCapitalize="none"
                    />
                    <AppInput
                      label="Event name (optional)"
                      placeholder="Event name"
                      accessibilityLabel="Event name"
                      value={event}
                      onChangeText={setEvent}
                      disabled={disabled}
                      autoCapitalize="none"
                    />
                    {nameError && (
                      <AppText accessibilityRole="alert" style={styles.error}>
                        {nameError}
                      </AppText>
                    )}
                    <AppButton
                      title="Save changes"
                      disabled={disabled}
                      loading={busy}
                      onPress={() => {
                        rename();
                      }}
                    />
                    <AppButton
                      title="Cancel rename"
                      variant="secondary"
                      disabled={disabled}
                      onPress={() => setEditing(false)}
                    />
                  </>
                ) : (
                  <AppButton
                    title="Rename webhook"
                    variant="secondary"
                    disabled={disabled}
                    onPress={() => {
                      setName(webhook.webhook_name);
                      setEvent(webhook.event_name);
                      setNameError(null);
                      setEditing(true);
                    }}
                  />
                )}
                <AppButton
                  title="Delivery history"
                  variant="secondary"
                  disabled={disabled}
                  onPress={() =>
                    navigation.navigate('WebhookHistory', {
                      channel_id: channelId,
                      webhook_id: webhook.id,
                    })
                  }
                />
                <AppButton
                  title="Delete webhook"
                  variant="danger"
                  disabled={disabled}
                  onPress={() => setConfirmDelete(true)}
                />
              </View>
            ) : (
              !error && (
                <View style={styles.card}>
                  <AppText variant="bold" size={20}>
                    No webhook yet
                  </AppText>
                  <AppText>
                    Create a webhook to let external services post messages to
                    this channel.
                  </AppText>
                  <AppButton
                    title="Create webhook"
                    disabled={disabled}
                    loading={busy}
                    onPress={() => {
                      api.create();
                    }}
                  />
                </View>
              )
            )}
          </ScrollView>
        )}
        {confirmDelete && allowed && (
          <AppBottomSheet
            startOpen
            snapPoints={['65%']}
            onClose={() => {
              setConfirmDelete(false);
            }}
          >
            <View style={styles.sheet}>
              <AppText variant="bold" size={20}>
                Delete this webhook?
              </AppText>
              <AppText>
                Its URL will stop accepting requests. This cannot be undone.
              </AppText>
              {error && (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {error}
                </AppText>
              )}
              <AppButton
                title="Confirm delete"
                variant="danger"
                disabled={disabled}
                loading={busy}
                onPress={() => {
                  remove();
                }}
              />
              <AppButton
                title="Cancel delete"
                variant="secondary"
                disabled={disabled}
                onPress={() => setConfirmDelete(false)}
              />
            </View>
          </AppBottomSheet>
        )}
      </View>
    </Container>
  );
}
