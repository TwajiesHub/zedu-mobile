/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import ChannelDetailsScreen from '@/screens/channels/channel-details';

const mockState: { current: any } = { current: {} };

jest.mock('@/store/useDataContext', () => ({
  useDataContext: () => ({ state: mockState.current, dispatch: jest.fn() }),
}));

// The bottom sheets and modal on this screen need native animation drivers and aren't under test.
jest.mock('@/components/layout/channels/add-description', () => ({
  AddDescription: () => null,
}));
jest.mock('@/components/layout/channels/exit-channel', () => ({
  ExitChannelSheet: () => null,
}));
jest.mock(
  '@/components/layout/channels/remove-members-confirmation-modal',
  () => () => null,
);

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: require('@/theme/palettes').lightColors,
    isDark: false,
  }),
}));

const participants = [
  'ada_okafor',
  'tunde.b',
  'chioma_eze',
  'ibrahim_m',
  'grace.a',
  'femi_j',
  'musa_k',
  'kemi_o',
  'lola_p',
].map((username, index) => ({
  user_id: `user-${index}`,
  username,
  avatar_url: '',
}));

const renderScreen = async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ChannelDetailsScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { channel_id: 'channel-1' } }}
      />,
    );
  });
  const texts = renderer!.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''));
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
  return texts;
};

describe('ChannelDetailsScreen title', () => {
  beforeEach(() => {
    mockState.current = {
      user: { user_id: 'user-0' },
      orgData: {},
      channelDetails: {
        name: 'announcement',
        description: '',
        participants,
      },
    };
  });

  it("shows the channel's name as the title", async () => {
    const texts = await renderScreen();

    expect(texts).toContain('#announcement');
  });

  it('does not use the member usernames as the title', async () => {
    const texts = await renderScreen();

    expect(texts).not.toContain(
      participants
        .slice(0, 8)
        .map(p => p.username)
        .join(', '),
    );
  });

  it('offers Webhooks when the role grants create:webhooks', async () => {
    mockState.current.orgData = {
      user_role: { permission_list: { 'create:webhooks': true } },
    };
    expect(await renderScreen()).toContain('Webhooks');
  });

  it('hides Webhooks when a known role lacks create:webhooks', async () => {
    mockState.current.orgData = {
      user_role: { permission_list: { 'read:channels': true } },
    };
    expect(await renderScreen()).not.toContain('Webhooks');
  });

  it('shows no stray "#" while the channel details are still loading', async () => {
    mockState.current = { ...mockState.current, channelDetails: undefined };

    const texts = await renderScreen();

    expect(texts).not.toContain('#');
  });
});
