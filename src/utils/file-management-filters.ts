import { Folder, Media } from '@/types/thread';
import {
  matchesFolderDateFilter,
  sortFiles,
  sortFolders,
} from '@/utils/file-helpers';
import { FileManagementFilters } from '@/types/file-management';

type FolderFilterContext = Pick<
  FileManagementFilters,
  'mode' | 'uploadedByFilter' | 'dateFilter' | 'searchQuery' | 'sortBy'
> & {
  currentUserId?: string;
  // IDs of the members the "Uploaded By" filter matches. Folders only carry
  // the owner's user_id, not their name, so they are filtered by these IDs.
  uploadedByUserIds?: string[];
};

export const sortFileResults = (
  files: Media[],
  sortBy: FileManagementFilters['sortBy'],
): Media[] => {
  return sortFiles(files, sortBy);
};

export const filterFolders = (
  folders: Folder[],
  context: FolderFilterContext,
): Folder[] => {
  const {
    uploadedByFilter,
    uploadedByUserIds,
    dateFilter,
    searchQuery,
    sortBy,
  } = context;

  let result = [...folders];

  if (uploadedByFilter) {
    const ownerIds = new Set((uploadedByUserIds ?? []).map(String));
    result = result.filter(folder => ownerIds.has(String(folder.user_id)));
  }
  if (dateFilter !== 'any') {
    result = result.filter(folder =>
      matchesFolderDateFilter(folder, dateFilter),
    );
  }
  if (searchQuery.trim()) {
    const query = searchQuery.trim().toLowerCase();
    result = result.filter(folder => folder.name.toLowerCase().includes(query));
  }

  return sortFolders(result, sortBy);
};

type UploaderMember = {
  id: string;
  name?: string;
  username?: string;
  email?: string;
};

// The label shown for a member in the "Uploaded By" sheet. Never empty, so
// picking a member with no name or username still turns the filter on.
export const uploaderLabel = (member: UploaderMember): string =>
  member.name || member.username || member.email || String(member.id);

/**
 * IDs of the members the "Uploaded By" filter refers to. A member picked from
 * the sheet is matched by their ID only; typed text matches names, usernames
 * and emails that contain it.
 */
export const resolveUploaderIds = (
  members: UploaderMember[],
  filter: string | null,
  selectedMemberId?: string | null,
): string[] => {
  if (selectedMemberId) return [String(selectedMemberId)];

  const query = filter?.trim().toLowerCase();
  if (!query) return [];

  return members
    .filter(member =>
      [member.name, member.username, member.email].some(value =>
        (value || '').toLowerCase().includes(query),
      ),
    )
    .map(member => String(member.id));
};

/**
 * What to send as the files API's `owner` filter. The server matches it
 * against a person's full name or username only, so a member picked from the
 * sheet is sent by their name or username, not by the label (which can be an
 * email or an ID). A member with neither can't be matched by the server; that
 * needs an owner ID filter on the API.
 */
export const uploaderApiOwner = (
  members: UploaderMember[],
  filter: string | null,
  selectedMemberId?: string | null,
): string | null => {
  if (!filter) return null;
  if (!selectedMemberId) return filter;
  const member = members.find(m => String(m.id) === String(selectedMemberId));
  return member?.name || member?.username || filter;
};
