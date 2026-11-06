import { SavedMessagesController } from '../saved-messages-controller';
import * as api from '../saved-messages';
import {
  initialSavedMessages,
  reduceSavedMessages,
  SavedMessagesState,
} from '@/store/saved-messages';
import { savedFixture } from '@/test-fixtures/saved-message';

jest.mock('../saved-messages', () => ({
  fetchSavedLookup: jest.fn(),
  fetchSavedMessages: jest.fn(),
  saveMessage: jest.fn(),
  deleteSavedMessage: jest.fn(),
}));
const calls = jest.mocked(api);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const setup = (loaded = true) => {
  let state: { orgId: string; savedMessages: SavedMessagesState } = {
    orgId: 'org-a',
    savedMessages: { ...initialSavedMessages(), lookupLoaded: loaded },
  };
  const controller = new SavedMessagesController(
    () => state,
    action => {
      if (action.orgId === state.orgId)
        state = {
          ...state,
          savedMessages: reduceSavedMessages(state.savedMessages, action),
        };
    },
  );
  return {
    controller,
    get state() {
      return state.savedMessages;
    },
    switchOrg: (orgId: string) => {
      state = {
        orgId,
        savedMessages: initialSavedMessages(state.savedMessages.generation + 1),
      };
    },
  };
};
beforeEach(() => {
  jest.resetAllMocks();
  calls.fetchSavedLookup.mockResolvedValue([]);
  calls.fetchSavedMessages.mockResolvedValue({
    items: [],
    page: 1,
    hasMore: false,
  });
  calls.deleteSavedMessage.mockResolvedValue();
});

test('optimistic save, dedupe across callers, and server id', async () => {
  const s = setup();
  const reply = deferred<string>();
  calls.saveMessage.mockReturnValue(reply.promise);
  const first = s.controller.setSaved(savedFixture(), true);
  const second = s.controller.setSaved(savedFixture(), true);
  expect(first).toBe(second);
  await Promise.resolve();
  expect(s.state.pending['thread:thread-1']).toBe(true);
  expect(s.state.lookup['thread:thread-1'].id).toBe('');
  reply.resolve('server-saved');
  await first;
  expect(s.state.lookup['thread:thread-1'].id).toBe('server-saved');
  expect(s.state.pending).toEqual({});
  expect(calls.saveMessage).toHaveBeenCalledTimes(1);
});
test('reversed successes and a failed row do not erase another save', async () => {
  const s = setup();
  const a = deferred<string>();
  const b = deferred<string>();
  calls.saveMessage
    .mockReturnValueOnce(a.promise)
    .mockReturnValueOnce(b.promise);
  const first = s.controller.setSaved(savedFixture(), true);
  const second = s.controller.setSaved(
    savedFixture({ thread_id: 'thread-2' }),
    true,
  );
  await Promise.resolve();
  b.resolve('saved-b');
  await second;
  a.reject(new Error('network'));
  await first;
  expect(s.state.lookup['thread:thread-1']).toBeUndefined();
  expect(s.state.lookup['thread:thread-2'].id).toBe('saved-b');
  expect(s.state.lookupLoaded).toBe(false);
});
test('a timed-out POST is reconciled with GET before another user attempt', async () => {
  const s = setup();
  calls.saveMessage.mockRejectedValue(new Error('lost response'));
  expect(await s.controller.setSaved(savedFixture(), true)).toBe(false);
  calls.fetchSavedLookup.mockResolvedValue([savedFixture()]);
  expect(await s.controller.setSaved(savedFixture(), true)).toBe(true);
  expect(calls.saveMessage).toHaveBeenCalledTimes(1);
});
test('an existing save is removed with DELETE and rolls back on failure', async () => {
  const s = setup(false);
  calls.fetchSavedLookup.mockResolvedValue([savedFixture()]);
  await s.controller.loadLookup();
  calls.deleteSavedMessage.mockRejectedValue(new Error('network'));
  expect(await s.controller.setSaved(savedFixture(), false)).toBe(false);
  expect(calls.deleteSavedMessage).toHaveBeenCalledWith('org-a', 'saved-1');
  expect(s.state.lookup['thread:thread-1'].id).toBe('saved-1');
  expect(calls.saveMessage).not.toHaveBeenCalled();
});
test('saving a reply never marks its parent saved', async () => {
  const s = setup();
  calls.saveMessage.mockResolvedValue('saved-reply');
  await s.controller.setSaved(
    savedFixture({ type: 'message', message_id: 'reply-1' }),
    true,
  );
  expect(s.state.lookup['reply:reply-1'].id).toBe('saved-reply');
  expect(s.state.lookup['thread:thread-1']).toBeUndefined();
});
test('an old initial load cannot erase a later save', async () => {
  const s = setup();
  const load = deferred<ReturnType<typeof savedFixture>[]>();
  calls.fetchSavedLookup.mockReturnValue(load.promise);
  const initial = s.controller.loadLookup(true);
  calls.saveMessage.mockResolvedValue('new-id');
  // Lookup was already authoritative when the refresh began, so the action can proceed.
  // Finish the read first to unblock the shared preflight, then start a list read.
  load.resolve([]);
  await initial;
  const page = deferred<{
    items: ReturnType<typeof savedFixture>[];
    page: number;
    hasMore: boolean;
  }>();
  calls.fetchSavedMessages.mockReturnValue(page.promise);
  const list = s.controller.loadPage(true);
  await s.controller.setSaved(savedFixture(), true);
  page.resolve({ items: [], page: 1, hasMore: false });
  await list;
  expect(s.state.lookup['thread:thread-1'].id).toBe('new-id');
});
test('org switch away and back discards pending completions', async () => {
  const s = setup();
  const save = deferred<string>();
  calls.saveMessage.mockReturnValue(save.promise);
  const pending = s.controller.setSaved(savedFixture(), true);
  await Promise.resolve();
  s.switchOrg('org-b');
  s.switchOrg('org-a');
  save.resolve('old-id');
  await pending;
  expect(s.state.lookup).toEqual({});
  expect(s.state.pending).toEqual({});
});
test('org switch during preflight sends no POST', async () => {
  const s = setup(false);
  const lookup = deferred<ReturnType<typeof savedFixture>[]>();
  calls.fetchSavedLookup.mockReturnValue(lookup.promise);
  const pending = s.controller.setSaved(savedFixture(), true);
  s.switchOrg('org-b');
  lookup.resolve([]);
  await pending;
  expect(calls.saveMessage).not.toHaveBeenCalled();
  expect(s.state.lookup).toEqual({});
});
test('pagination coalesces duplicate end-reached calls and retries the failed page', async () => {
  const s = setup();
  const page = deferred<{
    items: ReturnType<typeof savedFixture>[];
    page: number;
    hasMore: boolean;
  }>();
  calls.fetchSavedMessages.mockReturnValueOnce(page.promise);
  const first = s.controller.loadPage();
  expect(s.controller.loadPage()).toBe(first);
  page.resolve({ items: [savedFixture()], page: 1, hasMore: true });
  await first;
  calls.fetchSavedMessages.mockRejectedValueOnce(new Error('network'));
  await s.controller.loadPage();
  expect(s.state.page).toBe(1);
  expect(s.state.items).toHaveLength(1);
  calls.fetchSavedMessages.mockResolvedValueOnce({
    items: [],
    page: 2,
    hasMore: false,
  });
  await s.controller.loadPage();
  expect(calls.fetchSavedMessages).toHaveBeenLastCalledWith('org-a', 2);
});

