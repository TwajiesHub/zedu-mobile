import { openSavedMessage } from '../saved-message-navigation';
import { savedFixture } from '@/test-fixtures/saved-message';
import { ACTIONS } from '@/store/types';

test.each([
  ['public', 'ChannelStack', 'ChannelChat'],
  ['private', 'ChannelStack', 'ChannelChat'],
  ['dm', 'ChatStack', 'ChatDetails'],
  ['groupDM', 'ChatStack', 'GroupChatDetails'],
])(
  'root opens %s conversation with a loaded-only highlight target',
  (channel_type, stack, screen) => {
    const navigate = jest.fn();
    const dispatch = jest.fn();
    expect(
      openSavedMessage(savedFixture({ channel_type }), { navigate }, dispatch),
    ).toBe(true);
    expect(navigate).toHaveBeenCalledWith(stack, {
      screen,
      params: {
        channel_id: 'channel-1',
        fromNotification: true,
        highlight_thread_id: 'thread-1',
      },
    });
  },
);
test.each([
  ['public', 'ChannelStack', 'ChannelThread'],
  ['dm', 'ChatStack', 'ChatThreadScreen'],
  ['groupDM', 'ChatStack', 'GroupChatThreadScreen'],
])(
  'reply opens %s thread without promising an exact reply jump',
  (channel_type, stack, screen) => {
    const navigate = jest.fn();
    const dispatch = jest.fn();
    openSavedMessage(
      savedFixture({ channel_type, type: 'message', message_id: 'reply-1' }),
      { navigate },
      dispatch,
    );
    expect(navigate).toHaveBeenCalledWith(
      stack,
      expect.objectContaining({
        screen,
        params: expect.objectContaining({
          thread_id: 'thread-1',
          channel_id: 'channel-1',
        }),
      }),
    );
    expect(
      navigate.mock.calls[0][1].params.highlight_message_id,
    ).toBeUndefined();
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.REPLY_CHAT,
      payload: { data: [], page: 1 },
    });
  },
);
test('unavailable targets do not navigate or confuse the saved id with a message id', () => {
  const navigate = jest.fn();
  expect(
    openSavedMessage(savedFixture({ thread_id: '' }), { navigate }, jest.fn()),
  ).toBe(false);
  expect(navigate).not.toHaveBeenCalled();
});
