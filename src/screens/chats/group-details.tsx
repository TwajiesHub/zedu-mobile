import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createGroupInfoStyles } from '@/theme/createScreenStyles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AddDescription } from '@/components/layout/group-chat/add-description';
import { useDataContext } from '@/store/useDataContext';
import moment from 'moment';
import { PostRequest } from '@/utils/requests';
import { ACTIONS } from '@/store/types';
import Container from '@/components/layout/container';
import { ExitGroupSheet } from '@/components/layout/group-chat/exit-group';
import BuzzService from '@/services/buzz.service';
import { ShowNotify } from '@/components/ui/toast';
import { MemberSearchInput } from '@/components/layout/chat/member-search-input';
import { filterParticipantsBySearch } from '@/utils/participant-search';

const getFileExtension = (fileName: string): string => {
  if (!fileName) return '';
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return ext;
};

const isAudioFile = (mime: string, fileName: string) => {
  const mimeType = (mime || '').toLowerCase();
  const type = getFileExtension(fileName);
  const audioExtensions = ['wav', 'mp3', 'm4a', 'ogg', 'aac'];
  return audioExtensions.includes(type) || mimeType.startsWith('audio/');
};

const isVideoFile = (mime: string, fileName: string) => {
  if (!mime && !fileName) return false;
  const mimeType = (mime || '').toLowerCase();
  const type = getFileExtension(fileName);
  const videoExtensions = ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm'];
  // Video if extension matches AND it's not audio
  if (videoExtensions.includes(type) && !isAudioFile(mime, fileName))
    return true;
  // Or if mime type is video (and not audio)
  if (mimeType.startsWith('video') && !isAudioFile(mime, fileName)) return true;
  return false;
};

const isImageFile = (mime: string, fileName: string) => {
  const mimeType = (mime || '').toLowerCase();
  const type = getFileExtension(fileName);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
  return imageExtensions.includes(type) || mimeType.startsWith('image/');
};

const isDocFile = (mime: string, fileName: string) => {
  const mimeType = (mime || '').toLowerCase();
  const type = getFileExtension(fileName);
  return mimeType.includes('pdf') || type === 'pdf';
};

