import { canManageChannelWebhooks } from '@/lib/channel-webhook-permissions';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createGroupInfoStyles } from '@/theme/createScreenStyles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AddDescription } from '@/components/layout/channels/add-description';
import { useDataContext } from '@/store/useDataContext';
import { ACTIONS } from '@/store/types';
import moment from 'moment';
import Container from '@/components/layout/container';
import { ExitChannelSheet } from '@/components/layout/channels/exit-channel';
import RemoveMembersConfirmationModal from '@/components/layout/channels/remove-members-confirmation-modal';
import FastImage from 'react-native-fast-image';
import BuzzService from '@/services/buzz.service';
import { ShowNotify } from '@/components/ui/toast';
import { isVoiceMessageMedia } from '@/utils/voice-message';
import {
  decodeFileName,
  getFileTheme,
  isImageFile,
  isVideoFile,
} from '@/utils/file-helpers';
import { userCan } from '@/lib/role-permissions';
import { GetRequest, PostRequest } from '@/utils/requests';
import { MemberSearchInput } from '@/components/layout/chat/member-search-input';

const CHANNEL_USERS_PAGE_SIZE = 20;
const MEMBERS_SCROLL_LOAD_THRESHOLD = 200;

type ChannelMember = {
  user_id: string;
  username?: string;
  avatar_url?: string;
  default_avatar_url?: string;
  online?: boolean;
  is_admin?: boolean;
  full_name?: string;
  title?: string;
  email?: string;
  [key: string]: any;
};

const getChannelUserId = (item: any): string =>
  String(
    item?.user_id ??
      item?.id ??
      item?.profile?.user_id ??
      item?.profile?.id ??
      '',
  );

const normalizeChannelMember = (item: any): ChannelMember | null => {
  const userId = getChannelUserId(item);
  if (!userId) {
    return null;
  }

  const profile = item?.profile ?? item;

  return {
    ...item,
    ...profile,
    user_id: userId,
    username: profile?.username ?? item?.username,
    avatar_url: profile?.avatar_url ?? item?.avatar_url,
    default_avatar_url: profile?.default_avatar_url ?? item?.default_avatar_url,
    online: profile?.online ?? item?.online,
    is_admin: item?.is_admin ?? profile?.is_admin,
    full_name: profile?.full_name ?? item?.full_name,
    title: profile?.title ?? item?.title,
    email: profile?.email ?? item?.email,
  };
};

const mergeChannelMembers = (
  existing: ChannelMember[],
  incoming: ChannelMember[],
): ChannelMember[] => {
  const seen = new Set(existing.map(member => String(member.user_id)));
  const merged = [...existing];

  for (const member of incoming) {
    const id = String(member.user_id ?? '');
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push(member);
  }

  return merged;
};

