import { SavedMessageIndicator } from '@/components/layout/chat/saved-message-indicator';
import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, Dimensions } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createChannelMessageItemStyles } from '@/theme/createMessageStyles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MediaViewer from '../chat/media-viewer';
import Video from 'react-native-video';
import moment from 'moment';
import { ChannelChat } from '@/types/channel';
import { ACTIONS } from '@/store/types';
import { useNavigation } from '@react-navigation/native';
import { useDataContext } from '@/store/useDataContext';
import FastImage from 'react-native-fast-image';
import { AudioMessagePlayer } from '../chat/audio-message-player';
import { hasMessageContent } from '@/utils/message-text';
import { ForwardedMessageBlock } from '../chat/forwarded-message-block';
import { MessageContent } from '../chat/message-content';
import {
  getForwardedMessageFromItem,
  hasForwardComment,
} from '@/utils/forward-message';
import {
  ChatFileAttachmentCard,
  ChatFilePreviewModal,
} from '../chat/chat-file-attachment';
import { isVoiceMessageMedia } from '@/utils/voice-message';
import { isVideoFile } from '@/utils/file-helpers';
import { parseChannelEventMessage } from '@/lib/channel-event-message';
import { ChannelEventMessageBlock } from './channel-event-message-block';
import { truncateUsernameForChannel } from '@/utils/truncate-username';
import ReactionDetailsSheet from '../chat/reaction-details';
import { PinnedMessageBanner } from '../chat/pinned-message-banner';

const { width } = Dimensions.get('window');

