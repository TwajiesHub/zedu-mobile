import reducers, { AppState } from '@/store/Reducers';
import { ACTIONS } from '@/store/types';

// central-staging has no jest.setup.js stub for AsyncStorage yet.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const baseState = (overrides: Partial<AppState>) =>
  ({ dms: [], participant: [], ...overrides } as unknown as AppState);

describe('UPDATE_USER_PRESENCE', () => {
  it('updates the user in the Chats list and in the open chat', () => {
    const state = baseState({
      dms: [
        {
          channel_id: 'c1',
          participants: [
            { user_id: 'me', online: true },
            { user_id: 'them', online: false },
          ],
        },
        { channel_id: 'c2', participants: [{ user_id: 'other' }] },
      ] as any,
      participant: [{ user_id: 'them', online: false }] as any,
    });

    const next = reducers(state, {
      type: ACTIONS.UPDATE_USER_PRESENCE,
      payload: { user_id: 'them', online: true },
    });

    expect(next.dms[0].participants[1].online).toBe(true);
    expect(next.dms[0].participants[0].online).toBe(true);
    expect(next.dms[1]).toBe(state.dms[1]);
    expect(next.participant[0].online).toBe(true);
  });

  it('returns the same state when nothing changes', () => {
    const state = baseState({
      dms: [
        { channel_id: 'c1', participants: [{ user_id: 'them', online: true }] },
      ] as any,
      participant: [{ user_id: 'them', online: true }] as any,
    });

    const next = reducers(state, {
      type: ACTIONS.UPDATE_USER_PRESENCE,
      payload: { user_id: 'them', online: true },
    });

    expect(next).toBe(state);
  });
});