test('an in-flight GET cannot certify the result of a later timed-out toggle', async () => {
  const s = setup();
  const save = deferred<string>();
  const lookup = deferred<ReturnType<typeof savedFixture>[]>();
  calls.saveMessage.mockReturnValue(save.promise);
  const saving = s.controller.setSaved(savedFixture(), true);
  await Promise.resolve();
  calls.fetchSavedLookup.mockReturnValueOnce(lookup.promise);
  const reading = s.controller.loadLookup(true);
  save.reject(new Error('lost response'));
  await saving;
  lookup.resolve([]);
  await reading;
  expect(s.state.lookupLoaded).toBe(false);
  calls.fetchSavedLookup.mockResolvedValueOnce([savedFixture()]);
  expect(await s.controller.setSaved(savedFixture(), true)).toBe(true);
  expect(calls.saveMessage).toHaveBeenCalledTimes(1);
});

test('a toggle with no saved id reconciles by GET and never repeats its POST', async () => {
  const s = setup();
  calls.saveMessage.mockResolvedValue(null);
  calls.fetchSavedLookup.mockResolvedValue([
    savedFixture({ id: 'resolved-id' }),
  ]);
  expect(await s.controller.setSaved(savedFixture(), true)).toBe(true);
  expect(s.state.lookup['thread:thread-1'].id).toBe('resolved-id');
  expect(calls.saveMessage).toHaveBeenCalledTimes(1);
});

test('a removal during a list read queues a fresh first page before further paging', async () => {
  const s = setup(false);
  calls.fetchSavedLookup.mockResolvedValue([savedFixture()]);
  await s.controller.loadLookup();
  const page = deferred<{
    items: ReturnType<typeof savedFixture>[];
    page: number;
    hasMore: boolean;
  }>();
  const next = savedFixture({ id: 'saved-2', thread_id: 'thread-2' });
  calls.fetchSavedMessages
    .mockReturnValueOnce(page.promise)
    .mockResolvedValueOnce({ items: [next], page: 1, hasMore: false });
  const loading = s.controller.loadPage(true);
  await s.controller.remove(savedFixture());
  page.resolve({ items: [savedFixture()], page: 1, hasMore: true });
  await loading;
  await Promise.resolve();
  await Promise.resolve();
  expect(calls.fetchSavedMessages).toHaveBeenCalledTimes(2);
  expect(calls.fetchSavedMessages).toHaveBeenLastCalledWith('org-a', 1);
  expect(s.state.items).toEqual([next]);
});
