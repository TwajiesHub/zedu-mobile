import React, { useEffect } from 'react';
import renderer, { act } from 'react-test-renderer';
import UseChatDetails from '@/services/chat/chat-details';
import { GetRequest } from '@/utils/requests';

const mockDispatch = jest.fn();

jest.mock('@/utils/requests', () => ({
  GetRequest: jest.fn(),
}));
jest.mock('@/store/useDataContext', () => ({
  useDataContext: () => ({ state: { dmsChat: [] }, dispatch: mockDispatch }),
}));
// Run focus effects as plain effects: the screen is always focused here.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect: mockUseEffect } = require('react');
    mockUseEffect(effect, [effect]);
  },
}));

const mockGetRequest = GetRequest as jest.Mock;

type Result = ReturnType<typeof UseChatDetails>;

const Probe = ({
  channelId,
  onResult,
}: {
  channelId: string;
  onResult: (result: Result) => void;
}) => {
  const result = UseChatDetails({ channel_id: channelId });
  useEffect(() => {
    onResult(result);
  });
  return null;
};

const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(r => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('UseChatDetails isInitialLoading', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockGetRequest.mockReset();
  });

  it('stays true until the first page of this channel loads', async () => {
    const page = deferred();
    mockGetRequest.mockReturnValue(page.promise);
    let latest: Result | undefined;

    await act(async () => {
      renderer.create(<Probe channelId="c1" onResult={r => (latest = r)} />);
    });
    expect(latest?.isInitialLoading).toBe(true);

    await act(async () => {
      page.resolve({ data: { data: [{ thread_id: 't1' }] }, error: null });
    });
    expect(latest?.isInitialLoading).toBe(false);
  });

  it('turns true again when the channel changes', async () => {
    mockGetRequest.mockResolvedValue({
      data: { data: [{ thread_id: 't1' }] },
      error: null,
    });
    let latest: Result | undefined;
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderer.create(
        <Probe channelId="c1" onResult={r => (latest = r)} />,
      );
    });
    expect(latest?.isInitialLoading).toBe(false);

    const next = deferred();
    mockGetRequest.mockReturnValue(next.promise);
    await act(async () => {
      tree?.update(<Probe channelId="c2" onResult={r => (latest = r)} />);
    });
    expect(latest?.isInitialLoading).toBe(true);

    await act(async () => {
      next.resolve({ data: { data: [] }, error: null });
    });
    expect(latest?.isInitialLoading).toBe(false);
  });
});
