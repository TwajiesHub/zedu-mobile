import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createChatInfoStyles } from '@/theme/createScreenStyles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AddDescription } from '@/components/layout/group-chat/add-description';
import { useDataContext } from '@/store/useDataContext';
import { PostRequest } from '@/utils/requests';
import { ACTIONS } from '@/store/types';
import { UserProfileStatus } from '@/components/ui/user-profile-status';
import { ContactInfoCard } from '@/components/ui/contact-info-card';
import FastImage from 'react-native-fast-image';
import BuzzService from '@/services/buzz.service';
import { ShowNotify } from '@/components/ui/toast';
import Container from '@/components/layout/container';

const DmDetailsScreen = ({ navigation, route }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createChatInfoStyles(colors), [colors]);
  const actionSheetRef = useRef<any>(null);
  const [callLoading, setCallLoading] = useState(false);
  const { state, dispatch } = useDataContext();
  const { user: currentUser, groupDetails, orgId, groupCallback } = state;
  const { channel_id } = route.params;

  const directCallee = (groupDetails?.participants || []).find(
    (item: any) =>
      String(item?.user_id || item?.id) !==
      String(currentUser?.user_id || currentUser?.id),
  );

  const userData = directCallee;

  const handleDirectCall = async () => {
    if (!(directCallee?.user_id ?? directCallee?.id)) return;

    const activeBuzzData = state?.buzzData;
    if (state?.isCallMinimized && activeBuzzData?.buzz_code) {
      dispatch({ type: ACTIONS.CALL_MINIMIZED, payload: false });
      navigation.navigate('DirectCallStack', {
        screen: 'OngoingDirectCall',
        params: {
          buzzCode: activeBuzzData.buzz_code,
          buzzData: activeBuzzData,
        },
      });
      return;
    }

    setCallLoading(true);
    try {
      // Ring the other person in this DM, like every other call button does.
      // createBuzz() only made an empty room with no one invited.
      const result = await BuzzService.directBuzzCall(channel_id);

      if (result.error || !result.data) {
        ShowNotify('Error', result.error || 'Failed to create call');
        setCallLoading(false);
        return;
      }

      const buzz = result.data;
      const joinResult = await BuzzService.joinBuzz(buzz.buzz_code);

      if (joinResult.error || !joinResult.data) {
        ShowNotify('Error', joinResult.error || 'Failed to join call');
        setCallLoading(false);
        return;
      }

      const buzzData = joinResult.data;
      dispatch({ type: ACTIONS.BUZZ_DATA, payload: buzzData });
      dispatch({
        type: ACTIONS.BUZZ_PARTICIPANTS,
        payload: buzzData.participants,
      });

      navigation.navigate('DirectCallStack', {
        screen: 'OngoingDirectCall',
        params: {
          buzzCode: buzzData.buzz_code,
          buzzData: buzzData,
        },
      });
      setCallLoading(false);
    } catch (_error) {
      ShowNotify('Error', 'Failed to start call');
      setCallLoading(false);
    }
  };

  const favorites = async () => {
    const { data, error } = await PostRequest(
      `/organisations/${orgId}/dms/${channel_id}/favourite`,
      {},
    );
    if (!error) {
      dispatch({ type: ACTIONS.SUCCESS, payload: data.message });
      dispatch({ type: ACTIONS.GROUP_CALLBACK, payload: !groupCallback });
    } else {
      dispatch({ type: ACTIONS.ERROR, payload: error });
    }
  };

  const ActionItem = ({
    icon,
    label,
    color = colors.textPrimary,
    subLabel,
    showChevron = false,
    onPress,
    isLast = false,
  }: any) => (
    <TouchableOpacity
      style={[styles.actionRow, !isLast && styles.actionBorder]}
      onPress={onPress}
    >
      <View style={styles.actionLeading}>
        <View style={styles.actionIconBg}>
          <Ionicons name={icon} size={20} color={colors.iconDefault} />
        </View>
        <View style={styles.actionTextContainer}>
          <AppText style={[styles.actionLabel, { color }]}>{label}</AppText>
          {subLabel && (
            <AppText
              size={12}
              style={{ color: colors.messageMeta, marginTop: 2 }}
            >
              {subLabel}
            </AppText>
          )}
        </View>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.messageMeta} />
      )}
    </TouchableOpacity>
  );

  return (
    <Container>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.iconDefault} />
        </TouchableOpacity>
        <AppText variant="bold" style={{ fontSize: 17 }}>
          Contact Info
        </AppText>
        <TouchableOpacity style={styles.iconBtn}>
          {/* <Ionicons name="ellipsis-vertical" size={22} color="black" /> */}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
        <View style={styles.profileHero}>
          <View style={styles.mainAvatarContainer}>
            <Image
              source={{
                uri: userData?.avatar_url || userData?.default_avatar_url,
              }}
              style={styles.mainAvatar}
            />
            <View
              style={[
                styles.onlineStatus,
                {
                  backgroundColor: userData?.online
                    ? colors.online
                    : colors.offline,
                },
              ]}
            />
          </View>

          <AppText variant="bold" style={styles.userName}>
            {userData?.full_name?.trim() || userData?.username}
          </AppText>
          <AppText style={styles.userTitle}>
            {userData?.title || 'Member'}
          </AppText>

          <UserProfileStatus user={userData} userId={userData?.user_id} />

          <View style={styles.quickActionRow}>
            <TouchableOpacity
              style={styles.circleAction}
              disabled={callLoading}
              onPress={handleDirectCall}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons
                  name="call-outline"
                  size={28}
                  color={colors.primary}
                />
              </View>
              <AppText size={12} style={styles.circleActionText}>
                Call
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.circleAction}
              disabled={callLoading}
              onPress={handleDirectCall}
            >
              <View style={styles.actionIconCircle}>
                {callLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons
                    name="videocam-outline"
                    size={28}
                    color={colors.primary}
                  />
                )}
              </View>
              <AppText size={12} style={styles.circleActionText}>
                Video
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleAction} onPress={favorites}>
              <View style={styles.actionIconCircle}>
                <Ionicons
                  name={groupDetails?.is_favourite ? 'star' : 'star-outline'}
                  size={28}
                  color={colors.primary}
                />
              </View>
              <AppText size={12} style={styles.circleActionText}>
                Fav
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentSection}>
          <AppText variant="bold" style={styles.sectionTitle}>
            Contact Details
          </AppText>
          <View style={styles.detailsGrid}>
            <ContactInfoCard
              icon="mail-outline"
              label="Email Address"
              value={userData?.email}
              copyable
            />
            <ContactInfoCard
              icon="call-outline"
              label="Phone Number"
              value={userData?.phone}
              copyable
            />
            <ContactInfoCard
              icon="time-outline"
              label="Timezone"
              value={userData?.timezone}
            />
            <ContactInfoCard
              icon="language-outline"
              label="Pronunciation"
              value={userData?.name_pronounciation}
            />
          </View>
        </View>

        <View style={styles.divider} />

        {groupDetails?.preview_media?.length > 0 && (
          <View style={styles.sectionPadding}>
            <View style={styles.sectionHeader}>
              <AppText variant="bold" style={styles.sectionTitle}>
                Media, Links & Docs
              </AppText>
              <TouchableOpacity
                style={styles.mediaCount}
                onPress={() =>
                  navigation.navigate('MediaGalleryScreen', { channel_id })
                }
              >
                <AppText size={13} style={{ color: colors.primary }}>
                  {groupDetails?.preview_media?.length}{' '}
                </AppText>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mediaScroll}
            >
              {groupDetails?.preview_media?.map((item: any, index: number) => {
                const isImage = item.mime_type?.includes('image');
                const isVideo =
                  item.mime_type?.includes('video') ||
                  item.mime_type === 'application/octet-stream';
                const isDoc =
                  item.mime_type?.includes('pdf') ||
                  item.file_type?.toLowerCase() === 'pdf';

                if (isVideo) {
                  return (
                    <View key={index} style={styles.videoWrapper}>
                      <View
                        style={[
                          styles.mediaThumb,
                          { backgroundColor: '#23272F' },
                        ]}
                      />
                      <View style={styles.playIconOverlay}>
                        <Ionicons name="play" size={20} color={colors.white} />
                      </View>
                    </View>
                  );
                }

                if (isDoc) {
                  return (
                    <View
                      key={index}
                      style={[
                        styles.mediaThumb,
                        {
                          backgroundColor: '#F9FAFB',
                          justifyContent: 'center',
                          alignItems: 'center',
                        },
                      ]}
                    >
                      <Ionicons
                        name="document-text"
                        size={32}
                        color={colors.error}
                      />
                      <AppText
                        size={8}
                        numberOfLines={1}
                        style={{
                          position: 'absolute',
                          bottom: 5,
                          paddingHorizontal: 5,
                        }}
                      >
                        {item.file_name}
                      </AppText>
                    </View>
                  );
                }

                if (isImage) {
                  return (
                    <FastImage
                      key={index}
                      source={{ uri: item.file_link }}
                      style={styles.mediaThumb}
                      resizeMode={FastImage.resizeMode.cover}
                    />
                  );
                }

                return null;
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.settingsSection}>
          <ActionItem
            icon="notifications-outline"
            label="Notifications"
            subLabel="Mute, sounds, alerts"
            showChevron
          />
          <ActionItem
            icon="lock-closed-outline"
            label="Encryption"
            subLabel="Messages are end-to-end encrypted"
            showChevron
          />
          <ActionItem
            icon="star-outline"
            label="Starred Messages"
            showChevron
          />
          <ActionItem
            icon="trash-outline"
            label="Clear Chat"
            color={colors.error}
            isLast
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <AddDescription
        onClose={() => actionSheetRef.current?.close()}
        ref={actionSheetRef}
        channel_id={channel_id}
      />
    </Container>
  );
};

export default DmDetailsScreen;
