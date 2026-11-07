import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
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
