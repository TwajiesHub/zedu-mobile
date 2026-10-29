import React, { useState, forwardRef, useMemo } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import { createExitChatStyles } from '@/theme/createChatOverlayStyles';
import { DeleteRequest } from '@/utils/requests';
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

export const ExitGroupSheet = forwardRef<any, Props>(
  ({ onClose, channel_id, groupName }, ref: any) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createExitChatStyles(colors), [colors]);
    const [loading, setLoading] = useState(false);
    const { state, dispatch } = useDataContext();
    const { orgId } = state;
    const navigation = useNavigation();

    const handleExitGroup = async () => {
      setLoading(true);
      const { error } = await DeleteRequest(
        `/organisations/${orgId}/group-dms/${channel_id}/leave`,
      );

      if (!error) {
        dispatch({ type: ACTIONS.SUCCESS, payload: 'You have left the group' });
        onClose();
        navigation.navigate('MainTabs');
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
              Exit Group
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
                from this group.
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
                onPress={handleExitGroup}
                disabled={loading}
              >
                {loading && <ActivityIndicator size="small" color="#FFF" />}
                <AppText variant="bold" style={styles.exitBtnText}>
                  Exit Group
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppBottomSheet>
    );
  },
);
