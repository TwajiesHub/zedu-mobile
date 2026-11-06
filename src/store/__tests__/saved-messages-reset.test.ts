jest.mock('@/utils/forward-message', () => ({
  enrichForwardedMessageIfNeeded: (item: unknown) => item,
}));
import reducers from '../Reducers';
import { initialAppState } from '../initial-state';
import { ACTIONS } from '../types';
import { savedFixture } from '@/test-fixtures/saved-message';

test.each(['organisation', 'logout', 'token change'])(
  '%s clears all saved state and rejects old work',
  mode => {
    const before = {
      ...initialAppState,
      token: 'session',
      orgId: 'org-a',
      savedMessages: {
        ...initialAppState.savedMessages,
        lookup: { 'thread:thread-1': savedFixture() },
        pending: { 'thread:thread-1': true },
      },
    };
    const after =
      mode === 'organisation'
        ? reducers(before, { type: ACTIONS.ORG_ID, payload: 'org-b' })
        : mode === 'logout'
        ? reducers(before, { type: ACTIONS.RESET_STATE })
        : reducers(before, { type: ACTIONS.TOKEN, payload: null });
    expect(after.savedMessages.lookup).toEqual({});
    expect(after.savedMessages.pending).toEqual({});
    expect(after.savedMessages.generation).toBeGreaterThan(
      before.savedMessages.generation,
    );
    expect(
      reducers(after, {
        type: ACTIONS.SAVED_MESSAGES,
        payload: {
          orgId: 'org-a',
          generation: before.savedMessages.generation,
          revision: 100,
          kind: 'lookup-success',
          items: [savedFixture()],
        },
      }).savedMessages.lookup,
    ).toEqual({});
  },
);
