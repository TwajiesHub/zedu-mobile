import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FlatList, TouchableOpacity } from 'react-native';
import LaterScreen from '../index';
import MoreScreen from '@/screens/more';
import { SaveForLaterAction } from '@/components/layout/chat/save-for-later-action';
import { SavedMessageIndicator } from '@/components/layout/chat/saved-message-indicator';
import { initialSavedMessages } from '@/store/saved-messages';
import { savedFixture } from '@/test-fixtures/saved-message';
import { useSavedMessages } from '@/hooks/useSavedMessages';
import { openSavedMessage } from '@/services/saved-message-navigation';

jest.mock('@/hooks/useSavedMessages', () => ({ useSavedMessages: jest.fn() }));
jest.mock('@/services/saved-message-navigation', () => ({
  openSavedMessage: jest.fn(() => true),
}));
jest.mock('@/store/useDataContext', () => ({
  useDataContext: () => ({ state: { orgId: 'org-a' }, dispatch: jest.fn() }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { primary: '#111', background: '#fff' } }),
}));
jest.mock('@/components/layout/container', () => 'Container');
jest.mock('@/components/ui/text', () => ({ AppText: 'AppText' }));
jest.mock('@/components/ui/toast', () => ({ ShowNotify: jest.fn() }));
jest.mock('@/utils/normalize', () => ({ normalize: (n: number) => n }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useFocusEffect: (effect: () => void) => {
    const react = require('react');
    react.useEffect(effect, [effect]);
  },
}));
const controller = {
  loadPage: jest.fn().mockResolvedValue(undefined),
  loadLookup: jest.fn().mockResolvedValue(undefined),
  setSaved: jest.fn().mockResolvedValue(true),
  remove: jest.fn().mockResolvedValue(true),
};
const useSaved = jest.mocked(useSavedMessages);
let tree: renderer.ReactTestRenderer;
const mount = (element: React.ReactElement) => {
  act(() => {
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
    .join(' ') +
  ' ' +
  tree.root
    .findAll(node => typeof node.props.accessibilityLabel === 'string')
    .map(node => node.props.accessibilityLabel)
    .join(' ');
const press = async (label: string) => {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label);
  expect(button).toBeDefined();
  await act(async () => {
    await button!.props.onPress();
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  useSaved.mockReturnValue({
    saved: { ...initialSavedMessages(), lookupLoaded: true, hasMore: false },
    controller: controller as any,
    orgId: 'org-a',
  });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
});

test('loads when focused and shows Nothing saved yet after a successful empty response', () => {
  mount(<LaterScreen />);
  expect(controller.loadPage).toHaveBeenCalledWith(true);
  expect(text()).toContain('Nothing saved yet');
});
test('initial loading hides the empty state', () => {
  useSaved.mockReturnValue({
    ...useSaved(),
    saved: { ...initialSavedMessages(), loading: true },
  });
  mount(<LaterScreen />);
  expect(text()).toContain('Loading saved messages');
  expect(text()).not.toContain('Nothing saved yet');
});
test('error shows Retry without misrepresenting failure as empty', async () => {
  useSaved.mockReturnValue({
    ...useSaved(),
    saved: { ...initialSavedMessages(), error: 'Network unavailable' },
  });
  mount(<LaterScreen />);
  expect(text()).toContain('Network unavailable');
  expect(text()).toContain('Retry');
  expect(text()).not.toContain('Nothing saved yet');
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(
      node =>
        node.findAll(
          child =>
            child.type === ('AppText' as any) &&
            child.props.children === 'Retry',
        ).length > 0,
    );
  await act(async () => button!.props.onPress());
  expect(controller.loadPage).toHaveBeenLastCalledWith(true);
});
test('renders only response metadata and safely previews HTML; remove uses the saved record', async () => {
  const item = savedFixture();
  useSaved.mockReturnValue({
    ...useSaved(),
    saved: { ...initialSavedMessages(), items: [item], page: 1, hasMore: true },
  });
  mount(<LaterScreen />);
  expect(text()).toContain('Hello & welcome');
  expect(text()).not.toContain('<p>');
  expect(text()).toContain('general');
  expect(text()).toContain('Public channel');
  expect(text()).toContain('Saved ');
  await press('Remove from Later');
  expect(controller.remove).toHaveBeenCalledWith(item);
  await press('Open saved message from Ada');
  expect(openSavedMessage).toHaveBeenCalledWith(
    item,
    expect.anything(),
    expect.anything(),
  );
});
test('refresh and pagination are wired independently and errors retain existing items', async () => {
  useSaved.mockReturnValue({
    ...useSaved(),
    saved: {
      ...initialSavedMessages(),
      items: [savedFixture()],
      page: 1,
      error: 'Page failed',
      hasMore: true,
    },
  });
  mount(<LaterScreen />);
  expect(text()).toContain('Hello & welcome');
  const list = tree.root.findByType(FlatList);
  await act(async () => list.props.onRefresh());
  expect(controller.loadPage).toHaveBeenLastCalledWith(true);
  controller.loadPage.mockClear();
  await act(async () => list.props.onEndReached());
  expect(controller.loadPage).not.toHaveBeenCalled();
});
test('More opens the typed Later route without adding another bottom tab', async () => {
  mount(<MoreScreen />);
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(
      node =>
        node.findAllByProps({ title: 'Later' }).length > 0 ||
        node.findAll(
          child =>
            child.type === ('AppText' as any) &&
            child.props.children === 'Later',
        ).length > 0,
    );
  expect(button).toBeDefined();
  await act(async () => button!.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Later');
});
test('menu changes Save for later to Remove from Later and marks the message saved', async () => {
  const item = savedFixture();
  mount(
    <SaveForLaterAction item={{ ...item, channels_id: item.channel_id }} />,
  );
  expect(text()).toContain('Save for later');
  const button = tree.root.findByType(TouchableOpacity);
  await act(async () => button.props.onPress());
  expect(controller.setSaved).toHaveBeenCalledWith(
    expect.objectContaining({ thread_id: item.thread_id }),
    true,
  );
  useSaved.mockReturnValue({
    ...useSaved(),
    saved: {
      ...initialSavedMessages(),
      lookupLoaded: true,
      lookup: { 'thread:thread-1': item },
    },
  });
  act(() =>
    tree.update(
      <SaveForLaterAction item={{ ...item, channels_id: item.channel_id }} />,
    ),
  );
  expect(text()).toContain('Remove from Later');
  expect(text()).toContain('Saved for later');
});
test('reply menu uses message identity and pending disables another tap', () => {
  const item = savedFixture({ type: 'message', message_id: 'reply-1' });
  useSaved.mockReturnValue({
    ...useSaved(),
    saved: {
      ...initialSavedMessages(),
      lookupLoaded: true,
      pending: { 'reply:reply-1': true },
    },
  });
  mount(
    <SaveForLaterAction kind="message" item={{ ...item, id: 'reply-1' }} />,
  );
  expect(tree.root.findByType(TouchableOpacity).props.disabled).toBe(true);
});
test('saved indicator distinguishes a reply from its parent', () => {
  useSaved.mockReturnValue({
    ...useSaved(),
    saved: {
      ...initialSavedMessages(),
      lookup: {
        'reply:reply-1': savedFixture({
          type: 'message',
          message_id: 'reply-1',
        }),
      },
    },
  });
  mount(<SavedMessageIndicator item={{ thread_id: 'thread-1' }} />);
  expect(tree.toJSON()).toBeNull();
  act(() =>
    tree.update(
      <SavedMessageIndicator
        item={{ id: 'reply-1', thread_id: 'thread-1' }}
        reply
      />,
    ),
  );
  expect(text()).toContain('Saved for later');
});
