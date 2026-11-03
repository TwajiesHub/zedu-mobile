import React, { useState, useMemo } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemedRefreshControl } from '@/components/ui/themed-refresh-control';
import { AppText } from '@/components/ui/text';
import { normalize } from '@/utils/normalize';
import Container from '@/components/layout/container';
import { useTheme } from '@/theme/ThemeProvider';
import { createChatListStyles } from '@/theme/createChatListStyles';
import { AppPopover } from '@/components/layout/popover';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useDataContext } from '@/store/useDataContext';
import { useDMs } from '@/services/chat/chat-lists';
import moment from 'moment';
import ChatSkeleton from '@/components/skeleton/chat-skeleton';
import { Chat } from '@/types/chats';
import { ACTIONS } from '@/store/types';
import UseGetOrg from '@/services/org/get-org';
import GeneralNotificationConnection from '@/centrifugoo/general-notification-connection';
import { PostRequest } from '@/utils/requests';
import { RootStackParamList } from '@/navigation/navigator';
import { UserAvatarWithStatus } from '@/components/ui/user-avatar-with-status';
import useShareZeduPrompt from '@/hooks/useShareZeduPrompt';
import { getChatListPreview } from '@/utils/message-text';
import { UserAvatar } from '@/screens/channels/user-avatar';

const HomeScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const styles = useMemo(() => createChatListStyles(colors), [colors]);
  const { state, dispatch } = useDataContext();
  const { user, orgData, orgId, dms } = state;
  useShareZeduPrompt(user?.user_id || user?.id);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [_chatLoading, setChatLoading] = useState(false);
  const { loading, loadingMore, refresh, loadMore } = useDMs(orgId, search);

  const totalUnreadCount =
    dms?.filter((i: Chat) => i.thread_count > 0).length || 0;
  const groupCount =
    dms?.filter((i: Chat) => i.channel_type !== 'dm').length || 0;

  const CATEGORY_LIST = [
    { id: 'All', label: 'All' },
    { id: 'Unread', label: `Unread  ${totalUnreadCount}` },
    { id: 'Groups', label: `Groups  ${groupCount}` },
    { id: 'Favorites', label: 'Favorites' },
  ];

  const filteredDms = useMemo(() => {
    if (!dms) return [];
    switch (activeCategory) {
      case 'Unread':
        return dms.filter((chat: Chat) => chat.thread_count > 0);
      case 'Groups':
        return dms.filter((chat: Chat) => chat.channel_type !== 'dm');
      case 'Favorites':
        return dms.filter((chat: Chat) => chat?.is_favourite);
      default:
        return dms;
    }
  }, [dms, activeCategory]);

  const handleNavigate = (props: Chat) => {
    if (props?.channel_type === 'dm') {
      dispatch({ type: ACTIONS.PARTICIPANT, payload: props.participants });
      dispatch({
        type: ACTIONS.DMS_CHAT,
        payload: { data: props.preview_thread, page: 1 },
      });

      navigation.navigate('ChatStack', {
        screen: 'ChatDetails',
        params: {
          participant_id: props?.participant_id,
          channel_id: props?.channel_id,
          // Captured before the count is reset so the chat can mark new messages.
          unread_count: props?.thread_count || 0,
        },
      });
    } else {
      dispatch({ type: ACTIONS.PARTICIPANT, payload: props.participants });
      dispatch({
        type: ACTIONS.DMS_CHAT,
        payload: { data: props.preview_thread, page: 1 },
      });

      navigation.navigate('ChatStack', {
        screen: 'GroupChatDetails',
        params: {
          channel_id: props?.channel_id,
        },
      });
    }

    if (props?.thread_count > 0) {
      dispatch({
        type: ACTIONS.RESET_DM_THREAD_COUNT,
        payload: props?.channel_id,
      });
    }
    dispatch({ type: ACTIONS.CALLBACK, payload: !state?.callback });
  };

  const handleSuggestNavigate = async (props: Chat) => {
    setChatLoading(true);

    const firstPayload = {
      chat_type: 'user',
      participant_id: props?.participant_id,
    };

    const { data, error } = await PostRequest(
      `/organisations/${orgId}/dms`,
      firstPayload,
    );

    if (!error) {
      dispatch({ type: ACTIONS.PARTICIPANT, payload: data.data.participants });
      dispatch({ type: ACTIONS.DMS_CHAT, payload: { data: [], page: 1 } });
      navigation.navigate('ChatStack', {
        screen: 'ChatDetails',
        params: {
          participant_id: props?.participant_id,
          channel_id: data?.data?.channel_id,
        },
      });
    } else {
      setChatLoading(false);
    }
  };

  return (
    <Container color={colors.secondary} dark={true}>
      <GeneralNotificationConnection />
      <UseGetOrg />
      <View style={styles.topHeader}>
        <View style={styles.profileTop}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            onPress={() => navigation.openDrawer()}
          >
            {orgData?.logo_url ? (
              <Image
                source={{ uri: orgData?.logo_url }}
                style={styles.orgPic}
              />
            ) : (
              <View style={[styles.orgPic, styles.avatarPlaceholder]}>
                <AppText variant="bold" size={16} style={{ color: 'white' }}>
                  {orgData?.name?.charAt(0).toUpperCase()}
                </AppText>
              </View>
            )}
            <AppText variant="bold" size={16} style={{ color: 'white' }}>
              {orgData?.name}
            </AppText>
          </TouchableOpacity>

          <UserAvatarWithStatus user={user} badgeRingColor={colors.secondary} />
        </View>

        <View style={styles.searchBar}>
          <Image
            source={require('@/assets/icons/search.png')}
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Find a conversation"
            placeholderTextColor={colors.white}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
          {loading && search.length > 0 && (
            <ActivityIndicator size="small" color={colors.white} />
          )}
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.searchClear}
            >
              <Ionicons name="close-circle" size={18} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORY_LIST.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[
                styles.categoryBtn,
                activeCategory === cat.id && styles.activeCategoryBtn,
              ]}
            >
              <AppText
                size={13}
                variant="medium"
                style={{
                  color:
                    activeCategory === cat.id ? colors.white : colors.textMuted,
                }}
              >
                {cat.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ScrollView
          style={{
            paddingHorizontal: normalize(20),
            paddingTop: normalize(20),
          }}
          showsVerticalScrollIndicator={false}
        >
          {[1, 2, 3, 4, 5, 6].map(key => (
            <ChatSkeleton key={key} />
          ))}
        </ScrollView>
      ) : (
        <>
          {!loading && filteredDms?.length === 0 ? (
            <ScrollView
              refreshControl={
                <ThemedRefreshControl refreshing={false} onRefresh={refresh} />
              }
              contentContainerStyle={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Image
                source={require('@/assets/images/empty-chat.png')}
                style={{
                  objectFit: 'contain',
                  height: normalize(50),
                  marginTop: -200,
                }}
              />
            </ScrollView>
          ) : (
            <FlatList
              data={filteredDms}
              keyExtractor={item => item.channel_id || item.participant_id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isDM = item.channel_type === 'dm';
                const participant = isDM ? item.participants?.[0] : null;
                const otherUser =
                  item.participants?.find(p => p.user_id !== user?.user_id) ??
                  participant;
                const isOtherUserOnline = Boolean(otherUser?.online);

                const handleAvatarPress = () => {
                  if (!isDM || !participant) return;
                  navigation.navigate('ChatStack', {
                    screen: 'UserDetailScreen',
                    params: {
                      participant,
                      channel_id: item.channel_id,
                    },
                  });
                };

                const handleChatPress = () => {
                  if (item.is_suggested) {
                    handleSuggestNavigate(item);
                  } else {
                    handleNavigate(item);
                  }
                };

                return (
                  <View style={styles.chatItem}>
                    {isDM && participant ? (
                      <TouchableOpacity
                        style={styles.avatarWrapper}
                        onPress={handleAvatarPress}
                        activeOpacity={0.7}
                        accessibilityLabel={`View ${
                          participant.username
                        }'s profile, ${
                          isOtherUserOnline ? 'online' : 'offline'
                        }`}
                        accessibilityRole="button"
                        accessibilityHint="Opens user profile"
                      >
                        <UserAvatar
                          user={{
                            avatar_url: item.avatar_url,
                            default_avatar_url: item.default_avatar_url,
                            online: isOtherUserOnline,
                          }}
                          size={45}
                          badgeSize={12}
                          badgeRingColor={colors.background}
                          fallbackName={item.username}
                          disabled
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.avatarWrapper}>
                        {item.channel_type === 'group_dm' ? (
                          <View style={styles.groupAvatarContainer}>
                            {item.participants
                              ?.slice(0, 3)
                              .map((p: any, index: number) => (
                                <Image
                                  key={p.user_id || index}
                                  source={{
                                    uri: p.avatar_url || p.default_avatar_url,
                                  }}
                                  style={[
                                    styles.groupAvatarItem,
                                    index === 0 && styles.groupAvatarMain,
                                    index === 1 && styles.groupAvatarTopRight,
                                    index === 2 &&
                                      styles.groupAvatarBottomRight,
                                  ]}
                                />
                              ))}
                          </View>
                        ) : (
                          <Image
                            source={{
                              uri: item.avatar_url || item.default_avatar_url,
                            }}
                            style={styles.chatAvatar}
                          />
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.chatInfo}
                      onPress={handleChatPress}
                      activeOpacity={0.7}
                      accessibilityLabel={
                        isDM
                          ? `Open chat with ${item.username}`
                          : `Open group chat ${item.username}`
                      }
                      accessibilityRole="button"
                      accessibilityHint={
                        isDM ? 'Opens conversation' : 'Opens group conversation'
                      }
                    >
                      <View style={styles.chatHeaderRow}>
                        <AppText
                          variant="bold"
                          size={14}
                          numberOfLines={1}
                          style={styles.chatName}
                        >
                          {item.username}
                        </AppText>
                        <AppText size={12} style={styles.chatTime}>
                          {moment(item.last_read_at).calendar(null, {
                            sameDay: 'h:mm a',
                            lastDay: '[Yesterday]',
                            lastWeek: 'dddd',
                            sameElse: 'DD/MM/YYYY',
                          })}
                        </AppText>
                      </View>

                      <View style={styles.chatFooterRow}>
                        <AppText
                          size={14}
                          numberOfLines={1}
                          style={styles.chatMsg}
                        >
                          {getChatListPreview(item) || 'Chat with user'}
                        </AppText>
                        {!!item.thread_count && item.thread_count > 0 && (
                          <View style={styles.countBadge}>
                            <AppText
                              size={12}
                              variant="bold"
                              style={styles.countText}
                            >
                              {item.thread_count}
                            </AppText>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }}
              onEndReached={loadMore}
              onEndReachedThreshold={0.1}
              refreshControl={
                <ThemedRefreshControl
                  refreshing={loading && dms.length > 0}
                  onRefresh={refresh}
                />
              }
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator
                    color={colors.primary}
                    style={{ marginVertical: 20 }}
                  />
                ) : null
              }
            />
          )}
        </>
      )}
      <AppPopover />
    </Container>
  );
};

export default HomeScreen;