const ChannelDetailsScreen = ({ navigation, route }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createGroupInfoStyles(colors), [colors]);
  const actionSheetRef = useRef<any>(null);
  const exitSheetRef = useRef<any>(null);
  const blockDescriptionSheetRef = useRef(false);
  const [callLoading, setCallLoading] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState('');
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersLoadingMore, setMembersLoadingMore] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const [membersHasMore, setMembersHasMore] = useState(false);
  const membersLoadMoreLockRef = useRef(false);
  const membersRequestIdRef = useRef(0);
  const membersStateRef = useRef({
    loading: true,
    loadingMore: false,
    hasMore: false,
    page: 1,
    search: '',
  });
  const { state, dispatch } = useDataContext();
  const { user, channelDetails, channelCallback } = state;
  const { channel_id } = route.params;

  const canRemovePeople = useMemo(
    () => userCan(state?.orgData, 'can_remove_people'),
    [state?.orgData],
  );

  const hasMemberSelection = selectedMemberIds.length > 0;

  const membersCount = useMemo(() => {
    const count =
      (channelDetails as any)?.user_count ??
      channelDetails?.users_count ??
      channelDetails?.members_count;
    return typeof count === 'number' ? count : members.length;
  }, [channelDetails, members.length]);

  const sortedMembers = useMemo(() => {
    return members
      .slice()
      .sort((a, b) =>
        a.user_id === user?.user_id ? -1 : b.user_id === user?.user_id ? 1 : 0,
      );
  }, [members, user?.user_id]);

  const fetchChannelMembers = useCallback(
    async (page: number, search: string, append: boolean) => {
      if (!channel_id) {
        return;
      }

      const requestId = ++membersRequestIdRef.current;

      if (append) {
        setMembersLoadingMore(true);
      } else {
        setMembersLoading(true);
      }

      const params = new URLSearchParams({
        page: String(page),
        limit: String(CHANNEL_USERS_PAGE_SIZE),
      });
      const trimmed = search.trim();
      if (trimmed) {
        params.set('search', trimmed);
      }

      const { data, error } = await GetRequest(
        `/channels/${channel_id}/users?${params.toString()}`,
      );

      if (requestId !== membersRequestIdRef.current) {
        return;
      }

      if (!error) {
        const incoming = (data?.data || [])
          .map(normalizeChannelMember)
          .filter(Boolean) as ChannelMember[];
        const pagination = data?.pagination;
        const currentPage = Number(pagination?.current_page) || page;
        const totalPages = Number(pagination?.total_pages) || 1;
        const hasMore = currentPage < totalPages && incoming.length > 0;

        setMembers(prev =>
          append ? mergeChannelMembers(prev, incoming) : incoming,
        );
        setMembersPage(currentPage);
        setMembersHasMore(hasMore);
      } else if (!append) {
        setMembers([]);
        setMembersHasMore(false);
      }

      setMembersLoading(false);
      setMembersLoadingMore(false);
    },
    [channel_id],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMemberSearch(memberSearchQuery.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [memberSearchQuery]);

  useEffect(() => {
    setMembers([]);
    setMembersPage(1);
    setMembersHasMore(false);
    setSelectedMemberIds([]);
    fetchChannelMembers(1, debouncedMemberSearch, false);
  }, [channel_id, channelCallback, debouncedMemberSearch, fetchChannelMembers]);

  membersStateRef.current = {
    loading: membersLoading,
    loadingMore: membersLoadingMore,
    hasMore: membersHasMore,
    page: membersPage,
    search: debouncedMemberSearch,
  };

  const loadMoreMembers = useCallback(() => {
    const current = membersStateRef.current;
    if (
      membersLoadMoreLockRef.current ||
      current.loading ||
      current.loadingMore ||
      !current.hasMore
    ) {
      return;
    }

    membersLoadMoreLockRef.current = true;
    void fetchChannelMembers(current.page + 1, current.search, true).finally(
      () => {
        membersLoadMoreLockRef.current = false;
      },
    );
  }, [fetchChannelMembers]);

  const handleMembersScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;

    if (distanceFromBottom < MEMBERS_SCROLL_LOAD_THRESHOLD) {
      loadMoreMembers();
    }
  };

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

  const toggleMemberSelection = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId],
    );
  };

  const clearMemberSelection = () => {
    setSelectedMemberIds([]);
  };

  const removeSelectedMembers = async () => {
    if (!selectedMemberIds.length || removeLoading) {
      return;
    }

    setRemoveLoading(true);

    const { error } = await PostRequest('/channels/remove-multiple', {
      channel_id,
      user_ids: selectedMemberIds,
    });

    setRemoveLoading(false);

    if (error) {
      ShowNotify('Error', error);
      return;
    }

    setRemoveModalVisible(false);
    clearMemberSelection();
    dispatch({ type: ACTIONS.CHANNEL_CALLBACK, payload: !channelCallback });
    ShowNotify('Success', 'Members removed from channel');
  };

  const confirmRemoveSelectedMembers = () => {
    if (!selectedMemberIds.length) {
      return;
    }

    setRemoveModalVisible(true);
  };

  const openDescriptionSheet = () => {
    if (blockDescriptionSheetRef.current) {
      return;
    }
    actionSheetRef.current?.expand();
  };

  const closeDescriptionSheet = () => {
    blockDescriptionSheetRef.current = true;
    actionSheetRef.current?.close();
    setTimeout(() => {
      blockDescriptionSheetRef.current = false;
    }, 400);
  };

  const addNewMembers = () => {
    navigation.navigate('ChannelStack', {
      screen: 'AddNewMembers',
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.iconDefault} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={handleMembersScroll}
        scrollEventThrottle={400}
        contentContainerStyle={
          hasMemberSelection ? { paddingBottom: 96 } : undefined
        }
      >
        {/* Group Avatar and Info */}
        <View style={styles.groupInfoContainer}>
          <View style={styles.avatarStack}>
            {channelDetails?.participants
              ?.slice(0, 3)
              .map((item, index: number) => (
                <Image
                  key={item.user_id || index}
                  source={
                    item.avatar_url
                      ? { uri: item.avatar_url }
                      : require('@/assets/images/user.png')
                  }
                  style={[
                    styles.stackItem,
                    index > 0 && styles.stackOver,
                    { zIndex: index + 1 },
                  ]}
                />
              ))}

            <View style={styles.avatarBadge}>
              <AppText size={10} style={{ color: 'white' }}>
                {channelDetails?.participants?.length}
              </AppText>
            </View>
          </View>
          <AppText variant="bold" style={styles.groupName} numberOfLines={2}>
            {channelDetails?.name ? `#${channelDetails.name}` : ''}
          </AppText>
          <AppText
            size={13}
            style={{ color: colors.messageMeta, marginTop: 4 }}
          >
            Channel · {channelDetails?.participants?.length} members
          </AppText>

          {/* Quick Actions Buttons */}
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

        {/* Group Description Section */}
        <TouchableOpacity
          style={styles.sectionPadding}
          onPress={openDescriptionSheet}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <>
              {channelDetails?.description ? (
                <AppText style={{ color: colors.primary, marginBottom: 5 }}>
                  {channelDetails?.description}
                </AppText>
              ) : (
                <AppText style={{ color: colors.primary, marginBottom: 5 }}>
                  Add channel description
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
            Created {moment(channelDetails?.created_at).format('LL')}
          </AppText>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Media Scroll Section */}
        {channelDetails?.preview_media?.length !== 0 && (
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
                  {channelDetails?.preview_media?.length}
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
              {channelDetails?.preview_media?.map(
                (item: any, index: number) => {
                  const isImage = isImageFile(item);
                  const isAudio = isVoiceMessageMedia(item);
                  const isVideo = !isAudio && isVideoFile(item);
                  const isFile = item && !isImage && !isVideo && !isAudio;

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
                          <Ionicons
                            name="play"
                            size={20}
                            color={colors.white}
                          />
                        </View>
                      </View>
                    );
                  }

                  if (isFile) {
                    const theme = getFileTheme(
                      decodeFileName(item.file_name),
                      item.file_type,
                    );

                    return (
                      <View
                        key={index}
                        style={[
                          styles.mediaThumb,
                          {
                            backgroundColor: `${theme.color}18`,
                            justifyContent: 'center',
                            alignItems: 'center',
                          },
                        ]}
                      >
                        <Ionicons
                          name={theme.icon}
                          size={28}
                          color={theme.color}
                        />
                        <AppText
                          size={8}
                          numberOfLines={1}
                          style={{
                            position: 'absolute',
                            bottom: 5,
                            paddingHorizontal: 5,
                            color: theme.color,
                          }}
                        >
                          {theme.label}
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
                },
              )}
            </ScrollView>
          </View>
        )}

        <View style={styles.divider} />

        {/* Settings Actions */}
        {canManageChannelWebhooks(state.orgData) && (
          <ActionItem
            icon="code-slash-outline"
            label="Webhooks"
            onPress={() =>
              navigation.navigate('ChannelWebhook', { channel_id })
            }
          />
        )}
        <ActionItem
          icon="notifications-outline"
          label="Notifications"
          subLabel="All"
          onPress={() =>
            navigation.navigate('NotificationPreference', {
              channel_id,
              channelName: channelDetails?.name || 'Channel',
            })
          }
        />
        <ActionItem
          icon="image-outline"
          label="Media Visibility"
          onPress={() =>
            navigation.navigate('MediaGalleryScreen', { channel_id })
          }
        />

        <View style={styles.divider} />

        {/* Members List Section */}
        <View style={styles.sectionPadding}>
          <View style={styles.sectionHeader}>
            <AppText size={13} style={{ color: colors.messageMeta }}>
              {membersCount} members
            </AppText>
            {canRemovePeople && hasMemberSelection ? (
              <TouchableOpacity onPress={clearMemberSelection}>
                <AppText size={13} style={{ color: colors.primary }}>
                  Clear
                </AppText>
              </TouchableOpacity>
            ) : (
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
            )}
          </View>

          {memberSearchOpen ? (
            <MemberSearchInput
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
              placeholder="Search members"
            />
          ) : null}

          {canRemovePeople && (
            <AppText
              size={12}
              style={{ color: colors.messageMeta, marginBottom: 12 }}
            >
              Select members to remove from the channel
            </AppText>
          )}

          <TouchableOpacity style={styles.memberRow} onPress={addNewMembers}>
            <View style={styles.addMemberIcon}>
              <Ionicons name="people" size={20} color={colors.white} />
            </View>
            <AppText style={{ flex: 1, marginLeft: 15 }}>Add members</AppText>
          </TouchableOpacity>

          {membersLoading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          {!membersLoading &&
          memberSearchQuery.trim() &&
          sortedMembers.length === 0 ? (
            <AppText size={13} style={{ color: colors.messageMeta }}>
              No members found
            </AppText>
          ) : null}

          {!membersLoading &&
            sortedMembers.map(item => {
              const isCurrentUser = item.user_id === user?.user_id;
              const isSelected = selectedMemberIds.includes(item.user_id);
              const showRemoveCheckbox = canRemovePeople && !isCurrentUser;

              return (
                <View key={item.user_id} style={styles.memberRow}>
                  {showRemoveCheckbox && (
                    <TouchableOpacity
                      style={styles.memberCheckboxBtn}
                      onPress={() => toggleMemberSelection(item.user_id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name={
                          isSelected
                            ? 'checkbox-marked'
                            : 'checkbox-blank-outline'
                        }
                        size={22}
                        color={isSelected ? colors.primary : colors.messageMeta}
                      />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                    onPress={() =>
                      navigation.replace('UserDetails', {
                        participant: item,
                        channel_id,
                      })
                    }
                  >
                    {item.avatar_url || item.default_avatar_url ? (
                      <Image
                        source={{
                          uri: item.avatar_url || item.default_avatar_url,
                        }}
                        style={styles.memberAvatar}
                      />
                    ) : (
                      <Image
                        source={require('@/assets/images/user.png')}
                        style={styles.memberAvatar}
                      />
                    )}

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
                          Administrator
                        </AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

          {membersLoadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* Danger Zone Actions */}
        {/* <ActionItem icon="star-outline" label="Add to Favourites"/> */}
        <ActionItem
          icon="log-out-outline"
          label="Leave Channel"
          color={colors.error}
          onPress={() => exitSheetRef.current?.expand()}
        />
        {/* <ActionItem icon="thumbs-down-outline" label="Report Group" color={colors.error} /> */}

        <View style={{ height: 60 }} />
      </ScrollView>

      {canRemovePeople && hasMemberSelection && (
        <View style={styles.removeMembersBar}>
          <AppText size={14} style={styles.removeMembersCount}>
            {selectedMemberIds.length} selected
          </AppText>
          <TouchableOpacity
            style={styles.removeMembersBtn}
            onPress={confirmRemoveSelectedMembers}
          >
            <Ionicons
              name="person-remove-outline"
              size={18}
              color={colors.white}
            />
            <AppText
              variant="bold"
              size={14}
              style={styles.removeMembersBtnText}
            >
              Remove
            </AppText>
          </TouchableOpacity>
        </View>
      )}

      <AddDescription
        onClose={closeDescriptionSheet}
        ref={actionSheetRef}
        channel_id={channel_id}
      />
      <ExitChannelSheet
        ref={exitSheetRef}
        onClose={() => exitSheetRef.current?.close()}
        channel_id={channel_id}
        groupName={channelDetails?.name as string}
      />
      <RemoveMembersConfirmationModal
        visible={removeModalVisible}
        memberCount={selectedMemberIds.length}
        loading={removeLoading}
        onClose={() => setRemoveModalVisible(false)}
        onConfirm={removeSelectedMembers}
      />
    </Container>
  );
};

export default ChannelDetailsScreen;
