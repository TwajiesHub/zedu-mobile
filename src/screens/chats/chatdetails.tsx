import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { AppText } from '@/components/ui/text';
import Container from '@/components/layout/container';
import { useTheme } from '@/theme/ThemeProvider';
import { launchCamera } from 'react-native-image-picker';
import { ThemedEmojiKeyboard } from '@/components/ui/themed-emoji-keyboard';
import MessageItem, {
  MessageAvatarUser,
} from '@/components/layout/chat/messagItem';
import MentionUserBottomSheet, {
  MentionUserBottomSheetRef,
} from '@/components/layout/chat/mention-user-bottomsheet';
import ChatInput from '@/components/layout/chat/chat-input';
import ChatKeyboardAvoidingView from '@/components/layout/chat/chat-keyboard-avoiding-view';
import { useTyping } from '@/hooks/useTyping';
import { MessageAction } from '@/components/layout/chat/message-action';
import { MediaPickerSheet } from '@/components/layout/chat/media-picker';
import MediaEditorModal from '@/components/layout/chat/media-editor';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { ChatStackParamList } from '@/navigation/stacks/chats';
import { GetRequest, PostRequest, PutRequest } from '@/utils/requests';
import { useDataContext } from '@/store/useDataContext';
import { ChatItem } from '@/types/chats';
import UseChatDetails from '@/services/chat/chat-details';
import DMConnection from '@/centrifugoo/dm-connection';
import uuid from 'react-native-uuid';
import { ACTIONS } from '@/store/types';
import { useFileUpload } from '@/hooks/useFileUpload';
import UseGroupDetails from '@/services/chat/group-details';
import { MentionSheet } from '@/components/layout/chat/mention-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BuzzService from '@/services/buzz.service';
import { ShowNotify } from '@/components/ui/toast';
import { buildMessageHtml, getPlainMessageText } from '@/utils/message-text';
import { createChatDetailStyles } from '@/theme/createScreenStyles';
import ChatBackground from '@/components/layout/chat/chat-background';
import { useMessageDraft } from '@/hooks/useMessageDraft';
import { StartBuzzConfirmationModal } from '@/components/layout/chat/start-buzz-confirmation-modal';
import {
  cancelPinnedScrollJumps,
  consumePendingPinJump,
  createScrollToIndexFailedHandler,
  ensurePinnedThreadLoaded,
  ensureThreadIdLoaded,
  findMessageIndexByPreview,
  findPinnedMessageIndex,
  findThreadIndex,
  getPinnedJumpTarget,
  isChatRowHighlighted,
  recordChatItemHeight,
  runAfterPinNavReturn,
  scrollChatToIndex,
} from '@/utils/scroll-to-pinned-message';
import type { ResolvedPin } from '@/utils/resolve-pinned-messages';
import { recordSuccessfulMessageResult } from '@/utils/share-zedu-prompt';
import {
  ChatScrollToBottomButton,
  useInvertedChatScrollToBottom,
} from '@/components/layout/chat/scroll-to-bottom';
import {
  ChatHeaderMenu,
  ChatHeaderSearchBar,
} from '@/components/layout/chat/chat-header-menu';
import { ChatSearchResults } from '@/components/layout/chat/chat-search-results';
import type { ChannelSearchHit } from '@/services/chat/channel-search';
import { UserAvatar } from '@/screens/channels/user-avatar';
import {
  getFirstUnreadMessageId,
  getSenderAvatarSlot,
} from '@/utils/chat-message-layout';

const ChatDetailScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createChatDetailStyles(colors), [colors]);
  const [message, setMessage] = useState('');
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pendingJumpIdRef = useRef<string | null>(null);
  const pinJumpLockRef = useRef(false);
  const dmsChatRef = useRef<any[]>([]);
  const {
    onScroll: onChatScroll,
    visible: showScrollToBottom,
    scrollToBottom,
  } = useInvertedChatScrollToBottom(flatListRef);
  const actionSheetRef = useRef<any>(null);
  const pickerSheetRef = useRef<any>(null);
  const [selectedMsg, setSelectedMsg] = useState<ChatItem | null>(null);
  const [pendingMedia, setPendingMedia] = useState<any>(null);
  const [isEditorVisible, setIsEditorVisible] = useState(false);

  // Mention State
  const [mentionState, setMentionState] = useState<{
    query: string;
    pos: number;
  } | null>(null);
  const [mentionsMetadata, setMentionsMetadata] = useState<any[]>([]);
  const [onEdit, setOnEdit] = useState(false);
  const [editMsgId, setEditMsgId] = useState<string | null>(null);
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mentionSheetUser, setMentionSheetUser] = useState<any | null>(null);
  const [buzzConfirmVisible, setBuzzConfirmVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { state, dispatch } = useDataContext();
  const { handleTyping } = useTyping(state.chatSubscription);
  const {
    dmsChat,
    user,
    participant,
    mentionUser,
    callback,
    singleDmsChat,
    singleParticipant,
    buzzIsMuted,
    buzzShowVideo,
    orgId,
  } = state;
  dmsChatRef.current = dmsChat || [];
  const route = useRoute<RouteProp<ChatStackParamList, 'ChatDetails'>>();
  const { channel_id, fromNotification, unread_count } = route.params ?? {};
  const participants = Array.isArray(participant) ? participant : [];
  const headerParticipant =
    participants.find(p => p.user_id !== user?.user_id) || participants[0];
  const { loadMore, isFetchingMore, isInitialLoading } = UseChatDetails({
    channel_id: channel_id || '',
  });
  // Unread count is captured by the Chats list before the chat is marked as
  // read; the marker is resolved once per visit so it stays put.
  const unreadSnapshot = useRef({ count: 0, resolved: false });
  const [newMarkerId, setNewMarkerId] = useState<string | null>(null);

  useEffect(() => {
    unreadSnapshot.current = { count: unread_count ?? 0, resolved: false };
    setNewMarkerId(null);
    // Only reset when the conversation changes, not when params are re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel_id]);

  useEffect(() => {
    const snapshot = unreadSnapshot.current;
    if (snapshot.resolved || isInitialLoading) return;
    snapshot.resolved = true;
    setNewMarkerId(
      getFirstUnreadMessageId(dmsChat, snapshot.count, user?.user_id),
    );
  }, [isInitialLoading, dmsChat, user?.user_id]);

  const scrolledToMarker = useRef<string | null>(null);
  useEffect(() => {
    if (!newMarkerId || scrolledToMarker.current === newMarkerId) return;
    const index = dmsChat.findIndex(
      (entry: any) => entry.thread_id === newMarkerId,
    );
    if (index < 0) return;
    scrolledToMarker.current = newMarkerId;
    // Inverted list: viewPosition near 1 puts the marker near the top of the
    // screen with the new messages below it; offsets clamp at the latest.
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index,
        viewPosition: 0.9,
        animated: false,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [newMarkerId, dmsChat]);

  // Avatar slot and user for every message, worked out once per message list
  // rather than on each row render.
  const messageAvatars = useMemo(
    () =>
      dmsChat.map((item: any, index: number) => ({
        slot: getSenderAvatarSlot(dmsChat, index),
        user: (item.user_id === user?.user_id
          ? {
              avatar_url: user?.avatar_url,
              default_avatar_url: user?.default_avatar_url,
              name: user?.full_name || user?.username,
            }
          : {
              avatar_url: item.avatar_url || headerParticipant?.avatar_url,
              default_avatar_url:
                item.default_avatar_url ||
                headerParticipant?.default_avatar_url,
              name:
                item.full_name || item.username || headerParticipant?.username,
            }) as MessageAvatarUser,
      })),
    [dmsChat, user, headerParticipant],
  );
  const { uploadFiles, clearUploads } = useFileUpload();
  const mentionUserSheetRef = useRef<MentionUserBottomSheetRef>(null);
  const [callLoading, setCallLoading] = useState(false);
  const _callbackRef = useRef(state?.callback);
  const [returnLoading, setReturnLoading] = useState(true);
  const suppressLoadMoreUntilRef = useRef(0);

  const handleLoadMore = useCallback(() => {
    if (Date.now() < suppressLoadMoreUntilRef.current) return;
    loadMore();
  }, [loadMore]);

  const { clearDraft, restoreDraft } = useMessageDraft({
    scope: 'dm',
    roomId: channel_id,
    orgId,
    userId: user?.user_id ?? user?.id,
    message,
    setMessage,
    mentions: mentionsMetadata,
    setMentions: setMentionsMetadata,
    enabled: !onEdit,
  });

  useEffect(() => {
    // dispatch({ type: ACTIONS.CALLBACK, payload: !callback });

    if (!fromNotification) {
      setReturnLoading(false);
      return;
    }

    if (!orgId || !channel_id) {
      return;
    }

    const getUser = async () => {
      const { data, error } = await GetRequest(
        `/organisations/${orgId}/dms/participants/${channel_id}`,
      );

      if (!error) {
        dispatch({
          type: ACTIONS.PARTICIPANT,
          payload: data?.data?.participants || [],
        });
      }
      setReturnLoading(false);
    };

    getUser();
  }, [channel_id, orgId, dispatch, fromNotification, callback]);

  const mentionParticipants = useMemo(
    () => (Array.isArray(participant) ? participant : []),
    [participant],
  );

  const handleMentionTrigger = (
    query: string,
    pos: number,
    trigger: '@' | '#' = '@',
  ) => {
    if (trigger === '#') return;
    setMentionState({ query, pos });
  };

  const [isVoiceUploading, setIsVoiceUploading] = useState(false);

  // Called immediately when the user stops recording — uploads in background
  const handleVoiceRecorded = async (uri: string) => {
    setIsVoiceUploading(true);
    const tempId = uuid.v4() as string;
    const asset = {
      uri,
      type: 'audio/m4a',
      name: uri.split('/').pop() || `voice_${tempId}`,
    };
    try {
      const response = await uploadFiles([asset]);
      if (response.data && response.data.length > 0) {
        dispatch({ type: ACTIONS.MEDIA, payload: response.data });
      } else {
        ShowNotify('Error', 'Voice upload failed');
      }
    } catch (_err) {
      ShowNotify('Error', 'Voice upload failed');
    } finally {
      setIsVoiceUploading(false);
    }
  };

  // Called when user presses send on the preview bar
  const handleVoiceSendReady = () => {
    handleSendMessage('', state.media);
  };

  // Called when user discards the preview
  const handleVoiceCancel = () => {
    dispatch({ type: ACTIONS.MEDIA, payload: [] });
    clearUploads();
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

    setBuzzConfirmVisible(false);
    setCallLoading(true);
    try {
      const result = await BuzzService.directBuzzCall(channel_id);

      if (result.error || !result.data) {
        ShowNotify('Error', result.error || 'Failed to create call');
        setCallLoading(false);
        return;
      }

      const joinResult = await BuzzService.joinBuzz(result.data.buzz_code);

      if (joinResult.error || !joinResult.data) {
        ShowNotify('Error', joinResult.error || 'Failed to join call');
        setCallLoading(false);
        return;
      }

      const buzzData = joinResult.data;

      const isMuted = buzzIsMuted ?? true;
      const showVideo = buzzShowVideo ?? false;
      const currentUserId = user?.user_id ?? user?.id;

      const participantsWithLocalMediaState = (buzzData.participants || []).map(
        (participant: any) => {
          const participantUserId = participant.user_id ?? participant.id;

          if (String(participantUserId) === String(currentUserId)) {
            return {
              ...participant,
              audioTrack: !isMuted,
              videoTrack: showVideo,
            };
          }

          return participant;
        },
      );

      dispatch({ type: ACTIONS.BUZZ_DATA, payload: buzzData });
      dispatch({
        type: ACTIONS.BUZZ_PARTICIPANTS,
        payload: participantsWithLocalMediaState,
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

  const requestStartBuzz = () => {
    const activeBuzzData = state?.buzzData;
    if (state?.isCallMinimized && activeBuzzData?.buzz_code) {
      void handleVideoCall();
      return;
    }
    setBuzzConfirmVisible(true);
  };

  const handleMentionSelect = (selectedUser: any) => {
    if (!mentionState) return;

    const { pos, query } = mentionState;
    const mentionStart = pos - query.length - 1;

    const textBefore = message.substring(0, mentionStart);
    const textAfter = message.substring(pos);

    const newMessage = `${textBefore}@${selectedUser.username} ${textAfter}`;

    setMessage(newMessage);

    setMentionsMetadata(prev => [
      ...prev,
      {
        id: selectedUser.user_id,
        label: selectedUser.username,
        type: 'user',
      },
    ]);

    setMentionState(null);
  };

  const handleSendMessage = async (content: string, medias: any[] = []) => {
    if (!content.trim() && medias.length === 0 && state.media.length === 0)
      return;

    handleTyping(false);

    const tempId = uuid.v4() as string;

    // Construct web-compatible HTML payload
    let formattedContent = content;
    mentionsMetadata.forEach(m => {
      const mentionTag = `<span class="mention" data-type="mention" data-id="${m.id}" data-label="${m.label}" data-mention-suggestion-char="@">@${m.label}</span>`;
      formattedContent = formattedContent.replace(`@${m.label}`, mentionTag);
    });

    const finalHtml = buildMessageHtml(formattedContent);

    const optimisticMessage = {
      channels_id: channel_id,
      thread_id: tempId,
      username: user?.username || 'You',
      avatar_url: user?.avatar_url,
      message: finalHtml,
      created_at: new Date().toISOString(),
      status: 'pending',
      type: 'message',
      media: state.media,
      user_id: user?.user_id,
      reactions: null,
      isOptimistic: true,
    };

    dispatch({
      type: ACTIONS.DMS_CHAT,
      payload: { newMessage: optimisticMessage },
    });
    setMessage('');
    setMentionsMetadata([]);
    void clearDraft();
    dispatch({ type: ACTIONS.MEDIA, payload: [] });

    const payload = {
      content: finalHtml,
      media: medias.length > 0 ? medias : state.media,
      mentions: mentionsMetadata,
    };

    const { error } = await PostRequest(
      `/dms/channels/${channel_id}/threads`,
      payload,
    );
    await recordSuccessfulMessageResult(
      state.user?.user_id || state.user?.id,
      error,
    );
    dispatch({ type: ACTIONS.CALLBACK, payload: !state.callback });
    clearUploads();
  };

  const handleSendEditMessage = async (content: string, medias: any[] = []) => {
    if (!content.trim() && medias.length === 0) return;

    handleTyping(false);

    const tempId = uuid.v4() as string;

    // Construct web-compatible HTML payload
    let formattedContent = content;
    mentionsMetadata.forEach(m => {
      const mentionTag = `<span class="mention" data-type="mention" data-id="${m.id}" data-label="${m.label}" data-mention-suggestion-char="@">@${m.label}</span>`;
      formattedContent = formattedContent.replace(`@${m.label}`, mentionTag);
    });

    const finalHtml = buildMessageHtml(formattedContent);

    const optimisticMessage = {
      channels_id: channel_id,
      thread_id: editMsgId || tempId,
      username: user?.username || 'You',
      avatar_url: user?.avatar_url,
      message: finalHtml,
      created_at: new Date().toISOString(),
      status: 'pending',
      type: 'message',
      media: state.media,
      user_id: user?.user_id,
      reactions: null,
      isOptimistic: true,
      edited: true,
    };

    dispatch({
      type: ACTIONS.EDIT_DM_CHAT,
      payload: {
        threadId: editMsgId || tempId,
        updatedMessage: optimisticMessage,
      },
    });
    dispatch({ type: ACTIONS.MEDIA, payload: [] });
    setOnEdit(false);
    void restoreDraft();

    const payload = {
      content: finalHtml,
      media: medias,
      mentions: mentionsMetadata,
    };

    await PutRequest(
      `/dms/thread/${editMsgId}/channels/${channel_id}`,
      payload,
    );

    dispatch({ type: ACTIONS.CALLBACK, payload: !state.callback });
    clearUploads();
  };

  const pickImage = async () => {
    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.6,
      maxWidth: 1024,
      maxHeight: 1024,
    });
    if (result.assets && result.assets[0].uri) {
      setPendingMedia({ uri: result.assets[0].uri, type: 'image' });
      setIsEditorVisible(true);
      const response = await uploadFiles(result.assets);
      dispatch({ type: ACTIONS.MEDIA, payload: response.data });
    }
  };

  const handleSendFromEditor = (caption: string) => {
    if (pendingMedia) {
      handleSendMessage(caption, state.media);
    }
    setIsEditorVisible(false);
    setPendingMedia(null);
  };

  const handleEmojiSelect = (emojiObject: any) => {
    if (!isEmojiOpen) {
      Keyboard.dismiss();
    }
    setMessage(prev => prev + emojiObject.emoji);
  };

  const handleLongPress = (item: ChatItem) => {
    setSelectedMsg(item);
  };

  const handleMentionUser = (userId: string) => {
    const found = participants.find((p: any) => p.user_id === userId);
    if (found) {
      setMentionSheetUser(found);
    }
  };

  const handleJumpToPinned = useCallback(
    async (pin: ResolvedPin) => {
      const target = getPinnedJumpTarget(pin);

      if (target.isReply) {
        const parent =
          dmsChat.find(
            (msg: any) => String(msg.thread_id) === String(target.threadId),
          ) ||
          (target.threadId
            ? {
                ...(pin.message || {}),
                thread_id: target.threadId,
                channels_id: channel_id,
              }
            : null);

        if (!parent?.thread_id) {
          ShowNotify('Error', 'Could not open this pinned reply');
          return;
        }

        dispatch({ type: ACTIONS.SELECTED_MSG, payload: parent });
        dispatch({
          type: ACTIONS.REPLY_CHAT,
          payload: { data: parent.preview_reply || [], page: 1 },
        });
        navigation.navigate('ChatStack', {
          screen: 'ChatThreadScreen',
          params: {
            thread_id: parent.thread_id,
            channel_id: channel_id,
            chatType: 'dm',
            highlight_message_id: target.id,
          },
        });
        return;
      }

      const jumpId = target.threadId || pin.pinId;
      if (!jumpId) {
        ShowNotify('Error', 'Could not find that pinned message');
        return;
      }

      pinJumpLockRef.current = false;
      pendingJumpIdRef.current = jumpId;
      setHighlightMsgId(jumpId);

      const performJump = (index: number) => {
        if (pinJumpLockRef.current || index < 0) return;
        pinJumpLockRef.current = true;
        pendingJumpIdRef.current = null;
        scrollChatToIndex(flatListRef, index, dmsChat);
        setTimeout(() => setHighlightMsgId(null), 2500);
      };

      let index = findPinnedMessageIndex(dmsChat, pin);

      if (index < 0) {
        index = await ensurePinnedThreadLoaded({
          messages: dmsChat,
          pin,
          channelId: String(channel_id),
          scope: 'chat',
          onPageLoaded: (page, data) => {
            dispatch({
              type: ACTIONS.DMS_CHAT,
              payload: { data, page },
            });
          },
        });
      }

      if (index < 0 && pin.message?.thread_id) {
        dispatch({
          type: ACTIONS.DMS_CHAT,
          payload: {
            data: [pin.message],
            page: 2,
          },
        });
        pendingJumpIdRef.current = String(pin.message.thread_id);
        return;
      }

      if (index >= 0) {
        performJump(index);
        return;
      }

      setTimeout(() => {
        if (pendingJumpIdRef.current === jumpId) {
          pendingJumpIdRef.current = null;
          setHighlightMsgId(null);
          ShowNotify('Error', 'Could not find that pinned message');
        }
      }, 2000);
    },
    [channel_id, dispatch, dmsChat, navigation],
  );

  useFocusEffect(
    useCallback(() => {
      const pin = consumePendingPinJump();
      if (!pin) return undefined;

      runAfterPinNavReturn(() => {
        handleJumpToPinned(pin);
      });

      return undefined;
    }, [handleJumpToPinned]),
  );

  useEffect(() => {
    const jumpId = pendingJumpIdRef.current;
    if (!jumpId || pinJumpLockRef.current || !dmsChat?.length) return;

    const index = findThreadIndex(dmsChat, jumpId);
    if (index < 0) return;

    pinJumpLockRef.current = true;
    pendingJumpIdRef.current = null;
    scrollChatToIndex(flatListRef, index, dmsChat);
    setTimeout(() => setHighlightMsgId(null), 2500);
  }, [dmsChat]);

  const cancelPinnedJumpFollow = useCallback(() => {
    pendingJumpIdRef.current = null;
    pinJumpLockRef.current = true;
    cancelPinnedScrollJumps();
  }, []);

  const handleSearchSelect = useCallback(
    async (hit: ChannelSearchHit) => {
      const jumpId = String(hit.messageId || '');
      if (!jumpId) return;

      Keyboard.dismiss();
      setIsSearching(false);
      setSearchQuery('');

      cancelPinnedScrollJumps();
      pinJumpLockRef.current = false;
      pendingJumpIdRef.current = jumpId;
      setHighlightMsgId(jumpId);
      suppressLoadMoreUntilRef.current = Date.now() + 2000;

      const resolveIndex = () => {
        let idx = findThreadIndex(dmsChatRef.current, jumpId);
        if (idx < 0) {
          idx = findMessageIndexByPreview(
            dmsChatRef.current,
            hit.message,
            hit.timestamp,
          );
        }
        return idx;
      };

      let found = resolveIndex() >= 0;

      if (!found && channel_id) {
        const loaded = await ensureThreadIdLoaded({
          messages: dmsChatRef.current,
          threadId: jumpId,
          channelId: String(channel_id),
          scope: 'chat',
          onPageLoaded: (page, data) => {
            dispatch({
              type: ACTIONS.DMS_CHAT,
              payload: { data, page },
            });
          },
        });
        found = loaded >= 0 || resolveIndex() >= 0;
      }

      const performJump = (index: number) => {
        if (pinJumpLockRef.current || index < 0) return;
        pinJumpLockRef.current = true;
        pendingJumpIdRef.current = null;
        const row = dmsChatRef.current[index];
        const highlightId = String(
          row?.thread_id || row?.id || row?.message_id || jumpId,
        );
        setHighlightMsgId(highlightId);
        scrollChatToIndex(flatListRef, index, dmsChatRef.current);
        setTimeout(() => setHighlightMsgId(null), 2500);
      };

      if (!found) {
        setTimeout(() => {
          if (pendingJumpIdRef.current === jumpId) {
            pendingJumpIdRef.current = null;
            setHighlightMsgId(null);
            ShowNotify('Error', 'Could not find that message');
          }
        }, 2500);
        return;
      }

      requestAnimationFrame(() => {
        setTimeout(() => {
          if (pendingJumpIdRef.current !== jumpId) return;
          const index = resolveIndex();
          if (index >= 0) performJump(index);
        }, 150);
      });
    },
    [channel_id, dispatch],
  );

  const handleScrollToIndexFailed = useMemo(
    () => createScrollToIndexFailedHandler(flatListRef),
    [],
  );

  const listFooter = useCallback(() => {
    if (!isFetchingMore) return null;
    return (
      <ActivityIndicator
        size="small"
        color={colors.primary}
        style={{ margin: 10 }}
      />
    );
  }, [isFetchingMore, colors.primary]);

  useEffect(() => {
    if (!mediaPickerOpen) return;
    const task = InteractionManager.runAfterInteractions(() => {
      pickerSheetRef.current?.expand();
    });
    return () => task.cancel();
  }, [mediaPickerOpen]);

  const handleEdit = () => {
    if (selectedMsg) {
      setOnEdit(true);
      setEditMsgId(selectedMsg.thread_id);
      setMessage(getPlainMessageText(selectedMsg.message || ''));
      actionSheetRef.current?.close();
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    if (mentionUser === true) {
      dispatch({
        type: ACTIONS.DMS_CHAT,
        payload: { data: singleDmsChat, page: 1 },
      });
      dispatch({ type: ACTIONS.PARTICIPANT, payload: singleParticipant });
      dispatch({ type: ACTIONS.MENTION_USER, payload: false });
    }
    navigation.goBack();
  };

  // Later highlights a root only when it is already loaded; no older-history scan.
  const savedThreadId = route?.params?.highlight_thread_id;
  useEffect(() => {
    if (!savedThreadId) return;
    const index = dmsChat.findIndex(
      (item: any) => item.thread_id === savedThreadId,
    );
    if (index < 0) return;
    setHighlightMsgId(savedThreadId);
    scrollChatToIndex(flatListRef, index, dmsChat);
    const timer = setTimeout(() => setHighlightMsgId(null), 2500);
    return () => clearTimeout(timer);
  }, [savedThreadId, dmsChat]);

  if ((returnLoading && fromNotification) || !channel_id) return null;
  //

  return (
    <Container color={colors.topNavigation}>
      <DMConnection id={channel_id} />
      <UseGroupDetails channel_id={channel_id} />

      {/* Header stays identical */}
      <View style={styles.header}>
        {isSearching ? (
          <ChatHeaderSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onCancel={() => {
              setIsSearching(false);
              setSearchQuery('');
            }}
            placeholder="Search messages…"
          />
        ) : (
          <>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons
                name="chevron-back"
                size={24}
                color={colors.iconDefault}
              />
            </TouchableOpacity>

            <View style={styles.headerAvatarContainer}>
              <UserAvatar
                user={{
                  avatar_url: headerParticipant?.avatar_url,
                  default_avatar_url: headerParticipant?.default_avatar_url,
                  online: headerParticipant?.online,
                }}
                size={36}
                badgeSize={12}
                badgeRingColor={colors.topNavigation}
                fallbackName={headerParticipant?.username}
                disabled
              />
            </View>
            <TouchableOpacity
              style={styles.headerInfo}
              onPress={() =>
                navigation.navigate('UserDetailScreen', {
                  participant: headerParticipant,
                  channel_id,
                })
              }
            >
              <AppText variant="bold" size={15} numberOfLines={1}>
                {headerParticipant?.username}
              </AppText>
              {headerParticipant && (
                <AppText
                  size={12}
                  style={[
                    styles.headerPresenceText,
                    headerParticipant.online
                      ? styles.headerPresenceOnline
                      : styles.headerPresenceOffline,
                  ]}
                >
                  {headerParticipant.online ? 'Online' : 'Offline'}
                </AppText>
              )}
            </TouchableOpacity>

            <ChatHeaderMenu
              buzzLoading={callLoading}
              onBuzzCall={requestStartBuzz}
              onSearch={() => setIsSearching(true)}
              onPinnedMessages={() =>
                navigation.navigate('PinnedMessages', {
                  channel_id,
                  scope: 'chat',
                })
              }
            />
          </>
        )}
      </View>

      <ChatBackground />

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={dmsChat}
          inverted
          showsVerticalScrollIndicator={false}
          keyExtractor={item => item.thread_id}
          extraData={[highlightMsgId, editMsgId, onEdit]}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          onScroll={onChatScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={cancelPinnedJumpFollow}
          pointerEvents={isSearching ? 'none' : 'auto'}
          style={isSearching ? { flex: 1, opacity: 0 } : { flex: 1 }}
          renderItem={({ item, index }) => (
            <View
              onLayout={e =>
                recordChatItemHeight(
                  item.thread_id,
                  e.nativeEvent.layout.height,
                )
              }
              style={{
                marginBottom: 15,
                backgroundColor:
                  (onEdit && editMsgId === item.thread_id) ||
                  isChatRowHighlighted(item, highlightMsgId)
                    ? colors.chatHighlight
                    : 'transparent',
              }}
            >
              <MessageItem
                item={{
                  ...item,
                  id: item.thread_id,
                  text: item.message,
                  sent: item.user_id === user.user_id,
                }}
                index={index}
                messages={dmsChat}
                onLongPress={() => handleLongPress(item)}
                onMentionUser={handleMentionUser}
                editMsgId={editMsgId}
                onEdit={onEdit}
                avatarSlot={messageAvatars[index]?.slot}
                avatarUser={messageAvatars[index]?.user}
                showNewMarker={item.thread_id === newMarkerId}
              />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={listFooter}
        />
        {!isSearching && (
          <ChatScrollToBottomButton
            visible={showScrollToBottom}
            onPress={scrollToBottom}
          />
        )}
        {isSearching && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.background,
            }}
          >
            <ChatSearchResults
              channelId={String(channel_id)}
              query={searchQuery}
              onSelect={handleSearchSelect}
            />
          </View>
        )}
      </View>

      {!isSearching && (
        <ChatKeyboardAvoidingView>
          {mentionState && (
            <MentionSheet
              query={mentionState.query}
              participants={mentionParticipants}
              onSelect={handleMentionSelect}
            />
          )}

          <ChatInput
            message={message}
            setMessage={setMessage}
            onTypingChange={handleTyping}
            onSend={(content: any) =>
              onEdit
                ? handleSendEditMessage(content)
                : handleSendMessage(content)
            }
            onVoiceRecorded={handleVoiceRecorded}
            onVoiceSendReady={handleVoiceSendReady}
            onVoiceCancel={handleVoiceCancel}
            isVoiceUploading={isVoiceUploading}
            onPickImage={pickImage}
            onMediaPicker={() => setMediaPickerOpen(true)}
            onOpenEmoji={() => setIsEmojiOpen(true)}
            onCloseEmoji={() => setIsEmojiOpen(false)}
            isEmojiOpen={isEmojiOpen}
            onFocus={() => {
              pickerSheetRef.current?.close();
              setMediaPickerOpen(false);
            }}
            onMentionTrigger={handleMentionTrigger}
            onMentionCancel={() => setMentionState(null)}
          />

          {isEmojiOpen && (
            <View style={styles.emojiWrapper}>
              <ThemedEmojiKeyboard
                onEmojiSelected={handleEmojiSelect}
                categoryPosition="bottom"
                enableSearchBar
                emojiSize={25}
              />
            </View>
          )}
        </ChatKeyboardAvoidingView>
      )}

      {selectedMsg && (
        <MessageAction
          ref={actionSheetRef}
          item={selectedMsg}
          onClose={() => setSelectedMsg(null)}
          handleEdit={handleEdit}
        />
      )}

      {mediaPickerOpen && (
        <MediaPickerSheet
          ref={pickerSheetRef}
          setPendingMedia={setPendingMedia}
          setIsEditorVisible={setIsEditorVisible}
          onClose={() => setMediaPickerOpen(false)}
          startOpen
        />
      )}

      {pendingMedia && (
        <MediaEditorModal
          visible={isEditorVisible}
          media={pendingMedia}
          onClose={() => {
            setIsEditorVisible(false);
            setPendingMedia(null);
          }}
          onSend={handleSendFromEditor}
        />
      )}

      {mentionSheetUser && (
        <MentionUserBottomSheet
          ref={mentionUserSheetRef}
          user={mentionSheetUser}
          onClose={() => setMentionSheetUser(null)}
        />
      )}

      <StartBuzzConfirmationModal
        visible={buzzConfirmVisible}
        loading={callLoading}
        scope="dm"
        contextName={headerParticipant?.username}
        onClose={() => {
          if (!callLoading) setBuzzConfirmVisible(false);
        }}
        onConfirm={handleVideoCall}
      />
    </Container>
  );
};

export default ChatDetailScreen;
