import React from 'react';
import { AppText } from '@/components/ui/text';
import { useSavedMessages } from '@/hooks/useSavedMessages';
import { useTheme } from '@/theme/ThemeProvider';

export function SavedMessageIndicator({
  item,
  reply = false,
}: {
  item: { thread_id?: string; id?: string; message_id?: string };
  reply?: boolean;
}) {
  const { saved } = useSavedMessages();
  const { colors } = useTheme();
  const id = reply ? item.id || item.message_id : item.thread_id;
  if (!id || !saved.lookup[`${reply ? 'reply' : 'thread'}:${id}`]) return null;
  return (
    <AppText
      size={11}
      style={{ color: colors.primary }}
      accessibilityLabel="Saved for later"
    >
      Saved
    </AppText>
  );
}
