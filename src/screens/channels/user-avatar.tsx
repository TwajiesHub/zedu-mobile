import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useNavigation } from '@react-navigation/native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createChannelSetupStyles } from '@/theme/createStep10Styles';
import { normalize } from '@/utils/normalize';
import { getInitials } from '@/utils/file-helpers';

const BADGE_RING_WIDTH = 2;

interface UserAvatarProps {
  user: {
    avatar_url?: string;
    default_avatar_url?: string;
    online?: boolean;
  };
  size?: number;
  showBadge?: boolean;
  /** Presence dot diameter, excluding the ring; defaults to 30% of the avatar. */
  badgeSize?: number;
  /** Ring around the presence dot; match the surrounding background. */
  badgeRingColor?: string;
  /** Name used for the initials fallback when the user has no photo. */
  fallbackName?: string;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 40,
  showBadge = true,
  badgeSize,
  badgeRingColor,
  fallbackName,
  disabled = false,
  onPress,
  style,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(
    () => createChannelSetupStyles(colors).userAvatar,
    [colors],
  );
  const navigation = useNavigation<any>();
  const [imageFailed, setImageFailed] = useState(false);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('SettingStack', { screen: 'Profile' });
    }
  };

  const avatarUri = user?.avatar_url || user?.default_avatar_url;

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUri]);

  const avatarSource = useMemo(() => ({ uri: avatarUri }), [avatarUri]);
  const showInitials = !!fallbackName && (!avatarUri || imageFailed);
  const presenceLabel = user?.online ? 'Online' : 'Offline';
  const accessibilityLabel = showBadge
    ? [fallbackName, presenceLabel].filter(Boolean).join(', ')
    : fallbackName;
  const dotSize = normalize(badgeSize ?? size * 0.3);
  const ringSize = dotSize + BADGE_RING_WIDTH * 2;

  const dynamicStyles = {
    container: {
      width: normalize(size),
      height: normalize(size),
    },
    image: {
      width: normalize(size),
      height: normalize(size),
      borderRadius: normalize(size / 2),
    },
    initials: {
      width: normalize(size),
      height: normalize(size),
      borderRadius: normalize(size / 2),
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    initialsText: {
      color: colors.white,
    },
    // The ring is an outer circle rather than a border so the dot keeps its
    // full size and stays round on Android.
    badgeRing: {
      width: ringSize,
      height: ringSize,
      borderRadius: ringSize / 2,
      borderWidth: 0,
      backgroundColor: badgeRingColor ?? colors.white,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    badgeDot: {
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
      backgroundColor: user?.online
        ? colors.presenceOnline
        : colors.presenceOffline,
    },
  };

  return (
    <TouchableOpacity
      style={[styles.avatarContainer, dynamicStyles.container, style]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.8}
    >
      {showInitials ? (
        <View style={dynamicStyles.initials}>
          <AppText
            variant="bold"
            size={Math.max(9, size * 0.38)}
            style={dynamicStyles.initialsText}
          >
            {getInitials(fallbackName)}
          </AppText>
        </View>
      ) : (
        <FastImage
          source={avatarSource}
          style={dynamicStyles.image}
          resizeMode={FastImage.resizeMode.cover}
          onError={() => setImageFailed(true)}
        />
      )}

      {showBadge && (
        <View style={[styles.onlineBadge, dynamicStyles.badgeRing]}>
          <View style={dynamicStyles.badgeDot} />
        </View>
      )}
    </TouchableOpacity>
  );
};
