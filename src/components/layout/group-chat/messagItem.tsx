import { SavedMessageIndicator } from '@/components/layout/chat/saved-message-indicator';
import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, Dimensions } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createGroupMessageItemStyles } from '@/theme/createMessageStyles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import moment from 'moment';
import MediaViewer from '../chat/media-viewer';
import { useDataContext } from '@/store/useDataContext';
import ReactionDetailsSheet from '../chat/reaction-details';
import { ACTIONS } from '@/store/types';
import { useNavigation } from '@react-navigation/native';
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
import { PinnedMessageBanner } from '../chat/pinned-message-banner';

const { width } = Dimensions.get('window');

const MessageItem = ({
  item,
  index,
  messages,
  onLongPress,
  onMentionUser,
  editMsgId,
  onEdit,
}: any) => {
  const { colors } = useTheme();
  const styles = useMemo(
    () => createGroupMessageItemStyles(colors, width),
    [colors],
  );
  const isReceived = !item.sent;
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [filePreviewVisible, setFilePreviewVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const { state, dispatch } = useDataContext();
  const [reactionSheetVisible, setReactionSheetVisible] = useState(false);
  const [_usernames, _setUsernames] = useState(null);
  const navigation = useNavigation();

  const forwardData = getForwardedMessageFromItem(item);
  const showForwardComment = hasForwardComment(item);

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

  // handle reply
  const handleThread = () => {
    dispatch({ type: ACTIONS.SELECTED_MSG, payload: item });
    dispatch({
      type: ACTIONS.REPLY_CHAT,
      payload: { data: item.preview_reply, page: 1 },
    });

    navigation.navigate('ChatStack', {
      screen: 'GroupChatThreadScreen',
      params: {
        thread_id: item?.thread_id,
        channel_id: item?.channels_id,
      },
    });
    dispatch({ type: ACTIONS.LOAD_THREAD, payload: !state.loadThreadCallback });
  };

  // render media section
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
          onLongPress={() => onLongPress(item)}
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
          onLongPress={() => onLongPress(item)}
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
          onLongPress={() => onLongPress(item)}
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

  // render reaction section
  const renderReactions = () => {
    if (!item.reactions || item.reactions.length === 0) return null;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        delayLongPress={250}
        onLongPress={() => setReactionSheetVisible(true)}
        style={[
          styles.reactionBadge,
          !item.sent ? styles.sentReactionPos : styles.receivedReactionPos,
        ]}
      >
        <View style={styles.reactionEmojiRow}>
          {item.reactions.slice(0, 3).map((r: any, i: number) => (
            <AppText
              key={i}
              style={[
                styles.reactionEmoji,
                { zIndex: 10 - i, marginLeft: i === 0 ? 0 : -2 },
              ]}
            >
              {r.reaction}
            </AppText>
          ))}
          {item.reactions.length > 1 && (
            <AppText size={12} style={styles.reactionCountText}>
              {item.reactions.length}
            </AppText>
          )}
        </View>
      </TouchableOpacity>
    );
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
              style={[styles.threadAvatar, { marginLeft: idx === 0 ? 0 : -8 }]}
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
    );
  };

  const renderMessageContent = () => (
    <MessageContent
      html={item.message}
      media={item.media}
      onMentionUser={onMentionUser}
      textStyle={styles.messageText}
    />
  );

  //

  return (
    <View
      style={
        item.is_pinned ? { backgroundColor: colors.lightYellow } : undefined
      }
    >
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

      <PinnedMessageBanner item={item} />
      <SavedMessageIndicator item={item} />

      <View
        style={[
          styles.rowContainer,
          isReceived ? styles.receivedRow : styles.sentRow,
        ]}
      >
        {isReceived && (
          <TouchableOpacity
            style={styles.groupAvatarContainer}
            onPress={() => onMentionUser(item.user_id)}
          >
            <FastImage
              source={{
                uri: item.avatar_url
                  ? item.avatar_url
                  : item.default_avatar_url,
              }}
              style={styles.groupSenderAvatar}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => onLongPress(item)}
          delayLongPress={200}
          style={[
            styles.messageWrapper,
            !item.sent ? styles.sentWrapper : styles.receivedWrapper,
            isReceived && { maxWidth: '80%' },
          ]}
        >
          <View
            style={[
              styles.bubble,
              !item.sent ? styles.sentBubble : styles.receivedBubble,
              editMsgId === item.thread_id && onEdit
                ? { backgroundColor: colors.chatHighlight }
                : undefined,
            ]}
          >
            {isReceived && (
              <AppText
                size={13}
                variant="bold"
                style={[
                  styles.senderNameLabel,
                  { color: item.senderColor || colors.primary },
                ]}
              >
                {item.username}
              </AppText>
            )}

            {!forwardData && item.media && item.media.length > 0 && (
              <View style={styles.verticalMediaStack}>
                {item.media.map((m: any) => (
                  <View key={m.id || m.url}>{renderMediaItem(m)}</View>
                ))}
              </View>
            )}

            {item.replyTo && (
              <View style={styles.replyContainer}>
                <AppText size={12} style={{ color: colors.primary }}>
                  {item.replyToName || 'You'}
                </AppText>
                <AppText size={13} numberOfLines={1}>
                  {item.replyTo}
                </AppText>
              </View>
            )}

            {forwardData
              ? showForwardComment && renderMessageContent()
              : hasMessageContent(item.message) && renderMessageContent()}

            {forwardData ? (
              <ForwardedMessageBlock
                data={forwardData}
                onMentionUser={onMentionUser}
              />
            ) : null}

            <View style={styles.messageFooter}>
              <AppText size={10} style={styles.timeText}>
                {moment(item.created_at).format('LT')}
              </AppText>
            </View>

            {item.edited && (
              <AppText size={10} style={styles.timeText}>
                Edited
              </AppText>
            )}

            {renderReactions()}
          </View>

          <TouchableOpacity style={styles.threadAction}>
            {item.message_count > 0 && renderReplyParticipants()}
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* Reusable Full Screen Component */}
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
        onClose={() => setReactionSheetVisible(false)}
        reactions={item.reactions || []}
        threadId={item.thread_id}
      />
    </View>
  );
};

export default MessageItem;
