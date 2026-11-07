/**
 * Long-press on messages: the message menu must open for media messages
 * (image, video, file) as well as for text, and the menu sheets must mount
 * in the right state.
 *
 * These tests check the wiring (props), not real touch routing. React Native
 * hands a press to the innermost touchable, so a media touchable without its
 * own onLongPress swallows the press. Asserting the prop on that touchable is
 * what catches the bug; a simulated long-press would bubble to the wrapper
 * and pass either way.
 */
import React from 'react';
import { TouchableOpacity, InteractionManager } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import DmMessageItem from '@/components/layout/chat/messagItem';
import GroupMessageItem from '@/components/layout/group-chat/messagItem';
import ChannelMessageItem from '@/components/layout/channels/messagItem';
import ThreadReplyItem from '@/components/layout/channels/thread-message-item';
import { ChatFileAttachmentCard } from '@/components/layout/chat/chat-file-attachment';
import { MessageAction } from '@/components/layout/chat/message-action';
import { ReplyMessageAction } from '@/components/layout/chat/reply-message-action';

// --- module boundaries: keep the components under test, stub everything else
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock('@/theme/createMessageStyles', () => {
  const styles = () => new Proxy({}, { get: () => ({}) });
  return new Proxy(
    { __esModule: true },
    { get: (target: any, key: string) => target[key] ?? styles },
  );
});
jest.mock('@/theme/createChatOverlayStyles', () => {
  const styles = () => new Proxy({}, { get: () => ({}) });
  return new Proxy(
    { __esModule: true },
    { get: (target: any, key: string) => target[key] ?? styles },
  );
});
jest.mock('@/store/useDataContext', () => ({
  useDataContext: () => ({ state: {}, dispatch: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ name: 'ChatDetails' }),
}));
jest.mock('react-native-fast-image', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const FastImage = (props: any) =>
    mockReact.createElement(View, { ...props, testID: 'media-image' });
  FastImage.resizeMode = { cover: 'cover', contain: 'contain' };
  return { __esModule: true, default: FastImage };
});
jest.mock('react-native-video', () => 'Video');
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('rn-emoji-keyboard', () => ({
  __esModule: true,
  default: 'EmojiPicker',
}));
jest.mock('@/components/ui/text', () => ({ AppText: 'Text' }));
jest.mock('@/components/ui/toast', () => ({ ShowNotify: jest.fn() }));
jest.mock('@/components/ui/user-status-icon', () => ({
  UserStatusIcon: 'UserStatusIcon',
}));
jest.mock('@/utils/normalize', () => ({ normalize: (n: number) => n }));
jest.mock('@/utils/requests', () => ({
  PostRequest: jest.fn(),
  DeleteRequest: jest.fn(),
}));
jest.mock('@/components/layout/chat/media-viewer', () => 'MediaViewer');
jest.mock('@/components/layout/chat/message-content', () => ({
  MessageContent: 'MessageContent',
}));
jest.mock('@/components/layout/chat/audio-message-player', () => ({
  AudioMessagePlayer: 'AudioMessagePlayer',
}));
jest.mock('@/components/layout/chat/forwarded-message-block', () => ({
  ForwardedMessageBlock: 'ForwardedMessageBlock',
}));
jest.mock('@/components/layout/chat/reaction-details', () => 'ReactionDetails');
jest.mock('@/components/layout/chat/in-app-document-viewer', () => ({
  InAppDocumentViewer: 'InAppDocumentViewer',
}));
jest.mock('@/components/layout/chat/forward-message-modal', () => ({
  ForwardMessageModal: 'ForwardMessageModal',
}));
jest.mock('@/components/layout/channels/channel-event-message-block', () => ({
  ChannelEventMessageBlock: 'ChannelEventMessageBlock',
}));
// Records the props each sheet is mounted with.
jest.mock('@/components/ui/bottom-sheet', () => {
  const mockReact = require('react');
  const calls: any[] = [];
  const Sheet = mockReact.forwardRef((props: any, ref: any) => {
    mockReact.useImperativeHandle(ref, () => ({
      expand: mockExpand,
      close: jest.fn(),
    }));
    calls.push(props);
    return null;
  });
  return { __esModule: true, default: Sheet, __calls: calls };
});

const mockExpand = jest.fn();

const sheetCalls: any[] = jest.requireMock(
  '@/components/ui/bottom-sheet',
).__calls;

