import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  Clipboard,
  FlatList,
  Switch,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import ChannelWebhookScreen from '@/screens/channels/webhooks';
import WebhookHistoryScreen from '@/screens/channels/webhooks/history';
import * as api from '@/services/channel-webhooks';
import { webhookFixture, historyFixture } from '@/data/test-fixtures/webhook';
import { ShowNotify } from '@/components/ui/toast';

// The permission helper imports the roles service; these screen tests use role
// data from context and must not load the native-backed HTTP client.
jest.mock('@/utils/requests', () => ({ GetRequest: jest.fn() }));
jest.mock('@/services/channel-webhooks', () => ({
  getChannelWebhook: jest.fn(),
  createChannelWebhook: jest.fn(),
  changeChannelWebhookStatus: jest.fn(),
  renameChannelWebhook: jest.fn(),
  deleteChannelWebhook: jest.fn(),
  getChannelWebhookHistory: jest.fn(),
}));
const mockState: { current: any; dark: boolean } = { current: {}, dark: false };
jest.mock('@/store/useDataContext', () => ({
  useDataContext: () => ({ state: mockState.current, dispatch: jest.fn() }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors:
      require('@/theme/palettes')[
        mockState.dark ? 'darkColors' : 'lightColors'
      ],
    isDark: mockState.dark,
  }),
}));
jest.mock('@/components/layout/container', () => 'Container');
jest.mock('@/components/ui/text', () => ({ AppText: 'AppText' }));
jest.mock('@/components/ui/toast', () => ({ ShowNotify: jest.fn() }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('@/components/ui/bottom-sheet', () => 'Sheet');
const calls = jest.mocked(api);
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const props = {
  route: { params: { channel_id: 'channel-1' } },
  navigation,
} as any;
const historyProps = {
  route: { params: { channel_id: 'channel-1', webhook_id: 'hook-1' } },
  navigation,
} as any;
let tree: renderer.ReactTestRenderer;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const mount = async (element: React.ReactElement) => {
  await act(async () => {
    tree = renderer.create(element);
  });
};
const text = () =>
  tree.root
    .findAll(node => node.type === ('AppText' as any))
    .map(node =>
      node.children
        .filter(child => typeof child === 'string' || typeof child === 'number')
        .join(''),
    )
    .join(' ');
const button = (label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label)!;
const press = async (label: string) => {
  expect(button(label)).toBeDefined();
  await act(async () => {
    button(label).props.onPress();
  });
};
beforeEach(() => {
  jest.resetAllMocks();
  mockState.current = {
    orgId: 'org-1',
    orgData: { user_role: { permission_list: { 'create:webhooks': true } } },
  };
  mockState.dark = false;
  calls.getChannelWebhook.mockResolvedValue(webhookFixture());
  calls.createChannelWebhook.mockResolvedValue(webhookFixture());
  calls.changeChannelWebhookStatus.mockResolvedValue(
    webhookFixture({ status: 'inactive' }),
  );
  calls.renameChannelWebhook.mockResolvedValue(
    webhookFixture({ webhook_name: 'Renamed', event_name: 'custom' }),
  );
  calls.deleteChannelWebhook.mockResolvedValue();
  calls.getChannelWebhookHistory.mockResolvedValue({
    items: [],
    page: 1,
    hasMore: false,
  });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  jest.restoreAllMocks();
});

test('loading is distinct from no webhook, then shows the existing webhook', async () => {
  const pending = deferred<ReturnType<typeof webhookFixture>>();
  calls.getChannelWebhook.mockReturnValue(pending.promise);
  await mount(<ChannelWebhookScreen {...props} />);
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Loading webhook' }).length,
  ).toBeGreaterThan(0);
  expect(text()).not.toContain('No webhook yet');
  await act(async () => pending.resolve(webhookFixture()));
  expect(text()).toContain('Updates');
  expect(text()).toContain('Active');
  expect(text()).toContain('Webhook URL');
});
test('none state explains creation and a successful create renders the result', async () => {
  calls.getChannelWebhook.mockResolvedValue(null);
  await mount(<ChannelWebhookScreen {...props} />);
  expect(text()).toContain('No webhook yet');
  await press('Create webhook');
  expect(calls.createChannelWebhook).toHaveBeenCalledWith('channel-1');
  expect(text()).toContain('Updates');
});
test('double taps on create are coalesced and mutation buttons stay disabled', async () => {
  calls.getChannelWebhook.mockResolvedValue(null);
  const pending = deferred<ReturnType<typeof webhookFixture>>();
  calls.createChannelWebhook.mockReturnValue(pending.promise);
  await mount(<ChannelWebhookScreen {...props} />);
  await act(async () => {
    button('Create webhook').props.onPress();
    button('Create webhook').props.onPress();
  });
  expect(calls.createChannelWebhook).toHaveBeenCalledTimes(1);
  expect(button('Create webhook').props.disabled).toBe(true);
  await act(async () => pending.resolve(webhookFixture()));
  expect(text()).toContain('Updates');
});
test('status update is serialized and failed status keeps its previous value with a clear error', async () => {
  await mount(<ChannelWebhookScreen {...props} />);
  calls.changeChannelWebhookStatus.mockRejectedValueOnce(
    new Error('Status update denied'),
  );
  await act(async () =>
    tree.root.findByType(Switch).props.onValueChange(false),
  );
  expect(calls.changeChannelWebhookStatus).toHaveBeenCalledWith(
    'channel-1',
    'hook-1',
    'inactive',
  );
  expect(tree.root.findByType(Switch).props.value).toBe(true);
  expect(text()).toContain('Status update denied');
  await act(async () =>
    tree.root.findByType(Switch).props.onValueChange(false),
  );
  expect(tree.root.findByType(Switch).props.value).toBe(false);
});
test('rename validates the name, keeps fields on failure and saves event_name', async () => {
  await mount(<ChannelWebhookScreen {...props} />);
  await press('Rename webhook');
  const name = () =>
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Webhook name')!;
  const event = () =>
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Event name')!;
  act(() => name().props.onChangeText('   '));
  await press('Save changes');
  expect(text()).toContain('Webhook name is required');
  expect(calls.renameChannelWebhook).not.toHaveBeenCalled();
  act(() => {
    name().props.onChangeText('Renamed');
    event().props.onChangeText('custom');
  });
  calls.renameChannelWebhook.mockRejectedValueOnce(new Error('Rename failed'));
  await press('Save changes');
  expect(text()).toContain('Rename failed');
  expect(name().props.value).toBe('Renamed');
  expect(text()).toContain('Updates');
  await press('Save changes');
  expect(calls.renameChannelWebhook).toHaveBeenLastCalledWith(
    'channel-1',
    'hook-1',
    'Renamed',
    'custom',
  );
  expect(text()).toContain('Renamed');
});
test('delete requires confirmation, shows failures inside the sheet and can be retried', async () => {
  await mount(<ChannelWebhookScreen {...props} />);
  await press('Delete webhook');
  expect(calls.deleteChannelWebhook).not.toHaveBeenCalled();
  expect(text()).toContain('Delete this webhook?');
  calls.deleteChannelWebhook.mockRejectedValueOnce(new Error('Delete failed'));
  await press('Confirm delete');
  expect(text()).toContain('Delete failed');
  expect(text()).toContain('Updates');
  await press('Confirm delete');
  expect(text()).toContain('No webhook yet');
  expect(calls.deleteChannelWebhook).toHaveBeenCalledWith(
    'channel-1',
    'hook-1',
  );
});
test('failed create is an error, not a successful empty state, and Retry only reads', async () => {
  calls.getChannelWebhook.mockResolvedValue(null);
  calls.createChannelWebhook.mockRejectedValue(new Error('Creation forbidden'));
  await mount(<ChannelWebhookScreen {...props} />);
  await press('Create webhook');
  expect(text()).toContain('Creation forbidden');
  await press('Retry');
  expect(calls.createChannelWebhook).toHaveBeenCalledTimes(1);
  expect(text()).toContain('No webhook yet');
});
test('copy uses the displayed URL and gives feedback; history has a typed destination', async () => {
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  await mount(<ChannelWebhookScreen {...props} />);
  await press('Copy URL');
  expect(copy).toHaveBeenCalledWith(webhookFixture().webhook_url);
  expect(ShowNotify).toHaveBeenCalledWith('Success', 'Webhook URL copied');
  await press('Delivery history');
  expect(navigation.navigate).toHaveBeenCalledWith('WebhookHistory', {
    channel_id: 'channel-1',
    webhook_id: 'hook-1',
  });
});
test('known denied permissions block direct routes without making requests', async () => {
  mockState.current.orgData = {
    user_role: { permission_list: { 'read:channels': true } },
  };
  await mount(<ChannelWebhookScreen {...props} />);
  expect(text()).toContain('do not have permission');
  expect(calls.getChannelWebhook).not.toHaveBeenCalled();
  expect(button('Create webhook')).toBeUndefined();
});
test('missing role data defers to the backend and shows its permission error', async () => {
  mockState.current.orgData = {};
  calls.getChannelWebhook.mockRejectedValue(new Error('Forbidden by backend'));
  await mount(<ChannelWebhookScreen {...props} />);
  expect(text()).toContain('Forbidden by backend');
  expect(text()).not.toContain('No webhook yet');
});
test('a late previous-channel load cannot overwrite the new screen', async () => {
  const old = deferred<ReturnType<typeof webhookFixture>>();
  calls.getChannelWebhook
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(
      webhookFixture({
        id: 'hook-2',
        channel_id: 'channel-2',
        webhook_name: 'Second channel',
      }),
    );
  await mount(<ChannelWebhookScreen {...props} />);
  await act(async () =>
    tree.update(
      <ChannelWebhookScreen
        {...props}
        route={{ params: { channel_id: 'channel-2' } } as any}
      />,
    ),
  );
  await act(async () => old.resolve(webhookFixture()));
  expect(text()).toContain('Second channel');
  expect(text()).not.toContain('Updates');
});
test('history has a successful empty state and a visible initial loading state', async () => {
  const pending = deferred<{
    items: never[];
    page: number;
    hasMore: boolean;
  }>();
  calls.getChannelWebhookHistory.mockReturnValue(pending.promise);
  await mount(<WebhookHistoryScreen {...historyProps} />);
  expect(text()).not.toContain('No delivery history yet');
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Loading delivery history' })
      .length,
  ).toBeGreaterThan(0);
  await act(async () =>
    pending.resolve({ items: [], page: 1, hasMore: false }),
  );
  expect(text()).toContain('No delivery history yet');
});
test('history paginates, retains rows on error, retries the same page and deduplicates rows', async () => {
  calls.getChannelWebhookHistory
    .mockResolvedValueOnce({
      items: [historyFixture()],
      page: 1,
      hasMore: true,
    })
    .mockRejectedValueOnce(new Error('History unavailable'))
    .mockResolvedValueOnce({
      items: [
        historyFixture(),
        historyFixture({ id: 'delivery-2', status_code: 500, retries: 2 }),
      ],
      page: 2,
      hasMore: false,
    });
  await mount(<WebhookHistoryScreen {...historyProps} />);
  expect(text()).toContain('Status 200');
  await press('Load more');
  expect(text()).toContain('History unavailable');
  expect(text()).toContain('Status 200');
  await press('Retry history');
  expect(calls.getChannelWebhookHistory).toHaveBeenLastCalledWith(
    'channel-1',
    'hook-1',
    2,
  );
  expect(text()).toContain('Status 500');
  expect(text()).toContain('Retries: 2');
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(2);
});
test('history pull-to-refresh restarts at page one and permission denial blocks history', async () => {
  calls.getChannelWebhookHistory.mockResolvedValue({
    items: [historyFixture()],
    page: 1,
    hasMore: false,
  });
  await mount(<WebhookHistoryScreen {...historyProps} />);
  await act(async () => tree.root.findByType(FlatList).props.onRefresh());
  expect(calls.getChannelWebhookHistory).toHaveBeenLastCalledWith(
    'channel-1',
    'hook-1',
    1,
  );
  mockState.current.orgData = { user_role: {} };
  calls.getChannelWebhookHistory.mockClear();
  await act(async () =>
    tree.update(<WebhookHistoryScreen {...historyProps} />),
  );
  expect(text()).toContain('do not have permission');
  expect(calls.getChannelWebhookHistory).not.toHaveBeenCalled();
});
test('theme changes preserve both screen and status content', async () => {
  mockState.dark = true;
  await mount(<ChannelWebhookScreen {...props} />);
  expect(text()).toContain('Updates');
  expect(text()).toContain('Active');
  mockState.dark = false;
  await act(async () => tree.update(<ChannelWebhookScreen {...props} />));
  expect(text()).toContain('Updates');
});

