import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';

export function useWebhookStyles() {
  const { colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        header: {
          padding: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        content: { padding: 18, gap: 16 },
        card: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 12,
          padding: 16,
          gap: 12,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        },
        label: { color: colors.textSecondary },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 12,
          color: colors.textPrimary,
          backgroundColor: colors.background,
        },
        error: { color: colors.error },
        center: { padding: 28, alignItems: 'center', gap: 12 },
        sheet: { padding: 20, gap: 16 },
        badge: {
          paddingVertical: 4,
          paddingHorizontal: 9,
          borderRadius: 8,
          alignSelf: 'flex-start',
          borderColor: colors.border,
          borderWidth: 1,
        },
      }),
    [colors],
  );
}

export function WebhookButton({
  title,
  onPress,
  disabled = false,
  destructive = false,
  busy = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: destructive ? colors.error : colors.border,
          opacity: disabled ? 0.5 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        text: { color: destructive ? colors.error : colors.primary },
      }),
    [colors, destructive, disabled],
  );
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={styles.button}
    >
      {busy && <ActivityIndicator color={styles.text.color} />}
      <AppText variant="medium" style={styles.text}>
        {title}
      </AppText>
    </TouchableOpacity>
  );
}

export function WebhookHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const styles = useWebhookStyles();
  return (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <AppText variant="bold" size={22}>
        {title}
      </AppText>
    </View>
  );
}
