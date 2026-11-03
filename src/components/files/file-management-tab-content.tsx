import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedRefreshControl } from '@/components/ui/themed-refresh-control';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppText } from '@/components/ui/text';
import { Folder, Media } from '@/types/thread';
import { useTheme } from '@/theme/ThemeProvider';
import { UseFileManagementReturn } from '@/hooks/useFileManagement';
import { useFileManagementStyles } from './file-management.styles';
import FileGridItem from './file-grid-item';
import FileManagementEmptyState from './file-management-empty-state';
import FileManagementFolderHeader from './file-management-folder-header';
import FileManagementListFooter from './file-management-list-footer';
import FileManagementTopChrome from './file-management-top-chrome';
import FolderGridItem from './folder-grid-item';

type FileManagementTabContentProps = {
  vm: UseFileManagementReturn;
};

const FileManagementTabContent: React.FC<FileManagementTabContentProps> = ({
  vm,
}) => {
  const styles = useFileManagementStyles();
  const { colors } = useTheme();
  const {
    isFolderView,
    isFoldersTab,
    filteredFiles,
    filteredFolders,
    activeItemCount,
    activeLoading,
    activeRefreshing,
    activeError,
    activeRefresh,
    activeHasMore,
    activeLoadMore,
    loadMore,
    selectionMode,
    selectedFileIds,
    selectedFileId,
    selectedFolderId,
    searchQuery,
    setSearchQuery,
    mode,
    setMode,
    fileTypeFilter,
    uploadedByFilter,
    dateFilter,
    activeTab,
    handleTabChange,
    openFilterSheet,
    handleFilePress,
    openFileActions,
    handleFolderPress,
    handleFolderLongPress,
    getFileOwnerName,
  } = vm;

  const topChrome = (
    <FileManagementTopChrome
      mode={mode}
      onModeChange={setMode}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isFoldersTab={isFoldersTab}
      fileTypeFilter={fileTypeFilter}
      uploadedByFilter={uploadedByFilter}
      dateFilter={dateFilter}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onOpenFilterSheet={openFilterSheet}
    />
  );

  if (activeLoading && !activeItemCount) {
    return (
      <View style={styles.gridContent}>
        {topChrome}
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (activeError && !activeItemCount) {
    return (
      <View style={styles.gridContent}>
        {topChrome}
        <View style={styles.emptyState}>
          <AppText style={styles.emptyTitle}>
            {isFoldersTab ? 'Unable to load folders' : 'Unable to load files'}
          </AppText>
          <AppText style={styles.emptySubtitle}>{activeError}</AppText>
          <TouchableOpacity style={styles.retryBtn} onPress={activeRefresh}>
            <AppText variant="bold" style={styles.retryText}>
              Retry
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const refreshControl = (
    <ThemedRefreshControl
      refreshing={activeRefreshing}
      onRefresh={activeRefresh}
    />
  );

  const renderFileItem = ({ item }: { item: Media }) => (
    <FileGridItem
      file={item}
      ownerName={getFileOwnerName(item.id)}
      isSelected={selectedFileIds.has(item.id)}
      isHighlighted={
        selectionMode
          ? selectedFileIds.has(item.id)
          : selectedFileId === item.id
      }
      selectionMode={selectionMode}
      onPress={() => handleFilePress(item)}
      onLongPress={() => openFileActions(item)}
    />
  );

  const renderFolderItem = ({ item }: { item: Folder }) => (
    <FolderGridItem
      folder={item}
      isSelected={selectedFolderId === item.id}
      onPress={() => handleFolderPress(item)}
      onLongPress={() => handleFolderLongPress(item)}
    />
  );

  if (isFolderView) {
    return (
      <FlatList
        data={filteredFiles}
        numColumns={2}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={renderFileItem}
        ListHeaderComponent={
          <FileManagementFolderHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        }
        contentContainerStyle={
          filteredFiles.length ? styles.gridContent : styles.listEmptyContent
        }
        columnWrapperStyle={filteredFiles.length ? styles.gridRow : undefined}
        refreshControl={refreshControl}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <FileManagementEmptyState
            title="No files in this folder"
            subtitle="This folder is empty."
            inline
          />
        }
        ListFooterComponent={
          <FileManagementListFooter
            visible={filteredFiles.length > 0 && activeHasMore}
          />
        }
      />
    );
  }

  if (isFoldersTab) {
    return (
      <FlatList
        data={filteredFolders}
        numColumns={2}
        keyExtractor={item => item.id}
        renderItem={renderFolderItem}
        ListHeaderComponent={topChrome}
        contentContainerStyle={
          filteredFolders.length ? styles.gridContent : styles.listEmptyContent
        }
        columnWrapperStyle={filteredFolders.length ? styles.gridRow : undefined}
        refreshControl={refreshControl}
        onEndReached={activeLoadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <FileManagementEmptyState
            title="No folders found"
            subtitle="Try adjusting your filters."
            icon={
              <Ionicons
                name="folder-open-outline"
                size={48}
                color={colors.iconMuted}
              />
            }
            inline
          />
        }
        ListFooterComponent={
          <FileManagementListFooter
            visible={filteredFolders.length > 0 && activeHasMore}
          />
        }
      />
    );
  }

  return (
    <FlatList
      data={filteredFiles}
      numColumns={2}
      keyExtractor={item => item.id}
      renderItem={renderFileItem}
      ListHeaderComponent={topChrome}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={
        filteredFiles.length ? styles.gridContent : styles.listEmptyContent
      }
      columnWrapperStyle={filteredFiles.length ? styles.gridRow : undefined}
      refreshControl={refreshControl}
      onEndReached={activeLoadMore}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        <FileManagementEmptyState
          title="No files found"
          subtitle="Try adjusting your filters."
          inline
        />
      }
      ListFooterComponent={
        <FileManagementListFooter
          visible={filteredFiles.length > 0 && activeHasMore}
        />
      }
    />
  );
};

export default FileManagementTabContent;