test('double taps on status and confirmation do not duplicate mutations', async () => {
  await mount(<ChannelWebhookScreen {...props} />);
  const status = deferred<ReturnType<typeof webhookFixture>>();
  calls.changeChannelWebhookStatus.mockReturnValue(status.promise);
  await act(async () => {
    tree.root.findByType(Switch).props.onValueChange(false);
    tree.root.findByType(Switch).props.onValueChange(false);
  });
  expect(calls.changeChannelWebhookStatus).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(Switch).props.disabled).toBe(true);
  await act(async () => status.resolve(webhookFixture({ status: 'inactive' })));
  await press('Delete webhook');
  const deletion = deferred<void>();
  calls.deleteChannelWebhook.mockReturnValue(deletion.promise);
  await act(async () => {
    button('Confirm delete').props.onPress();
    button('Confirm delete').props.onPress();
  });
  expect(calls.deleteChannelWebhook).toHaveBeenCalledTimes(1);
  expect(button('Confirm delete').props.disabled).toBe(true);
  await act(async () => deletion.resolve());
  expect(text()).toContain('No webhook yet');
});
test('double taps on rename send one update', async () => {
  await mount(<ChannelWebhookScreen {...props} />);
  await press('Rename webhook');
  const pending = deferred<ReturnType<typeof webhookFixture>>();
  calls.renameChannelWebhook.mockReturnValue(pending.promise);
  act(() =>
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Webhook name')!
      .props.onChangeText('Renamed'),
  );
  await act(async () => {
    button('Save changes').props.onPress();
    button('Save changes').props.onPress();
  });
  expect(calls.renameChannelWebhook).toHaveBeenCalledTimes(1);
  await act(async () =>
    pending.resolve(webhookFixture({ webhook_name: 'Renamed' })),
  );
  expect(text()).toContain('Renamed');
});
test('history returning to the same route does not accept an older request', async () => {
  const old = deferred<{
    items: ReturnType<typeof historyFixture>[];
    page: number;
    hasMore: boolean;
  }>();
  calls.getChannelWebhookHistory
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ items: [], page: 1, hasMore: false })
    .mockResolvedValueOnce({
      items: [historyFixture({ id: 'fresh-delivery' })],
      page: 1,
      hasMore: false,
    });
  await mount(<WebhookHistoryScreen {...historyProps} />);
  await act(async () =>
    tree.update(
      <WebhookHistoryScreen
        {...historyProps}
        route={
          { params: { channel_id: 'channel-2', webhook_id: 'hook-2' } } as any
        }
      />,
    ),
  );
  await act(async () =>
    tree.update(<WebhookHistoryScreen {...historyProps} />),
  );
  await act(async () =>
    old.resolve({
      items: [historyFixture({ id: 'stale-delivery' })],
      page: 1,
      hasMore: false,
    }),
  );
  expect(
    tree.root.findByType(FlatList).props.data.map((item: any) => item.id),
  ).toEqual(['fresh-delivery']);
});
test('initial history errors show Retry rather than an empty result', async () => {
  calls.getChannelWebhookHistory.mockRejectedValueOnce(
    new Error('History denied'),
  );
  await mount(<WebhookHistoryScreen {...historyProps} />);
  expect(text()).toContain('History denied');
  expect(text()).not.toContain('No delivery history yet');
  calls.getChannelWebhookHistory.mockResolvedValueOnce({
    items: [],
    page: 1,
    hasMore: false,
  });
  await press('Retry history');
  expect(calls.getChannelWebhookHistory).toHaveBeenLastCalledWith(
    'channel-1',
    'hook-1',
    1,
  );
  expect(text()).toContain('No delivery history yet');
});