// The app code calls the deprecated InteractionManager; keep that noise out
// of the test output but let every other warning through.
const realWarn = console.warn;
beforeAll(() => {
  jest
    .spyOn(InteractionManager, 'runAfterInteractions')
    .mockImplementation((callback: any) => {
      callback();
      return { cancel: jest.fn() } as any;
    });
  jest.spyOn(console, 'warn').mockImplementation((message, ...rest) => {
    if (String(message).includes('InteractionManager has been deprecated')) {
      return;
    }
    realWarn(message, ...rest);
  });
});
afterAll(() => jest.restoreAllMocks());
beforeEach(() => {
  sheetCalls.length = 0;
  mockExpand.mockClear();
});

// --- fixtures
const MEDIA: Record<string, any> = {
  image: {
    id: 'm-image',
    file_link: 'https://zedu.chat/files/photo.png',
    file_type: 'png',
    file_name: 'photo.png',
    mime_type: 'image/png',
  },
  video: {
    id: 'm-video',
    file_link: 'https://zedu.chat/files/clip.mp4',
    file_type: 'mp4',
    file_name: 'clip.mp4',
    mime_type: 'video/mp4',
  },
  file: {
    id: 'm-file',
    file_link: 'https://zedu.chat/files/notes.pdf',
    file_type: 'pdf',
    file_name: 'notes.pdf',
    mime_type: 'application/pdf',
  },
};

const messageWith = (media: any) => ({
  thread_id: 'thread-1',
  channels_id: 'channel-1',
  message: '<p></p>',
  created_at: '2026-10-11T12:00:00.000Z',
  username: 'ada',
  user_id: 'user-1',
  sent: true,
  type: 'message',
  reactions: [],
  media: [media],
});

const render = (element: React.ReactElement) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree;
};

// The touchable that directly wraps a rendered media element.
const touchableAround = (node: renderer.ReactTestInstance) => {
  let current: renderer.ReactTestInstance | null = node.parent;
  while (current && current.type !== TouchableOpacity) {
    current = current.parent;
  }
  return current;
};

// --- media in message bubbles
const BUBBLES: [string, React.ComponentType<any>, string[]][] = [
  ['DM', DmMessageItem, ['image', 'video', 'file']],
  ['group chat', GroupMessageItem, ['image', 'video', 'file']],
  ['channel', ChannelMessageItem, ['image', 'video', 'file']],
  ['thread reply', ThreadReplyItem, ['image', 'video']],
];

describe.each(BUBBLES)('%s message bubble', (_name, Bubble, kinds) => {
  it.each(kinds)('passes the long-press through on %s media', kind => {
    const item = messageWith(MEDIA[kind]);
    const onLongPress = jest.fn();
    const tree = render(
      <Bubble
        item={item}
        index={0}
        messages={[item]}
        onLongPress={onLongPress}
      />,
    );

    let handler: (() => void) | undefined;
    if (kind === 'file') {
      handler = tree.root.findByType(ChatFileAttachmentCard).props.onLongPress;
    } else {
      // Avatars use the same image component, so match on the media URL.
      const media = tree.root.find(node =>
        kind === 'image'
          ? typeof node.type === 'string' &&
            node.props.testID === 'media-image' &&
            node.props.source?.uri === MEDIA.image.file_link
          : (node.type as unknown) === 'Video',
      );
      handler = touchableAround(media)?.props.onLongPress;
    }

    expect(typeof handler).toBe('function');
    act(() => handler!());
    expect(onLongPress).toHaveBeenCalledWith(item);
  });
});

// --- action sheets
// The wrapper starts closed. Message actions expand it through its ref after
// interactions settle, and must not expand it when no message is selected.
describe.each([
  ['MessageAction', MessageAction],
  ['ReplyMessageAction', ReplyMessageAction],
])('%s sheet', (_name, Sheet: any) => {
  const mountedWith = (item: any) => {
    render(
      <Sheet
        ref={React.createRef()}
        item={item}
        onClose={jest.fn()}
        handleEdit={jest.fn()}
      />,
    );
    return sheetCalls[sheetCalls.length - 1];
  };

  it('mounts closed while no message is selected', () => {
    mountedWith(null);
    expect(mockExpand).not.toHaveBeenCalled();
  });

  it('mounts expanded once a message is selected', () => {
    mountedWith({ thread_id: 'thread-1', message: 'hi' });
    expect(mockExpand).toHaveBeenCalledTimes(1);
  });
});
