import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Image,
  FlatList,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { AppText } from '@/components/ui/text';
import Container from '@/components/layout/container';
import { useTheme } from '@/theme/ThemeProvider';
import { createChatDetailStyles } from '@/theme/createScreenStyles';
import { useFocusEffect } from '@react-navigation/native';
import { launchCamera } from 'react-native-image-picker';
import { ThemedEmojiKeyboard } from '@/components/ui/themed-emoji-keyboard';
import MessageItem from '@/components/layout/channels/messagItem';
import ChatInput from '@/components/layout/chat/chat-input';
import ChatKeyboardAvoidingView from '@/components/layout/chat/chat-keyboard-avoiding-view';
import { useTyping } from '@/hooks/useTyping';
import { MessageAction } from '@/components/layout/chat/message-action';
import { MediaPickerSheet } from '@/components/layout/chat/media-picker';
import MediaEditorModal from '@/components/layout/chat/media-editor';
import { useDataContext } from '@/store/useDataContext';
import UseChannelChat from '@/services/channels/channel-chat';
import { useFileUpload } from '@/hooks/useFileUpload';
import uuid from 'react-native-uuid';
import { PostRequest, PutRequest } from '@/utils/requests';
import { ACTIONS } from '@/store/types';
import { Channel } from '@/types/channel';
import ChannelConnection from '@/centrifugoo/channel-connection';
import UseChannelDetails from '@/services/channels/channel-details';
import { normalize } from '@/utils/normalize';
import MentionUserBottomSheet, {
  MentionUserBottomSheetRef,
} from '@/components/layout/chat/mention-user-bottomsheet';
import { MentionSheet } from '@/components/layout/chat/mention-sheet';
import { buildMentionHtmlTag } from '@/utils/message-text';
import { ShowNotify } from '@/components/ui/toast';
import buzzService from '@/services/buzz.service';
import ChatBackground from '@/components/layout/chat/chat-background';
import { useMessageDraft } from '@/hooks/useMessageDraft';
import { RestrictedChannelBanner } from '@/components/layout/channels/restricted-channel';
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

