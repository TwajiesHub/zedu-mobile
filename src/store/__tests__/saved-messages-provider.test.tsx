import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { DataProvider } from '../GlobalState';
import { useDataContext } from '../useDataContext';
import { ACTIONS } from '../types';
import * as api from '@/services/saved-messages';
import { savedFixture } from '@/test-fixtures/saved-message';

jest.mock('@/utils/forward-message', () => ({
  enrichForwardedMessageIfNeeded: (item: unknown) => item,
}));
jest.mock('@/services/saved-messages', () => ({
  fetchSavedLookup: jest.fn(),
  fetchSavedMessages: jest.fn(),
  saveMessage: jest.fn(),
  deleteSavedMessage: jest.fn(),
}));
const calls = jest.mocked(api);
let context: ReturnType<typeof useDataContext>;
function Observer() {
  context = useDataContext();
  return null;
}

test('batched lookup completion is authoritative before deciding whether to POST', async () => {
  calls.fetchSavedLookup.mockResolvedValue([savedFixture()]);
  calls.deleteSavedMessage.mockResolvedValue();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <DataProvider>
        <Observer />
      </DataProvider>,
    );
  });
  await act(async () => {
    context.dispatch({ type: ACTIONS.ORG_ID, payload: 'org-a' });
    expect(
      await context.savedMessagesController!.setSaved(savedFixture(), true),
    ).toBe(true);
  });
  expect(calls.saveMessage).not.toHaveBeenCalled();
  expect(context.state.savedMessages.lookup['thread:thread-1'].id).toBe(
    'saved-1',
  );
  await act(async () => {
    await context.savedMessagesController!.setSaved(savedFixture(), false);
  });
  expect(calls.deleteSavedMessage).toHaveBeenCalledWith('org-a', 'saved-1');
  expect(context.state.savedMessages.lookup).toEqual({});
  act(() => tree.unmount());
});