const GroupDetailsScreen = ({ navigation, route }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createGroupInfoStyles(colors), [colors]);
  const actionSheetRef = useRef<any>(null);
  const exitSheetRef = useRef<any>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const { state, dispatch } = useDataContext();
  const { user, groupDetails, orgId, groupCallback } = state;
  const { channel_id } = route.params;

  const sortedParticipants = useMemo(() => {
    return (groupDetails?.participants || [])
      .slice()
      .sort((a, b) =>
        a.user_id === user?.user_id ? -1 : b.user_id === user?.user_id ? 1 : 0,
      );
  }, [groupDetails?.participants, user?.user_id]);

  const filteredParticipants = useMemo(
    () => filterParticipantsBySearch(sortedParticipants, memberSearchQuery),
    [sortedParticipants, memberSearchQuery],
  );

  const closeMemberSearch = () => {
    setMemberSearchOpen(false);
    setMemberSearchQuery('');
  };

  const toggleMemberSearch = () => {
    if (memberSearchOpen) {
      closeMemberSearch();
      return;
    }
    setMemberSearchOpen(true);
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

  const addNewMembers = () => {
    navigation.navigate('ChatStack', {
      screen: 'GroupAddNewMembers',
      params: { channel_id: channel_id },
    });
  };

  const handleVideoCall = async () => {
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
      const result = await BuzzService.createBuzz();

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

  const ActionItem = ({
    icon,
    label,
    color = colors.textPrimary,
    subLabel,
    showChevron = false,
    onPress,
  }: any) => (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <View style={styles.actionLeading}>
        <Ionicons name={icon} size={22} color={colors.messageMeta} />
        <View style={styles.actionTextContainer}>
          <AppText style={[styles.actionLabel, { color }]}>{label}</AppText>
          {subLabel && (
            <AppText size={12} style={{ color: colors.messageMeta }}>
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.iconDefault} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.groupInfoContainer}>
          <View style={styles.avatarStack}>
            {groupDetails?.participants
              ?.slice(0, 3)
              .map((item, index: number) => (
                <FastImage
                  key={item.user_id || index}
                  source={{
                    uri: item.avatar_url
                      ? item.avatar_url
                      : item.default_avatar_url,
                  }}
                  style={[
                    styles.stackItem,
                    index > 0 && styles.stackOver,
                    { zIndex: index + 1 },
                  ]}
                  resizeMode={FastImage.resizeMode.cover}
                />
              ))}

            <View style={styles.avatarBadge}>
              <AppText size={10} style={{ color: 'white' }}>
                {groupDetails?.participants.length}
              </AppText>
            </View>
          </View>
          <AppText variant="bold" style={styles.groupName}>
            {groupDetails?.participants.map(p => p.username).join(', ')}
          </AppText>
          <AppText
            size={13}
            style={{ color: colors.messageMeta, marginTop: 4 }}
          >
            Group · {groupDetails?.participants?.length} members
          </AppText>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleVideoCall}
            >
              <View style={styles.iconCircle}>
                {callLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons
                    name="videocam-outline"
                    size={22}
                    color={colors.primary}
                  />
                )}
              </View>
              <AppText size={12}>Buzz</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={addNewMembers}
            >
              <View style={styles.iconCircle}>
                <Ionicons
                  name="person-add-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <AppText size={12}>Add</AppText>
            </TouchableOpacity>

            {/* <TouchableOpacity style={styles.quickActionBtn}>
                            <View style={styles.iconCircle}><Ionicons name="search-outline" size={22} color={colors.primary} /></View>
                            <AppText size={12}>Search</AppText>
                        </TouchableOpacity> */}
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.sectionPadding}
          onPress={() => actionSheetRef.current?.expand()}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <>
              {groupDetails?.group_description ? (
                <AppText style={{ color: colors.primary, marginBottom: 5 }}>
                  {groupDetails?.group_description}
                </AppText>
              ) : (
                <AppText style={{ color: colors.primary, marginBottom: 5 }}>
                  Add group description
                </AppText>
              )}
            </>

            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.messageMeta}
            />
          </View>
          <AppText size={12} style={{ color: colors.messageMeta }}>
            Created {moment(groupDetails?.created_at).format('LL')}
          </AppText>
        </TouchableOpacity>

        <View style={styles.divider} />

        {groupDetails?.preview_media?.length !== 0 && (
          <View style={styles.sectionPadding}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() =>
                navigation.navigate('MediaGalleryScreen', { channel_id })
              }
            >
              <AppText size={13} style={{ color: colors.messageMeta }}>
                Media links, and docs
              </AppText>
              <View style={styles.mediaCount}>
                <AppText size={12} style={{ color: colors.messageMeta }}>
                  {groupDetails?.preview_media?.length}
                </AppText>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.messageMeta}
                />
              </View>
            </TouchableOpacity>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mediaScroll}
            >
              {groupDetails?.preview_media?.map((item: any, index: number) => {
                const isImage = isImageFile(item.mime_type, item.file_name);
                const isVideo = isVideoFile(item.mime_type, item.file_name);
                const isAudio = isAudioFile(item.mime_type, item.file_name);
                const isDoc = isDocFile(item.mime_type, item.file_name);

                if (isAudio) {
                  return (
                    <View
                      key={index}
                      style={[
                        styles.mediaThumb,
                        {
                          backgroundColor: colors.reactionBackground,
                          justifyContent: 'center',
                          alignItems: 'center',
                        },
                      ]}
                    >
                      <Ionicons
                        name="musical-note"
                        size={28}
                        color={colors.primary}
                      />
                    </View>
                  );
                }

                if (isVideo) {
                  return (
                    <View key={index} style={styles.videoWrapper}>
                      <View
                        style={[
                          styles.mediaThumb,
                          { backgroundColor: colors.textPrimary },
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
                          backgroundColor: colors.surfaceElevated,
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

        {/* <ActionItem icon="notifications-outline" label="Notifications" subLabel="All" /> */}
        <ActionItem
          icon="image-outline"
          label="Media Visibility"
          onPress={() =>
            navigation.navigate('MediaGalleryScreen', { channel_id })
          }
        />

        <View style={styles.divider} />

        <View style={styles.sectionPadding}>
          <View style={styles.sectionHeader}>
            <AppText size={13} style={{ color: colors.messageMeta }}>
              {groupDetails?.participants?.length} members
            </AppText>
            <TouchableOpacity
              onPress={toggleMemberSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={memberSearchOpen ? 'close-outline' : 'search-outline'}
                size={18}
                color={colors.messageMeta}
              />
            </TouchableOpacity>
          </View>

          {memberSearchOpen ? (
            <MemberSearchInput
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
              placeholder="Search members"
            />
          ) : null}

          <TouchableOpacity style={styles.memberRow} onPress={addNewMembers}>
            <View style={styles.addMemberIcon}>
              <Ionicons name="people" size={20} color={colors.white} />
            </View>
            <AppText style={{ flex: 1, marginLeft: 15 }}>Add members</AppText>
          </TouchableOpacity>

          {memberSearchQuery.trim() && filteredParticipants.length === 0 ? (
            <AppText size={13} style={{ color: colors.messageMeta }}>
              No members found
            </AppText>
          ) : null}

          {filteredParticipants.map(item => {
            const isCurrentUser = item.user_id === user?.user_id;
            return (
              <TouchableOpacity
                key={item.user_id}
                style={styles.memberRow}
                onPress={() =>
                  !isCurrentUser &&
                  navigation.navigate('GroupUserDetailScreen', {
                    participant: item,
                    channel_id,
                  })
                }
              >
                <FastImage
                  source={{ uri: item.avatar_url || item.default_avatar_url }}
                  style={styles.memberAvatar}
                  resizeMode={FastImage.resizeMode.cover}
                />

                <View style={styles.memberInfo}>
                  <AppText
                    variant="bold"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {isCurrentUser ? 'You' : item.username}
                  </AppText>
                  <AppText
                    size={12}
                    style={{
                      color: item.online ? colors.online : colors.offline,
                    }}
                  >
                    {item.online ? 'Active' : 'Away'}
                  </AppText>
                </View>

                {item.is_admin && (
                  <View style={styles.adminBadge}>
                    <AppText size={10} style={{ color: colors.primary }}>
                      Group Admin
                    </AppText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider} />

        <ActionItem
          icon={groupDetails?.is_favourite ? 'star' : 'star-outline'}
          label={
            groupDetails?.is_favourite
              ? 'Remove from Favorites'
              : 'Add to Favorites'
          }
          color={groupDetails?.is_favourite ? colors.error : colors.primary}
          onPress={favorites}
        />
        <ActionItem
          icon="log-out-outline"
          label="Exit group"
          color={colors.error}
          onPress={() => exitSheetRef.current?.expand()}
        />

        <View style={{ height: 60 }} />
      </ScrollView>

      <AddDescription
        onClose={() => actionSheetRef.current?.close()}
        ref={actionSheetRef}
        channel_id={channel_id}
      />

      <ExitGroupSheet
        ref={exitSheetRef}
        onClose={() => exitSheetRef.current?.close()}
        channel_id={channel_id}
        groupName={
          groupDetails?.participants?.map(p => p.username).join(', ') || 'this'
        }
      />
    </Container>
  );
};

export default GroupDetailsScreen;
