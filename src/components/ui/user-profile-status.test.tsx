import React from 'react';
import { StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { UserProfileStatus } from './user-profile-status';
import { AppText } from '@/components/ui/text';
import { darkColors, lightColors } from '@/theme/palettes';
import type { ThemeColors } from '@/theme/types';

let mockColors: ThemeColors = lightColors;
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: mockColors }),
}));
jest.mock('@/hooks/useUserProfileStatus', () => ({
  useUserProfileStatus: () => null,
}));

const user = { icon: '📚', text: 'Studying for exams' };

describe('UserProfileStatus theming', () => {
  let tree: TestRenderer.ReactTestRenderer | undefined;

  const renderStatus = async (colors: ThemeColors) => {
    mockColors = colors;
    await act(async () => {
      tree = TestRenderer.create(<UserProfileStatus user={user} />);
    });
    return tree!;
  };

  const bubbleStyle = (renderer: TestRenderer.ReactTestRenderer) =>
    StyleSheet.flatten(renderer.root.findByType(View).props.style);

  const statusTextStyle = (renderer: TestRenderer.ReactTestRenderer) => {
    const label = renderer.root
      .findAllByType(AppText)
      .find(node => node.props.children === user.text);
    return StyleSheet.flatten(label?.props.style);
  };

  afterEach(async () => {
    if (tree) {
      await act(async () => tree?.unmount());
      tree = undefined;
    }
  });

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ])('uses the %s theme colours for the bubble and text', async (_, colors) => {
    const renderer = await renderStatus(colors);

    expect(bubbleStyle(renderer).backgroundColor).toBe(
      colors.reactionBackground,
    );
    expect(statusTextStyle(renderer).color).toBe(colors.iconDefault);
  });

  it('renders nothing when the user has no status', async () => {
    mockColors = darkColors;
    await act(async () => {
      tree = TestRenderer.create(<UserProfileStatus user={{}} />);
    });

    expect(tree!.toJSON()).toBeNull();
  });
});
