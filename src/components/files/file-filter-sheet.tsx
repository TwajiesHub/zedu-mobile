import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/ThemeProvider';
import {
  DATE_MODIFIED_OPTIONS,
  FILE_CATEGORY_OPTIONS,
  FileCategory,
  FileSortOption,
  SORT_OPTIONS,
} from '@/utils/file-helpers';
import { ActiveFilterSheet, DateFilterKey } from '@/types/file-management';
import { useFileManagementStyles } from './file-management.styles';
import { uploaderLabel } from '@/utils/file-management-filters';

type FileFilterSheetProps = {
  activeSheet: ActiveFilterSheet;
  sheetSearch: string;
  fileTypeFilter: FileCategory | null;
  uploadedByFilter: string | null;
  dateFilter: DateFilterKey;
  sortBy: FileSortOption;
  sheetUsers: Array<{
    id: string;
    name?: string;
    username?: string;
    email?: string;
  }>;
  onSheetSearchChange: (value: string) => void;
  onFileTypeFilterChange: (value: FileCategory | null) => void;
  // memberId is passed only when a member is picked, not for typed text.
  onUploadedByFilterChange: (
    value: string | null,
    memberId?: string | null,
  ) => void;
  onDateFilterChange: (value: DateFilterKey) => void;
  onSortByChange: (value: FileSortOption) => void;
  onClose: () => void;
};

const SHEET_TITLES: Record<Exclude<ActiveFilterSheet, null>, string> = {
  type: 'File Type',
  user: 'Uploaded By',
  date: 'Date Modified',
  sort: 'Sort',
};

const FileFilterSheet: React.FC<FileFilterSheetProps> = ({
  activeSheet,
  sheetSearch,
  fileTypeFilter,
  uploadedByFilter,
  dateFilter,
  sortBy,
  sheetUsers,
  onSheetSearchChange,
  onFileTypeFilterChange,
  onUploadedByFilterChange,
  onDateFilterChange,
  onSortByChange,
  onClose,
}) => {
  const styles = useFileManagementStyles();
  const { colors } = useTheme();
  const title = useMemo(() => {
    if (!activeSheet) return '';
    return SHEET_TITLES[activeSheet];
  }, [activeSheet]);

  if (!activeSheet) return null;

  const closeAnd = (action: () => void) => {
    action();
    onClose();
  };

  const applyOwnerFilter = () => {
    const value = sheetSearch.trim();
    onUploadedByFilterChange(value || null);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          style={styles.sheetContainer}
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <AppText variant="bold" size={17} style={styles.sheetTitle}>
            {title}
          </AppText>

          {activeSheet === 'user' && (
            <View style={styles.sheetSearchWrap}>
              <Ionicons name="search" size={18} color={colors.messageMeta} />
              <TextInput
                value={sheetSearch}
                onChangeText={onSheetSearchChange}
                placeholder="Search by name or username"
                placeholderTextColor={colors.messageMeta}
                style={styles.sheetSearchInput}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={applyOwnerFilter}
              />
            </View>
          )}

          <ScrollView
            style={styles.sheetList}
            keyboardShouldPersistTaps="handled"
          >
            {activeSheet === 'type' && (
              <>
                <TouchableOpacity
                  style={styles.sheetItem}
                  onPress={() => closeAnd(() => onFileTypeFilterChange(null))}
                >
                  <Ionicons
                    name="document-outline"
                    size={18}
                    color={colors.messageMeta}
                  />
                  <AppText size={15} style={styles.sheetItemText}>
                    All types
                  </AppText>
                  {!fileTypeFilter && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
                {FILE_CATEGORY_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.sheetItem}
                    onPress={() =>
                      closeAnd(() => onFileTypeFilterChange(option.key))
                    }
                  >
                    <Ionicons
                      name="document-outline"
                      size={18}
                      color={colors.messageMeta}
                    />
                    <AppText size={15} style={styles.sheetItemText}>
                      {option.label}
                    </AppText>
                    {fileTypeFilter === option.key && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}

            {activeSheet === 'user' && (
              <>
                <TouchableOpacity
                  style={styles.sheetItem}
                  onPress={() => closeAnd(() => onUploadedByFilterChange(null))}
                >
                  <AppText size={15} style={styles.sheetItemText}>
                    Anyone
                  </AppText>
                  {!uploadedByFilter && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
                {sheetUsers.map(member => {
                  const label = uploaderLabel(member);
                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.sheetItem}
                      onPress={() =>
                        closeAnd(() =>
                          onUploadedByFilterChange(label, String(member.id)),
                        )
                      }
                    >
                      <View style={styles.sheetAvatar}>
                        <AppText variant="bold" size={11}>
                          {label.slice(0, 2).toUpperCase()}
                        </AppText>
                      </View>
                      <AppText size={15} style={styles.sheetItemText}>
                        {label}
                      </AppText>
                      {uploadedByFilter === label && (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.sheetApplyBtn}
                  onPress={applyOwnerFilter}
                >
                  <AppText
                    variant="bold"
                    size={15}
                    style={styles.sheetApplyText}
                  >
                    Apply filter
                  </AppText>
                </TouchableOpacity>
              </>
            )}

            {activeSheet === 'date' &&
              DATE_MODIFIED_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.sheetItem}
                  onPress={() => closeAnd(() => onDateFilterChange(option.key))}
                >
                  <AppText size={15} style={styles.sheetItemText}>
                    {option.label}
                  </AppText>
                  {dateFilter === option.key && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}

            {activeSheet === 'sort' &&
              SORT_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.sheetItem}
                  onPress={() => closeAnd(() => onSortByChange(option.key))}
                >
                  <AppText size={15} style={styles.sheetItemText}>
                    {option.label}
                  </AppText>
                  {sortBy === option.key && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default FileFilterSheet;
