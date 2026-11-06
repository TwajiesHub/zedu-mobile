import { SavedMessageIndicator } from '@/components/layout/chat/saved-message-indicator';
import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createThreadItemStyles } from '@/theme/createChatOverlayStyles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MediaViewer from '../chat/media-viewer';
import Video from 'react-native-video';
import moment from 'moment';
import { ChannelChat } from '@/types/channel';
import { MessageContent } from '../chat/message-content';
import { hasMessageContent } from '@/utils/message-text';
import FastImage from 'react-native-fast-image';
import { UserStatusIcon } from '@/components/ui/user-status-icon';
import { truncateUsernameForChannel } from '@/utils/truncate-username';
import { isVideoFile } from '@/utils/file-helpers';
import { isVoiceMessageMedia } from '@/utils/voice-message';
import { AudioMessagePlayer } from '../chat/audio-message-player';
import ReactionDetailsSheet from '../chat/reaction-details';
import { PinnedMessageBanner } from '../chat/pinned-message-banner';

const ThreadMessageItem = ({
  item,
  index,
  messages,
  onLongPress,
  onMentionUser,
  onMentionChannel,
  isGroup,
  inverted = false,
}: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createThreadItemStyles(colors), [colors]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [reactionSheetVisible, setReactionSheetVisible] = useState(false);
  const [selectedReactionEmoji, setSelectedReactionEmoji] = useState<
    string | null
  >(null);

  let showDateHeader = false;
  try {
    if (inverted) {
      // For inverted lists the visual previous item is at index + 1
      showDateHeader =
        index === messages.length - 1 ||
        (messages[index + 1] &&
          moment(messages[index + 1].created_at).format('YYYY-MM-DD') !==
            moment(item.created_at).format('YYYY-MM-DD'));
    } else {
      // Normal lists: show header when the previous item has a different date
      showDateHeader =
        index === 0 ||
        (messages[index - 1] &&
          moment(messages[index - 1].created_at).format('YYYY-MM-DD') !==
            moment(item.created_at).format('YYYY-MM-DD'));
    }
  } catch (_err) {
    showDateHeader = false;
  }

  const getFileTheme = (fileName: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return { color: '#FF5722', label: 'PDF' };
    if (ext === 'doc' || ext === 'docx')
      return { color: '#2B579A', label: 'DOC' };
    if (ext === 'xls' || ext === 'xlsx')
      return { color: '#217346', label: 'XLS' };
    return { color: '#607D8B', label: 'FILE' };
  };

  const handleMediaPress = (media: any) => {
    setSelectedMedia(media);
    setViewerVisible(true);
  };

  const handlePress = (item: ChannelChat) => {
    if (item?.type === 'system') return;
    onLongPress(item);
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
      const theme = getFileTheme(mediaItem.file_name);
      return (
        <View key={mediaItem.id} style={styles.complexFileWrapper}>
          <View style={styles.fileMainRow}>
            <View
              style={[styles.fileIconBox, { backgroundColor: theme.color }]}
            >
              <AppText style={styles.fileExtText}>{theme.label}</AppText>
            </View>
            <View style={styles.fileInfo}>
              <AppText numberOfLines={1} style={styles.fileNameText}>
                {mediaItem.file_name}
              </AppText>
              <AppText size={11} style={styles.fileMetaText}>
                {(mediaItem.size / 1024).toFixed(1)} KB • {theme.label}
              </AppText>
            </View>
          </View>
        </View>
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
        <UserStatusIcon user={item} style={styles.threadStatusIcon} />
        <TouchableOpacity
          style={styles.groupAvatarContainer}
          onPress={() => onMentionUser?.(item.user_id)}
        >
          <FastImage
            source={{ uri: item.avatar_url || item.default_avatar_url }}
            style={styles.groupSenderAvatar}
          />
        </TouchableOpacity>

        <View style={styles.messageColumn}>
          <PinnedMessageBanner item={item} />
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => handlePress(item)}
            delayLongPress={200}
            style={[styles.messageWrapper, isGroup && { maxWidth: '100%' }]}
          >
            <View style={{ width: '100%', minWidth: 0 }}>
              <View style={styles.senderRow}>
                <AppText
                  size={13}
                  variant="bold"
                  numberOfLines={1}
                  style={{
                    color: item.senderColor || colors.primary,
                    flex: 1,
                    minWidth: 0,
                    marginRight: 4,
                  }}
                >
                  {truncateUsernameForChannel(item.username)}
                </AppText>
                <AppText size={10} style={styles.timeText}>
                  {moment(item.created_at).format('h:mm a')}
                </AppText>
              </View>

              {item.media && item.media.length > 0 && (
                <View style={styles.verticalMediaStack}>
                  {item.media.map((m: any) => (
                    <View key={m.id || m.url}>{renderMediaItem(m)}</View>
                  ))}
                </View>
              )}

              <SavedMessageIndicator item={item} reply />
              {hasMessageContent(item.message || item.text) && (
                <View style={styles.messageTextContainer}>
                  <MessageContent
                    html={item.message || item.text}
                    media={item.media}
                    onMentionUser={onMentionUser}
                    onMentionChannel={onMentionChannel}
                  />
                </View>
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

        <ReactionDetailsSheet
          visible={reactionSheetVisible}
          onClose={() => {
            setReactionSheetVisible(false);
            setSelectedReactionEmoji(null);
          }}
          reactions={item.reactions || []}
          threadId={item.thread_id || item.id}
          initialReaction={selectedReactionEmoji}
        />
      </View>
    </View>
  );
};

export default ThreadMessageItem;