const ChannelChatScreen = ({ navigation, route }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createChatDetailStyles(colors), [colors]);
  const [message, setMessage] = useState('');
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const actionSheetRef = useRef<any>(null);
  const pickerSheetRef = useRef<any>(null);
  const pendingJumpIdRef = useRef<string | null>(null);
  const pinJumpLockRef = useRef(false);
  const channelsChatRef = useRef<any[]>([]);
  const {
    onScroll: onChatScroll,
    visible: showScrollToBottom,
    scrollToBottom,
  } = useInvertedChatScrollToBottom(flatListRef);
  const [selectedMsg, setSelectedMsg] = useState<Channel | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{
    uri: string;
    type: 'image' | 'file';
  } | null>(null);
  // Mention State
  const [mentionState, setMentionState] = useState<{
    query: string;
    pos: number;
    trigger: '@' | '#';
  } | null>(null);
  const [mentionsMetadata, setMentionsMetadata] = useState<any[]>([]);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mentionSheetUser, setMentionSheetUser] = useState<any | null>(null);
  const [buzzConfirmVisible, setBuzzConfirmVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { state, dispatch } = useDataContext();
  const { handleTyping } = useTyping(state.channelSubscription);
  const {
    channel,
    media,
    channelsChat,
    user,
    callback,
    channelDetails,
    buzzIsMuted,
    buzzShowVideo,
    orgId,
  } = state;
  channelsChatRef.current = channelsChat || [];
  const [channelAccess, setChannelAccess] = useState(channel?.access);
  const [onEdit, setOnEdit] = useState(false);
  const [editMsgId, setEditMsgId] = useState<string | null>(null);
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(true);

  const mentionUserSheetRef = useRef<MentionUserBottomSheetRef>(null);
  const { fromNotification, channel_id: routeChannelId } = route?.params || {};

  const channel_id =
    routeChannelId || channel?.channels_id || channel?.channel_id;
  const { loadMore, isFetchingMore } = UseChannelChat({
    channel_id: channel_id as string,
  });
  const { uploadFiles, clearUploads } = useFileUpload();
  const suppressLoadMoreUntilRef = useRef(0);

  const handleLoadMore = useCallback(() => {
    if (Date.now() < suppressLoadMoreUntilRef.current) return;
    loadMore();
  }, [loadMore]);

  const { clearDraft, restoreDraft } = useMessageDraft({
    scope: 'channel',
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
    if (channel?.access !== undefined) {
      setChannelAccess(channel.access);
    }
  }, [channel?.access, channel?.channels_id, channel_id]);

  useEffect(() => {
    setReturnLoading(false);
  }, [fromNotification]);

  // Dismiss keyboard when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
      };
    }, []),
  );

  // Handler to open mention user bottom sheet
  const handleMentionUser = (userId: string) => {
    if (
      !channelDetails?.participants ||
      !Array.isArray(channelDetails?.participants)
    )
      return;
    const found = channelDetails?.participants.find(
      (p: any) => p.user_id === userId,
    );
    if (found) {
      setMentionSheetUser(found);
    }
  };

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

  const handleVideoCall = async () => {
    const activeBuzzData = state?.buzzData;
    if (state?.isCallMinimized && activeBuzzData?.buzz_code) {
      dispatch({ type: ACTIONS.CALL_MINIMIZED, payload: false });
      navigation.navigate('BuzzStack', {
        screen: 'CallScreen',
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
      const result = await buzzService.createChannelBuzz(channel_id as string);

      if (result.error || !result.data) {
        ShowNotify('Error', result.error || 'Failed to create call');
        setCallLoading(false);
        return;
      }

      const buzz = result.data;

      const joinResult = await buzzService.joinBuzz(buzz.buzz_code);

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

      navigation.navigate('BuzzStack', {
        screen: 'ChannelCall',
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

  const handleJoinCall = async () => {
    try {
      setCallLoading(true);

      const joinResult = await buzzService.joinBuzz(
        channelDetails?.active_buzz?.buzz_id as string,
      );

      if (joinResult.error || !joinResult.data) {
        ShowNotify('Error', joinResult.error || 'Failed to join call');
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

      navigation.navigate('BuzzStack', {
        screen: 'ChannelCall',
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

  // Mention participants for this channel
  const mentionParticipants = useMemo(
    () => channelDetails?.participants || channel?.participants || [],
    [channelDetails?.participants, channel?.participants],
  );

  const userChannelsList = useMemo(
    () => state.userChannels || [],
    [state.userChannels],
  );

  // Open mention picker when @ or # is typed
  const handleMentionTrigger = (
    query: string,
    pos: number,
    trigger: '@' | '#' = '@',
  ) => {
    setMentionState({ query, pos, trigger });
  };

  const handleMentionSelect = (selectedUser: any) => {
    if (!mentionState) return;

    const { pos, query } = mentionState;
    const mentionStart = pos - query.length - 1;

    const textBefore = message.substring(0, mentionStart);
    const textAfter = message.substring(pos);

    const newMessage = `${textBefore}@${selectedUser.username} ${textAfter}`;

    setMessage(newMessage);

    const mentionType =
      selectedUser.type === 'channel' || selectedUser.username === 'channel'
        ? 'channel'
        : 'user';

    setMentionsMetadata(prev => [
      ...prev,
      {
        id:
          mentionType === 'channel' ? 'channel' : String(selectedUser.user_id),
        label: mentionType === 'channel' ? 'channel' : selectedUser.username,
        type: mentionType,
      },
    ]);

    setMentionState(null);
  };

  const handleChannelMentionSelect = (selectedChannel: any) => {
    if (!mentionState) return;

    const { pos, query } = mentionState;
    const mentionStart = pos - query.length - 1;

    const textBefore = message.substring(0, mentionStart);
    const textAfter = message.substring(pos);

    const newMessage = `${textBefore}#${selectedChannel.name} ${textAfter}`;
    setMessage(newMessage);

    const channelId = String(
      selectedChannel.channels_id || selectedChannel.channel_id,
    );
    const channelLabel = selectedChannel.name;

    setMentionsMetadata(prev => {
      const alreadyExists = prev.some(
        m => m.id === channelId && m.type === 'channel-ref',
      );
      if (alreadyExists) return prev;
      return [
        ...prev,
        {
          id: channelId,
          label: channelLabel,
          type: 'channel-ref',
        },
      ];
    });

    setMentionState(null);
  };

  const handleMentionChannel = useCallback(
    (targetChannelId: string) => {
      const allKnownChannels = [
        ...(state.userChannels || []),
        ...(state.allChannels || []),
      ];
      const targetChannel = allKnownChannels.find(
        (ch: any) =>
          String(ch.channels_id || ch.channel_id) === String(targetChannelId),
      );

      if (!targetChannel) {
        ShowNotify('Info', "You're not a member of this channel");
        return;
      }

      dispatch({ type: ACTIONS.CHANNEL, payload: targetChannel });
      dispatch({
        type: ACTIONS.CHANNELS_CHAT,
        payload: { data: targetChannel.preview_thread ?? [], page: 1 },
      });

      if (targetChannel.thread_count > 0) {
        dispatch({
          type: ACTIONS.RESET_CHANNEL_THREAD_COUNT,
          payload: targetChannel.channels_id || targetChannel.channel_id,
        });
      }

      dispatch({
        type: ACTIONS.CHANNEL_CALLBACK,
        payload: !state.channelCallback,
      });

      if (typeof (navigation as any).push === 'function') {
        (navigation as any).push('ChannelChat', {
          channel_id: targetChannel.channels_id || targetChannel.channel_id,
        });
      } else {
        navigation.navigate('ChannelStack', {
          screen: 'ChannelChat',
          params: {
            channel_id: targetChannel.channels_id || targetChannel.channel_id,
          },
        });
      }
    },
    [
      dispatch,
      navigation,
      state.allChannels,
      state.channelCallback,
      state.userChannels,
    ],
  );

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

  const handleMediaPicker = () => {
    setMediaPickerOpen(true);
  };

  const handleSendMessage = async (content: string, medias: any[] = []) => {
    if (!content.trim() && medias.length === 0 && state.media.length === 0)
      return;

    handleTyping(false);

    const tempId = uuid.v4() as string;
    // Construct web-compatible HTML payload
    let formattedContent = content;
    mentionsMetadata.forEach(m => {
      const prefix = m.type === 'channel-ref' ? '#' : '@';
      formattedContent = formattedContent.replace(
        `${prefix}${m.label}`,
        buildMentionHtmlTag(m),
      );
    });

    const finalHtml = `<p>${formattedContent}</p>`;

    const optimisticMessage = {
      channels_id: channel_id,
      thread_id: tempId,
      username: state.user?.username || 'You',
      avatar_url: state.user?.avatar_url,
      message: finalHtml,
      created_at: new Date().toISOString(),
      status: 'pending',
      type: 'message',
      media: medias.length > 0 ? medias : state.media,
      user_id: state.user?.user_id,
      reactions: null,
      isOptimistic: true,
    };

    dispatch({
      type: ACTIONS.CHANNELS_CHAT,
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

    const { error } = await PostRequest(`/threads/${channel_id}`, payload);
    await recordSuccessfulMessageResult(
      state.user?.user_id || state.user?.id,
      error,
    );
    dispatch({
      type: ACTIONS.CHANNEL_CALLBACK,
      payload: !state.channelCallback,
    });
    clearUploads();
  };

  const handleSendEditMessage = async (content: string, medias: any[] = []) => {
    if (!content.trim() && medias.length === 0) return;

    handleTyping(false);

    const tempId = uuid.v4() as string;

    // Construct web-compatible HTML payload
    let formattedContent = content;
    mentionsMetadata.forEach(m => {
      const prefix = m.type === 'channel-ref' ? '#' : '@';
      formattedContent = formattedContent.replace(
        `${prefix}${m.label}`,
        buildMentionHtmlTag(m),
      );
    });

    const finalHtml = `<p>${formattedContent}</p>`;

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
      type: ACTIONS.EDIT_CHANNELS_CHAT,
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

    await PutRequest(`/threads/${editMsgId}/channels/${channel_id}`, payload);

    dispatch({
      type: ACTIONS.CHANNEL_CALLBACK,
      payload: !state.channelCallback,
    });
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
      handleSendMessage(caption, media);
    }
    setIsEditorVisible(false);
    setPendingMedia(null);
    dispatch({ type: ACTIONS.MEDIA, payload: [] });
  };

  const handleEmojiSelect = (emojiObject: any) => {
    if (!isEmojiOpen) {
      Keyboard.dismiss();
    }
    setMessage(prev => prev + emojiObject.emoji);
  };

  const onClose = () => {
    setSelectedMsg(null);
  };

  const handleJumpToPinned = useCallback(
    async (pin: ResolvedPin) => {
      const target = getPinnedJumpTarget(pin);

      if (target.isReply) {
        const parent =
          channelsChat.find(
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
          payload: { data: (parent as any).preview_reply || [], page: 1 },
        });
        navigation.navigate('ChannelStack', {
          screen: 'ChannelThread',
          params: {
            thread_id: parent.thread_id,
            channel_id: channel_id,
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

      // Reset lock so this tap can jump exactly once.
      pinJumpLockRef.current = false;
      pendingJumpIdRef.current = jumpId;
      setHighlightMsgId(jumpId);

      const performJump = (index: number) => {
        if (pinJumpLockRef.current || index < 0) return;
        pinJumpLockRef.current = true;
        pendingJumpIdRef.current = null;
        scrollChatToIndex(flatListRef, index, channelsChat);
        setTimeout(() => setHighlightMsgId(null), 2500);
      };

      let index = findPinnedMessageIndex(channelsChat, pin);

      if (index < 0) {
        index = await ensurePinnedThreadLoaded({
          messages: channelsChat,
          pin,
          channelId: String(channel_id),
          scope: 'channel',
          onPageLoaded: (page, data) => {
            dispatch({
              type: ACTIONS.CHANNELS_CHAT,
              payload: { data, page },
            });
          },
        });
      }

      if (index < 0 && pin.message?.thread_id) {
        dispatch({
          type: ACTIONS.CHANNELS_CHAT,
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
    [channelsChat, channel_id, dispatch, navigation],
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
    if (!jumpId || pinJumpLockRef.current || !channelsChat?.length) return;

    const index = findThreadIndex(channelsChat, jumpId);
    if (index < 0) return;

    pinJumpLockRef.current = true;
    pendingJumpIdRef.current = null;
    scrollChatToIndex(flatListRef, index, channelsChat);
    setTimeout(() => setHighlightMsgId(null), 2500);
  }, [channelsChat]);

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
        let idx = findThreadIndex(channelsChatRef.current, jumpId);
        if (idx < 0) {
          idx = findMessageIndexByPreview(
            channelsChatRef.current,
            hit.message,
            hit.timestamp,
          );
        }
        return idx;
      };

      let found = resolveIndex() >= 0;

      if (!found && channel_id) {
        const loaded = await ensureThreadIdLoaded({
          messages: channelsChatRef.current,
          threadId: jumpId,
          channelId: String(channel_id),
          scope: 'channel',
          onPageLoaded: (page, data) => {
            dispatch({
              type: ACTIONS.CHANNELS_CHAT,
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
        const row = channelsChatRef.current[index];
        const highlightId = String(
          row?.thread_id || row?.id || row?.message_id || jumpId,
        );
        setHighlightMsgId(highlightId);
        scrollChatToIndex(flatListRef, index, channelsChatRef.current);
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

      // Wait for search overlay / keyboard teardown, then jump like pins.
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (pendingJumpIdRef.current !== jumpId) return;
          const index = resolveIndex();
          if (index >= 0) performJump(index);
          // else leave pending — useEffect finishes when the list updates
        }, 150);
      });
    },
    [channel_id, dispatch],
  );

  const handleScrollToIndexFailed = useMemo(
    () => createScrollToIndexFailedHandler(flatListRef),
    [],
  );

  const handleLongPress = (item: Channel) => {
    setSelectedMsg(item);
  };

  const handleJoinChannel = async () => {
    setJoinLoading(true);

    const { data, error } = await PostRequest(`/channels/${channel_id}/join`, {
      username: user?.username,
    });

    if (!error) {
      setChannelAccess(true);
      dispatch({ type: ACTIONS.CHANNEL_CALLBACK, payload: !callback });
      dispatch({ type: ACTIONS.SUCCESS, payload: data.message });
    } else {
      dispatch({ type: ACTIONS.ERROR, payload: error });
    }

    setJoinLoading(false);
  };

  const handleDetails = () => {
    if (!channel?.access) {
      dispatch({
        type: ACTIONS.ERROR,
        payload: 'Please join the channel to continue',
      });
      return;
    }
    navigation.navigate('ChannelStack', {
      screen: 'ChannelDetails',
      params: { channel_id: channel_id },
    });
  };

  const handleEdit = () => {
    if (selectedMsg) {
      setOnEdit(true);
      setEditMsgId(selectedMsg.thread_id);
      setMessage(selectedMsg.message?.replace(/<[^>]*>?/gm, '') || '');
      actionSheetRef.current?.close();
    }
  };

  const handleGoBack = () => {
    Keyboard.dismiss();
    navigation.goBack();
  };

  const activeBuzz = channel?.active_buzz || channelDetails?.active_buzz;

  //
  // Later highlights a root only when it is already loaded; no older-history scan.
  const savedThreadId = route?.params?.highlight_thread_id;
  useEffect(() => {
    if (!savedThreadId) return;
    const index = channelsChat.findIndex(
      (item: any) => item.thread_id === savedThreadId,
    );
    if (index < 0) return;
    setHighlightMsgId(savedThreadId);
    scrollChatToIndex(flatListRef, index, channelsChat);
    const timer = setTimeout(() => setHighlightMsgId(null), 2500);
    return () => clearTimeout(timer);
  }, [savedThreadId, channelsChat]);

  if ((returnLoading && fromNotification) || !channel_id) return null;

  return (
    <Container color={colors.topNavigation}>
      <ChannelConnection id={channel_id as string} />
      <UseChannelDetails channel_id={channel_id as string} />
      {/* GROUP HEADER */}
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
            <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
              <Image
                source={require('@/assets/icons/back.png')}
                style={styles.headerIcon}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerInfo} onPress={handleDetails}>
              <AppText variant="bold" size={15} numberOfLines={1}>
                #{channel?.name || channelDetails?.name}
              </AppText>
              <AppText size={11} style={{ color: colors.textSecondary }}>
                {channel?.members_count || channel?.users_count}{' '}
                {(channel?.members_count || channel?.users_count) === 1
                  ? 'Member'
                  : 'Members'}{' '}
              </AppText>
            </TouchableOpacity>

            {channelAccess && (
              <ChatHeaderMenu
                buzzLoading={callLoading}
                buzzActive={Boolean(activeBuzz)}
                onBuzzCall={activeBuzz ? handleJoinCall : requestStartBuzz}
                onSearch={() => setIsSearching(true)}
                onPinnedMessages={() =>
                  navigation.navigate('PinnedMessages', {
                    channel_id: channel_id as string,
                    scope: 'channel',
                  })
                }
              />
            )}
          </>
        )}
      </View>

      <ChatBackground />

      {channelAccess && (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={channelsChat}
            inverted
            keyExtractor={(item, index) => `${item.thread_id}-${index}`}
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
                  }}
                  index={index}
                  messages={channelsChat}
                  onLongPress={() => handleLongPress(item)}
                  onMentionUser={handleMentionUser}
                  onMentionChannel={handleMentionChannel}
                  editMsgId={editMsgId}
                  onEdit={onEdit}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
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
      )}

      {!isSearching && (
        <ChatKeyboardAvoidingView>
          {channelAccess === false ? (
            <View style={styles.joinPrompt}>
              <AppText style={styles.joinText}>
                You are viewing #{channel?.name}. Join to start chatting.
              </AppText>
              <TouchableOpacity
                style={[styles.joinButton, { marginBottom: normalize(50) }]}
                onPress={handleJoinChannel}
                disabled={joinLoading}
              >
                {joinLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <AppText variant="bold" style={{ color: colors.white }}>
                    Join Channel
                  </AppText>
                )}
              </TouchableOpacity>
            </View>
          ) : String(channelDetails?.channels_id || '') ===
              String(channel_id || '') && channelDetails?.is_restricted ? (
            <RestrictedChannelBanner />
          ) : (
            <>
              {mentionState &&
                (mentionState.trigger === '#' ? (
                  <MentionSheet
                    mode="channel"
                    query={mentionState.query}
                    channels={userChannelsList}
                    onSelect={handleChannelMentionSelect}
                  />
                ) : (
                  <MentionSheet
                    mode="user"
                    query={mentionState.query}
                    showChannelMention
                    participants={mentionParticipants}
                    onSelect={handleMentionSelect}
                  />
                ))}

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
                onMediaPicker={handleMediaPicker}
                onOpenEmoji={() => setIsEmojiOpen(true)}
                onCloseEmoji={() => setIsEmojiOpen(false)}
                isEmojiOpen={isEmojiOpen}
                onFocus={() => {
                  pickerSheetRef.current?.close();
                  setMediaPickerOpen(false);
                }}
                onMentionTrigger={handleMentionTrigger}
                onMentionCancel={() => {
                  setMentionState(null);
                }}
                highlightMentions
                composerMentions={mentionsMetadata}
              />

              {isEmojiOpen && (
                <View style={styles.emojiWrapper}>
                  <ThemedEmojiKeyboard
                    onEmojiSelected={handleEmojiSelect}
                    enableRecentlyUsed
                    categoryPosition="bottom"
                    enableSearchBar
                    disableSafeArea={true}
                    allowMultipleSelections
                    emojiSize={25}
                    containerStyle={{
                      container: {
                        borderRadius: 0,
                      },
                    }}
                  />
                </View>
              )}
            </>
          )}
        </ChatKeyboardAvoidingView>
      )}

      {selectedMsg && (
        <MessageAction
          ref={actionSheetRef}
          item={selectedMsg}
          onClose={onClose}
          handleEdit={handleEdit}
          threadChatType="channel"
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
        scope="channel"
        contextName={channel?.name || channelDetails?.name}
        memberCount={
          channel?.members_count || channel?.users_count || undefined
        }
        onClose={() => {
          if (!callLoading) setBuzzConfirmVisible(false);
        }}
        onConfirm={handleVideoCall}
      />
    </Container>
  );
};

export default ChannelChatScreen;
