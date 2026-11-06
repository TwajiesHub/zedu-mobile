import { SavedMessage, savedMessageKey } from '@/types/saved-message';

export type SavedMessagesState = {
  generation: number;
  lookup: Record<string, SavedMessage>;
  pending: Record<string, boolean>;
  versions: Record<string, number>;
  lookupLoaded: boolean;
  lookupLoading: boolean;
  lookupError: string | null;
  lookupInvalidatedAt: number;
  items: SavedMessage[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  listRequest: number;
};

export const initialSavedMessages = (generation = 0): SavedMessagesState => ({
  generation,
  lookup: {},
  pending: {},
  versions: {},
  lookupLoaded: false,
  lookupLoading: false,
  lookupError: null,
  lookupInvalidatedAt: 0,
  items: [],
  page: 0,
  hasMore: true,
  loading: false,
  refreshing: false,
  error: null,
  listRequest: 0,
});

type Scope = { orgId: string; generation: number; revision: number };
export type SavedMessagesMutation = Scope &
  (
    | { kind: 'lookup-begin' }
    | { kind: 'lookup-success'; items: SavedMessage[] }
    | { kind: 'lookup-error'; error: string }
    | { kind: 'list-begin'; refresh: boolean }
    | {
        kind: 'list-success';
        items: SavedMessage[];
        page: number;
        hasMore: boolean;
      }
    | { kind: 'list-error'; error: string }
    | { kind: 'begin'; key: string; value?: SavedMessage }
    | { kind: 'finish'; key: string; value?: SavedMessage; uncertain?: boolean }
  );

export function reduceSavedMessages(
  state: SavedMessagesState,
  action: SavedMessagesMutation,
): SavedMessagesState {
  if (action.generation !== state.generation) return state;
  if (action.kind === 'lookup-begin') {
    return { ...state, lookupLoading: true, lookupError: null };
  }
  if (action.kind === 'lookup-error') {
    return { ...state, lookupLoading: false, lookupError: action.error };
  }
  if (action.kind === 'list-begin') {
    return {
      ...state,
      loading: true,
      refreshing: action.refresh,
      error: null,
      listRequest: action.revision,
    };
  }
  if (action.kind === 'list-error') {
    if (action.revision !== state.listRequest) return state;
    return { ...state, loading: false, refreshing: false, error: action.error };
  }
  if (action.kind === 'begin' || action.kind === 'finish') {
    const lookup = { ...state.lookup };
    const pending = { ...state.pending };
    if (action.value) lookup[action.key] = action.value;
    else delete lookup[action.key];
    if (action.kind === 'begin') pending[action.key] = true;
    else delete pending[action.key];
    const index = state.items.findIndex(
      item => savedMessageKey(item) === action.key,
    );
    const items = state.items.filter(
      item => savedMessageKey(item) !== action.key,
    );
    if (action.value && (state.page > 0 || index >= 0)) {
      items.splice(index >= 0 ? index : 0, 0, action.value);
    }
    return {
      ...state,
      lookup,
      pending,
      items,
      versions: { ...state.versions, [action.key]: action.revision },
      lookupLoaded:
        action.kind === 'finish' && action.uncertain
          ? false
          : state.lookupLoaded,
      lookupInvalidatedAt:
        action.kind === 'finish' && action.uncertain
          ? action.revision
          : state.lookupInvalidatedAt,
    };
  }
  if (action.kind === 'list-success' && action.revision !== state.listRequest)
    return state;
  const incoming = Object.fromEntries(
    action.items.map(item => [savedMessageKey(item), item]),
  );
  const lookup =
    action.kind === 'lookup-success'
      ? { ...incoming }
      : { ...state.lookup, ...incoming };
  // A late GET must not erase another row's completed or pending mutation.
  for (const key of Object.keys(state.versions)) {
    if (state.pending[key] || state.versions[key] > action.revision) {
      if (state.lookup[key]) lookup[key] = state.lookup[key];
      else delete lookup[key];
    }
  }
  if (action.kind === 'lookup-success') {
    return {
      ...state,
      lookup,
      lookupLoaded: action.revision >= state.lookupInvalidatedAt,
      lookupLoading: false,
      lookupError: null,
    };
  }
  const listed = new Map<string, SavedMessage>();
  const source = action.page === 1 ? [] : state.items;
  [...source, ...action.items].forEach(item => {
    const key = savedMessageKey(item);
    if (lookup[key]) listed.set(key, lookup[key]);
  });
  state.items.forEach(item => {
    const key = savedMessageKey(item);
    if (
      (state.pending[key] || state.versions[key] > action.revision) &&
      lookup[key]
    ) {
      listed.set(key, lookup[key]);
    }
  });
  return {
    ...state,
    lookup,
    items: [...listed.values()],
    page: action.page,
    hasMore: action.hasMore,
    loading: false,
    refreshing: false,
    error: null,
  };
}