const MessageItem = ({
  item,
  index,
  messages,
  onLongPress,
  isGroup,
  onMentionUser,
  onMentionChannel,
  editMsgId,
  onEdit,
}: any) => {
  const { colors } = useTheme();
  const styles = useMemo(
    () => createChannelMessageItemStyles(colors, width),
    [colors],
  );
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [filePreviewVisible, setFilePreviewVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [reactionSheetVisible, setReactionSheetVisible] = useState(false);
  const [selectedReactionEmoji, setSelectedReactionEmoji] = useState<
    string | null
  >(null);
  const { state, dispatch } = useDataContext();
  const navigation = useNavigation();

  const forwardData = getForwardedMessageFromItem(item);
  const showForwardComment = hasForwardComment(item);
  const channelEventMessage = parseChannelEventMessage(item);

  const showDateHeader =
    index === messages.length - 1 ||
    moment(messages[index + 1].created_at).format('YYYY-MM-DD') !==
      moment(item.created_at).format('YYYY-MM-DD');

  const handleFilePress = (mediaItem: any) => {
    setSelectedFile(mediaItem);
    setFilePreviewVisible(true);
  };

  const handleMediaPress = (media: any) => {
    setSelectedMedia(media);
    setViewerVisible(true);
  };

  const handlePress = (item: ChannelChat) => {
    if (item?.type === 'system') return;
    onLongPress(item);
  };

  // handle reply
  const handleThread = () => {
    dispatch({ type: ACTIONS.SELECTED_MSG, payload: item });
    dispatch({
      type: ACTIONS.REPLY_CHAT,
      payload: { data: item.preview_reply ?? [], page: 1 },
    });

    navigation.navigate('ChannelStack', {
      screen: 'ChannelThread',
      params: { thread_id: item?.thread_id, channel_id: item?.channels_id },
    });
    dispatch({ type: ACTIONS.LOAD_THREAD, payload: !state.loadThreadCallback });
  };

  const renderReplyParticipants = () => {
    const replies = Array.isArray(item?.messages) ? item.messages : [];
    const replyCount = item.message_count;
    if (replyCount === 0) return null;

    const visibleParticipants = replies.slice(0, 3);
    const remaining = replyCount - visibleParticipants.length;

    // Dynamic alignment for reply bar
    const replyBarStyle = [
      styles.slackThreadContainer,
      item.sent ? styles.replyBarSent : styles.replyBarReceived,
    ];

    return (
      <>
        {visibleParticipants?.length !== 0 && (
          <TouchableOpacity
            style={replyBarStyle}
            activeOpacity={0.8}
            onPress={handleThread}
          >
            <View style={styles.participantStack}>
              {visibleParticipants.map((reply: any, idx: number) => (
                <FastImage
                  key={reply.id || idx}
                  source={{ uri: reply.avatar_url || item.default_avatar_url }}
                  style={[
                    styles.threadAvatar,
                    { marginLeft: idx === 0 ? 0 : -8 },
                  ]}
                />
              ))}
            </View>
            <AppText variant="bold" size={12} style={styles.threadText}>
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </AppText>
            {remaining > 0 && (
              <AppText size={11} style={styles.threadCountExtra}>
                +{remaining}
              </AppText>
            )}
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.primary}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        )}
      </>
    );
  };

  const renderMediaItem = (mediaItem: any) => {
    const type = mediaItem?.file_type?.toLowerCase();

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(
      type,
    );
    const isAudio = isVoiceMessageMedia(mediaItem);
    const isVideo = !isAudio && isVideoFile(mediaItem);
    const isFile = mediaItem && !isImage && !isVideo && !isAudio;

    if (isImage) {
      return (
        <TouchableOpacity
          key={mediaItem.id}
          activeOpacity={0.9}
          onPress={() => handleMediaPress(mediaItem)}
          onLongPress={() => handlePress(item)}
          style={styles.mediaContainer}
        >
          <FastImage
            source={{ uri: mediaItem.file_link }}
            style={styles.mediaImage}
          />
        </TouchableOpacity>
      );
    }

    if (isVideo) {
      return (
        <TouchableOpacity
          key={mediaItem.id}
          activeOpacity={0.9}
          onPress={() => handleMediaPress(mediaItem)}
          onLongPress={() => handlePress(item)}
          style={styles.mediaContainer}
        >
          <View style={styles.videoWrapper}>
            <Video
              source={{ uri: mediaItem.file_link }}
              style={styles.mediaImage}
              resizeMode="cover"
              paused={true}
            />
            <View style={styles.videoPlayOverlay}>
              <View style={styles.playIconCircle}>
                <Ionicons name="play" size={32} color="white" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (isFile) {
      return (
        <ChatFileAttachmentCard
          key={mediaItem.id}
          file={mediaItem}
          widthRatio={0.65}
          onPress={() => handleFilePress(mediaItem)}
          onLongPress={() => handlePress(item)}
        />
      );
    }

    if (isAudio) {
      return (
        <AudioMessagePlayer
          key={mediaItem.id}
          audioUrl={mediaItem.file_link}
          media={mediaItem}
          item={item}
        />
      );
    }

    return null;
  };

  const renderMessageContent = () => (
    <MessageContent
      html={item.message}
      media={item.media}
      onMentionUser={onMentionUser}
      onMentionChannel={onMentionChannel}
      textStyle={styles.messageText}
    />
  );

  return (
    <View>
      {showDateHeader && (
        <View style={styles.dateHeader}>
          <AppText style={styles.dateText}>
            {moment(item.created_at).calendar(null, {
              sameDay: '[Today]',
              lastDay: '[Yesterday]',
              lastWeek: 'MMMM D, YYYY',
              sameElse: 'MMMM D, YYYY',
            })}
          </AppText>
        </View>
      )}

      <View
        style={[
          styles.rowContainer,
          item.is_pinned ? { backgroundColor: colors.lightYellow } : undefined,
        ]}
      >
        <TouchableOpacity
          style={styles.groupAvatarContainer}
          onPress={() => onMentionUser(item.user_id)}
        >
          <FastImage
            source={{
              uri: item.avatar_url ? item.avatar_url : item.default_avatar_url,
            }}
            style={styles.groupSenderAvatar}
          />
        </TouchableOpacity>

        <View style={styles.messageColumn}>
          <PinnedMessageBanner item={item} />
          <SavedMessageIndicator item={item} />
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => handlePress(item)}
            // delayLongPress={200}
            style={[
              styles.messageWrapper,
              isGroup && { maxWidth: '100%' },
              editMsgId === item.thread_id && onEdit
                ? { backgroundColor: colors.chatHighlight }
                : undefined,
            ]}
          >
            <View>
              <View style={styles.senderRow}>
                <AppText
                  size={13}
                  variant="bold"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.senderNameLabel,
                    { color: item.senderColor || colors.primary },
                  ]}
                >
                  {truncateUsernameForChannel(item.username)}
                </AppText>
                <AppText size={10} style={styles.timeText}>
                  {moment(item.created_at).format('h:mm a')}
                </AppText>
              </View>

              {!forwardData && item.media && item.media.length > 0 && (
                <View style={styles.verticalMediaStack}>
                  {item.media.map((m: any) => (
                    <View key={m.id || m.url}>{renderMediaItem(m)}</View>
                  ))}
                </View>
              )}

              {channelEventMessage ? (
                <ChannelEventMessageBlock data={channelEventMessage} />
              ) : forwardData ? (
                showForwardComment && renderMessageContent()
              ) : (
                hasMessageContent(item.message) && renderMessageContent()
              )}

              {forwardData ? (
                <ForwardedMessageBlock
                  data={forwardData}
                  onMentionUser={onMentionUser}
                  onMentionChannel={onMentionChannel}
                />
              ) : null}

              {item.edited && (
                <AppText size={10} style={styles.timeText}>
                  Edited
                </AppText>
              )}

              {item?.reactions?.length > 0 && (
                <View style={styles.reactionContainer}>
                  {item?.reactions?.map((reaction: any, rIdx: number) => (
                    <TouchableOpacity
                      key={reaction.reaction_id || rIdx}
                      delayLongPress={250}
                      onLongPress={() => {
                        setSelectedReactionEmoji(reaction.reaction);
                        setReactionSheetVisible(true);
                      }}
                      style={[
                        styles.reactionBadge,
                        reaction.userReacted && styles.reactionBadgeActive,
                      ]}
                    >
                      <AppText size={12}>{reaction.reaction}</AppText>
                      <AppText
                        size={11}
                        style={[
                          styles.reactionCount,
                          reaction.userReacted && styles.reactionTextActive,
                        ]}
                      >
                        {reaction.reaction_count}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {item.message_count > 0 && renderReplyParticipants()}
            </View>
          </TouchableOpacity>
        </View>

        {viewerVisible && (
          <MediaViewer
            visible={viewerVisible}
            onClose={() => setViewerVisible(false)}
            media={selectedMedia}
            username={item?.username}
            fullName={item?.full_name}
          />
        )}
        <ChatFilePreviewModal
          visible={filePreviewVisible}
          file={selectedFile}
          onClose={() => {
            setFilePreviewVisible(false);
            setSelectedFile(null);
          }}
        />

        <ReactionDetailsSheet
          visible={reactionSheetVisible}
          onClose={() => {
            setReactionSheetVisible(false);
            setSelectedReactionEmoji(null);
          }}
          reactions={item.reactions || []}
          threadId={item.thread_id}
          initialReaction={selectedReactionEmoji}
        />
      </View>
    </View>
  );
};

export default MessageItem;
