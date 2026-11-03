import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { UserAvatar } from '@/screens/channels/user-avatar';
import { UserStatusIcon } from '@/components/ui/user-status-icon';
import { UserStatusSource } from '@/utils/user-status';

interface UserAvatarWithStatusProps {
  user: UserStatusSource & {
    avatar_url?: string;
    default_avatar_url?: string;
  };
  avatarSize?: number;
  showBadge?: boolean;
  showStatus?: boolean;
  badgeRingColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export const UserAvatarWithStatus = ({
  user,
  avatarSize = 40,
  showBadge = true,
  showStatus = true,
  badgeRingColor,
  onPress,
  style,
}: UserAvatarWithStatusProps) => {
  return (
    <View style={[styles.container, style]}>
      {showStatus && <UserStatusIcon user={user} style={styles.statusIcon} />}
      <UserAvatar
        user={user}
        size={avatarSize}
        showBadge={showBadge}
        badgeRingColor={badgeRingColor}
        onPress={onPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  statusIcon: {
    marginRight: 6,
  },
});
