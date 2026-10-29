import React, { useState, forwardRef, useMemo } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createExitChatStyles } from '@/theme/createChatOverlayStyles';
import { PostRequest } from '@/utils/requests';
import { useDataContext } from '@/store/useDataContext';
import { ACTIONS } from '@/store/types';
import AppBottomSheet from '@/components/ui/bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

interface Props {
  onClose: () => void;
  channel_id: string;
  groupName: string;
}

export const ExitChannelSheet = forwardRef<any, Props>(
  ({ onClose, channel_id, groupName }, ref: any) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createExitChatStyles(colors), [colors]);
    const [loading, setLoading] = useState(false);
    const { dispatch } = useDataContext();
    const navigation = useNavigation();

    const handleExitChannel = async () => {
      setLoading(true);
      const { data, error } = await PostRequest(
        `/channels/${channel_id}/leave`,
        {},
      );

      if (!error) {
        dispatch({ type: ACTIONS.SUCCESS, payload: data.message });
        onClose();
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'MainTabs',
              state: {
                routes: [
                  {
                    name: 'Tabs',
                    state: {
                      routes: [{ name: 'Channels' }],
                      index: 0,
                    },
                  },
                ],
                index: 0,
              },
            },
          ],
        });
        // Disable swipe back gesture for ChannelList (iOS)
        setTimeout(() => {
          const parent = navigation.getParent && navigation.getParent();
          if (parent && parent.setOptions) {
            parent.setOptions({ gestureEnabled: false });
          }
        }, 100);
      } else {
        dispatch({ type: ACTIONS.ERROR, payload: error });
      }
      setLoading(false);
    };

    return (
      <AppBottomSheet
        ref={ref}
        snapPoints={['50%']}
        enablePanDownToClose={true}
        onClose={onClose}
      >
        <View style={styles.mainWrapper}>
          {/* Visual Header Indicator */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="log-out" size={28} color="#D32F2F" />
            </View>
            <AppText variant="bold" size={20} style={styles.headerTitle}>
              Exit Channel
            </AppText>
          </View>

          <View style={styles.content}>
            <View style={styles.warningBox}>
              <AppText style={styles.warningText}>
                Are you sure you want to leave{' '}
                <AppText variant="bold" style={styles.warningTextEmphasis}>
                  "{groupName}"
                </AppText>
                ? You will no longer be able to send messages or see new updates
                from this channel.
              </AppText>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={loading}
              >
                <AppText variant="bold" style={styles.cancelBtnText}>
                  Cancel
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exitButton}
                onPress={handleExitChannel}
                disabled={loading}
              >
                {loading && <ActivityIndicator size="small" color="#FFF" />}
                <AppText variant="bold" style={styles.exitBtnText}>
                  Exit Channel
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppBottomSheet>
    );
  },
);

// i need you to implement the voice recording player feature and make it work perfectly using the right tool.

//     Check the messageItem inside the /component/layout folder for channels, group - chat and chat.

// Where you render the Audio file, make the audio player work perfectly.

// Make sure no errors are introduced.
// Follow best practices and follow the codebase structure.

// Make sure your implementation works for both android and IOS and do not alter the codebase functionality.
