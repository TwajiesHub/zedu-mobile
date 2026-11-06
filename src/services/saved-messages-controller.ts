import * as api from './saved-messages';
import {
  SavedMessage,
  SavedTarget,
  savedMessageKey,
} from '@/types/saved-message';
import {
  SavedMessagesMutation,
  SavedMessagesState,
} from '@/store/saved-messages';

type State = { orgId: string | null; savedMessages: SavedMessagesState };
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Could not update Later. Please try again.';

/** Shared by all menu rows and Later; never retry a toggle POST automatically. */
export class SavedMessagesController {
  private revision = 0;
  private operations = new Map<string, Promise<boolean>>();
  private lookups = new Map<string, Promise<void>>();
  private list?: { scope: string; page: number; promise: Promise<void> };

  constructor(
    private getState: () => State,
    private dispatch: (action: SavedMessagesMutation) => void,
  ) {}

  private scope() {
    const { orgId, savedMessages } = this.getState();
    return { orgId: orgId || '', generation: savedMessages.generation };
  }

  private current(scope: ReturnType<SavedMessagesController['scope']>) {
    const now = this.scope();
    return now.orgId === scope.orgId && now.generation === scope.generation;
  }

  loadLookup = (force = false): Promise<void> => {
    const scope = this.scope();
    if (!scope.orgId) return Promise.resolve();
    const key = `${scope.orgId}:${scope.generation}`;
    const active = this.lookups.get(key);
    if (active) return active;
    if (!force && this.getState().savedMessages.lookupLoaded)
      return Promise.resolve();
    const revision = ++this.revision;
    this.dispatch({ ...scope, revision, kind: 'lookup-begin' });
    const promise = api
      .fetchSavedLookup(scope.orgId)
      .then(items => {
        this.dispatch({ ...scope, revision, kind: 'lookup-success', items });
      })
      .catch(error => {
        this.dispatch({
          ...scope,
          revision,
          kind: 'lookup-error',
          error: errorText(error),
        });
        throw error;
      })
      .finally(() => this.lookups.delete(key));
    this.lookups.set(key, promise);
    return promise;
  };

  loadPage = (refresh = false): Promise<void> => {
    const scope = this.scope();
    if (!scope.orgId) return Promise.resolve();
    const state = this.getState().savedMessages;
    if (!refresh && !state.hasMore) return Promise.resolve();
    const page = refresh ? 1 : state.page + 1;
    const key = `${scope.orgId}:${scope.generation}`;
    if (this.list?.scope === key && (this.list.page === 1 || !refresh))
      return this.list.promise;
    const revision = ++this.revision;
    this.dispatch({ ...scope, revision, kind: 'list-begin', refresh });
    const promise = api
      .fetchSavedMessages(scope.orgId, page)
      .then(result => {
        this.dispatch({ ...scope, revision, kind: 'list-success', ...result });
      })
      .catch(error => {
        this.dispatch({
          ...scope,
          revision,
          kind: 'list-error',
          error: errorText(error),
        });
      })
      .finally(() => {
        if (this.list?.promise === promise) this.list = undefined;
      });
    this.list = { scope: key, page, promise };
    return promise;
  };

  setSaved = (target: SavedTarget, desired: boolean): Promise<boolean> => {
    if (
      !target.channel_id ||
      !target.thread_id ||
      (target.type === 'message' && !target.message_id)
    ) {
      return Promise.resolve(false);
    }
    return this.run(target, desired);
  };

  remove = (item: SavedMessage) => this.run(item, false, item);

  private run(
    target: SavedTarget,
    desired: boolean,
    record?: SavedMessage,
  ): Promise<boolean> {
    const scope = this.scope();
    if (!scope.orgId) return Promise.resolve(false);
    const key = savedMessageKey(target);
    const lock = `${scope.orgId}:${scope.generation}:${key}`;
    const active = this.operations.get(lock);
    if (active) return active;
    const promise = this.mutate(scope, target, desired, record).finally(() =>
      this.operations.delete(lock),
    );
    this.operations.set(lock, promise);
    return promise;
  }

  private async mutate(
    scope: ReturnType<SavedMessagesController['scope']>,
    target: SavedTarget,
    desired: boolean,
    record?: SavedMessage,
  ): Promise<boolean> {
    const key = savedMessageKey(target);
    try {
      if (!record) await this.loadLookup();
    } catch {
      return false;
    }
    if (
      !this.current(scope) ||
      (!record && !this.getState().savedMessages.lookupLoaded)
    )
      return false;
    const previous = this.getState().savedMessages.lookup[key] || record;
    if (Boolean(previous) === desired) return true;
    const optimistic = desired
      ? { ...target, id: '', saved_at: new Date().toISOString() }
      : undefined;
    this.dispatch({
      ...scope,
      revision: ++this.revision,
      kind: 'begin',
      key,
      value: optimistic,
    });
    let success = false;
    try {
      let value: SavedMessage | undefined;
      if (desired) {
        const id = await api.saveMessage(scope.orgId, target);
        // A toggle response without a saved id may mean the item was removed.
        // Reconcile with GET, never repeat the POST to guess its outcome.
        if (id) value = { ...optimistic!, id };
        else {
          if (!this.current(scope)) return false;
          const revision = ++this.revision;
          const items = await api.fetchSavedLookup(scope.orgId);
          this.dispatch({ ...scope, revision, kind: 'lookup-success', items });
          value = items.find(item => savedMessageKey(item) === key);
        }
      } else if (previous?.id) {
        await api.deleteSavedMessage(scope.orgId, previous.id);
      }
      if (!this.current(scope)) return false;
      this.dispatch({
        ...scope,
        revision: ++this.revision,
        kind: 'finish',
        key,
        value,
      });
      success = Boolean(value) === desired;
    } catch {
      this.dispatch({
        ...scope,
        revision: ++this.revision,
        kind: 'finish',
        key,
        value: previous,
        uncertain: true,
      });
    }
    // Page boundaries shift after removal. If a list read was already in
    // flight, follow it with a fresh first page rather than reusing its result.
    const refresh = () => {
      if (this.current(scope) && this.getState().savedMessages.page > 0)
        this.loadPage(true);
    };
    if (this.list?.scope === `${scope.orgId}:${scope.generation}`)
      this.list.promise.then(refresh);
    else refresh();
    return success;
  }
}
